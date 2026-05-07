require("dotenv").config();
const { ethers } = require("ethers");
const Groq = require("groq-sdk");
const { WebSocketServer } = require("ws");

const CONTRACT_ADDRESS = "0xcb50EA7028Ccc307E3C45C7fc0cF3a5475e449cA";

const ABI = [
  "function getTokens() external",
  "function swap(uint256 amountIn) external",
  "function tokenA(address) view returns (uint256)",
  "function tokenB(address) view returns (uint256)",
  "function reserveA() view returns (uint256)",
  "function reserveB() view returns (uint256)",
  "function getPrice() view returns (uint256)"
];

// ─── WebSocket Dashboard Server ───────────────────────────────────
const wss = new WebSocketServer({ port: 3001 });
// second server for protect.js to report to
const wss2 = new WebSocketServer({ port: 3002 });
wss2.on("connection", (ws) => {
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "prevented") {
        console.log("🛡️  Attack prevented — forwarding to dashboard");
        sendToDashboard(msg);
      }
    } catch (e) {}
  });
});
let dashboardClient = null;

wss.on("connection", (ws) => {
  dashboardClient = ws;
  console.log("📊 Dashboard connected!");
  
  // listen for messages FROM protect.js
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "prevented") {
        console.log("🛡️  Prevention event received from protect.js");
        sendToDashboard(msg);
      }
    } catch (e) {}
  });
});

function sendToDashboard(data) {
  if (dashboardClient && dashboardClient.readyState === 1) {
    dashboardClient.send(JSON.stringify(data));
  }
}

// ─── AI via Groq ──────────────────────────────────────────────────
async function aiExplanation(amountIn, victimGas, botGas, expected, actual, blockNum) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const prompt = [
    "You are a blockchain security expert explaining an MEV sandwich attack.",
    "",
    "A bot front-ran a victim's DEX swap transaction:",
    `- Victim tried to swap ${amountIn} Token A`,
    `- Victim gas price: ${victimGas} gwei (low = easy to front-run)`,
    `- Bot gas price: ${botGas} gwei (higher = mines first)`,
    `- Bot swapped BEFORE victim, moving the price up`,
    `- Victim expected: ${ethers.formatEther(expected)} Token B`,
    `- Victim actually got: ${ethers.formatEther(actual)} Token B`,
    `- Victim lost: ${ethers.formatEther(expected - actual)} Token B due to price impact`,
    "",
    "In exactly 3 short sentences explain:",
    "1. Why the victim got less tokens than expected (price impact, not gas)",
    "2. How the bot extracted value by moving the price",
    "3. One specific technical way the victim could have prevented this"
  ].join("\n");

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      max_tokens: 200,
      temperature: 0.7
    });
    const text = chatCompletion.choices[0]?.message?.content?.trim();
    if (text) return "🤖 AI-POWERED ATTACK ANALYSIS:\n" + text;
  } catch (err) {
    console.error("AI call failed:", err.message);
  }
  return null;
}

// ─── Static fallback ──────────────────────────────────────────────
function staticExplanation(amountIn, victimGas, botGas, expected, actual) {
  const vGas = parseFloat(ethers.formatUnits(victimGas, "gwei"));
  const bGas = parseFloat(ethers.formatUnits(botGas, "gwei"));
  const loss = expected - actual;
  const lossPct = expected > 0n
    ? (Number(loss * 10000n / expected) / 100).toFixed(2)
    : "0";
  return [
    "🔍 MEV Sandwich Attack Analysis:",
    `• Victim swapped ${amountIn} Token A at ${vGas.toFixed(1)} gwei.`,
    `• Bot front-ran with ${bGas.toFixed(1)} gwei.`,
    `• Expected output: ${ethers.formatEther(expected)} Token B`,
    `• Actual output:   ${ethers.formatEther(actual)} Token B`,
    `• Loss:            ${ethers.formatEther(loss)} Token B (${lossPct}%)`,
    "",
    "🛡️ How to protect yourself:",
    "• Set a slippage tolerance of max 1-2%.",
    "• Use Flashbots / MEV-Blocker to submit privately.",
    "• Use a higher gas price to reduce front-run window."
  ].join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const wsProvider = new ethers.WebSocketProvider(process.env.SEPOLIA_RPC_WSS);
  const httpProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_HTTP);
  const bot = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, httpProvider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, bot);

  console.log("🚀 MEV Protection Analyzer Live");
  console.log("🤖 Bot:", bot.address);
  console.log("📊 Dashboard server running on ws://localhost:3001");
  console.log("👀 Listening for vulnerable swaps...\n");

  // fund bot if needed
  let bal = await contract.tokenA(bot.address);
  if (bal < ethers.parseEther("1")) {
    await (await contract.getTokens()).wait();
    console.log("✅ Bot funded.\n");
  }

  wsProvider.on("pending", async (txHash) => {
    try {
      const tx = await wsProvider.getTransaction(txHash);
      if (!tx || !tx.to) return;
      if (tx.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) return;
      if (tx.from.toLowerCase() === bot.address.toLowerCase()) return;

      const iface = new ethers.Interface(ABI);
      let decoded;
      try {
        decoded = iface.parseTransaction({ data: tx.data });
      } catch { return; }
      if (!decoded || decoded.name !== "swap") return;

      const victimAddr = tx.from;
      const amountIn = decoded.args[0];

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🎯 VICTIM SWAP DETECTED!");
      console.log("📝 Tx:", txHash);
      console.log("💸 Amount:", ethers.formatEther(amountIn), "Token A");

      // send to dashboard
      sendToDashboard({
        type: "detected",
        amountIn: ethers.formatEther(amountIn),
        txHash
      });

      // ensure bot has tokens
      let botBal = await contract.tokenA(bot.address);
      if (botBal < amountIn) {
        await (await contract.getTokens()).wait();
      }

      // record state before attack
      const victimB_Before = await contract.tokenB(victimAddr);
      const reserveA_before = await contract.reserveA();
      const reserveB_before = await contract.reserveB();
      const expectedOut = amountIn * reserveB_before / reserveA_before;

      // fire front-run
      const botGasPrice = tx.gasPrice * 2n;
      console.log("\n🔴 FRONT-RUN FIRING! Bot paying", ethers.formatUnits(botGasPrice, "gwei"), "gwei");

      sendToDashboard({
        type: "frontrun",
        botGas: ethers.formatUnits(botGasPrice, "gwei")
      });

      const frontTx = await contract.swap(amountIn, { gasPrice: botGasPrice });
      console.log("📡 Bot tx:", frontTx.hash);
      console.log("🔗 https://sepolia.etherscan.io/tx/" + frontTx.hash);
      await frontTx.wait();
      console.log("✅ Front-run confirmed");

      // wait for victim tx
      const victimRec = await httpProvider.waitForTransaction(txHash);
      console.log("🎯 Victim confirmed in block", victimRec.blockNumber);
      console.log("🔗 https://sepolia.etherscan.io/tx/" + txHash);
      console.log("🔗 https://sepolia.etherscan.io/block/" + victimRec.blockNumber);

      // calculate loss
      const victimB_After = await contract.tokenB(victimAddr);
      const actualOut = victimB_After - victimB_Before;
      const loss = expectedOut - actualOut;

      console.log("\n📊 ATTACK ANALYSIS");
      console.log("💰 Expected:", ethers.formatEther(expectedOut), "Token B");
      console.log("📉 Actual:  ", ethers.formatEther(actualOut), "Token B");
      console.log("💸 Loss:    ", ethers.formatEther(loss), "Token B");

      // get AI analysis
      const aiText = await aiExplanation(
        ethers.formatEther(amountIn),
        ethers.formatUnits(tx.gasPrice, "gwei"),
        ethers.formatUnits(botGasPrice, "gwei"),
        expectedOut,
        actualOut,
        victimRec.blockNumber
      );

      const finalReport = aiText
        ? "\n" + aiText
        : "\n" + staticExplanation(
            ethers.formatEther(amountIn),
            tx.gasPrice,
            botGasPrice,
            expectedOut,
            actualOut
          );

      console.log(finalReport);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // send full attack data to dashboard
      sendToDashboard({
        type: "confirmed",
        amountIn: ethers.formatEther(amountIn),
        victimGas: ethers.formatUnits(tx.gasPrice, "gwei"),
        botGas: ethers.formatUnits(botGasPrice, "gwei"),
        expected: ethers.formatEther(expectedOut),
        actual: ethers.formatEther(actualOut),
        loss: ethers.formatEther(loss),
        block: victimRec.blockNumber,
        victimTx: txHash,
        botTx: frontTx.hash,
        aiAnalysis: aiText
          ? aiText.replace("🤖 AI-POWERED ATTACK ANALYSIS:\n", "")
          : staticExplanation(
              ethers.formatEther(amountIn),
              tx.gasPrice,
              botGasPrice,
              expectedOut,
              actualOut
            )
      });

    } catch (err) {
      console.error("⚠️ Error:", err.message);
    }
  });
}

main().catch(console.error);