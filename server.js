require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const Groq     = require("groq-sdk");
const path     = require("path");
const { detectSandwich } = require("./analyzer");
const { exec }  = require("child_process");
const { WebSocket } = require("ws");

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const ETHERSCAN_API = "https://api-sepolia.etherscan.io/api";

// ─── store demo SSE clients ───────────────────────────────────────
let demoClients = [];

function sendToDemo(msg) {
  demoClients.forEach(res => {
    try {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    } catch (e) {}
  });
}

// ─── connect to bot WebSocket and forward to demo page ───────────
function connectToBotWS() {
  const ws = new WebSocket("ws://localhost:3001");

  ws.on("open", () => {
    console.log("✅ Server connected to bot WebSocket");
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === "detected") {
        sendToDemo({ type: "log", message: `🎯 VICTIM SWAP DETECTED! Amount: ${msg.amountIn} Token A` });
        sendToDemo({ type: "log", message: `📝 Tx: ${msg.txHash}` });
        sendToDemo({ type: "log", message: `🔗 https://sepolia.etherscan.io/tx/${msg.txHash}` });
      }

      if (msg.type === "frontrun") {
        sendToDemo({ type: "log", message: `🔴 FRONT-RUN FIRING! Bot gas: ${msg.botGas} gwei` });
      }

      if (msg.type === "confirmed") {
        sendToDemo({ type: "log", message: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
        sendToDemo({ type: "log", message: `✅ Attack confirmed in block #${msg.block}` });
        sendToDemo({ type: "log", message: `💰 Expected: ${parseFloat(msg.expected).toFixed(6)} Token B` });
        sendToDemo({ type: "log", message: `📉 Actual:   ${parseFloat(msg.actual).toFixed(6)} Token B` });
        sendToDemo({ type: "log", message: `💸 Loss:     ${parseFloat(msg.loss).toFixed(6)} Token B` });
        sendToDemo({ type: "log", message: `🔗 Victim: https://sepolia.etherscan.io/tx/${msg.victimTx}` });
        sendToDemo({ type: "log", message: `🔗 Bot:    https://sepolia.etherscan.io/tx/${msg.botTx}` });
        sendToDemo({ type: "log", message: `🔗 Block:  https://sepolia.etherscan.io/block/${msg.block}` });
        if (msg.aiAnalysis) {
          sendToDemo({ type: "log", message: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
          sendToDemo({ type: "log", message: `🤖 AI ANALYSIS:` });
          sendToDemo({ type: "log", message: msg.aiAnalysis });
        }
        sendToDemo({ type: "attack", data: msg });

        // auto close demo after attack is fully shown
        setTimeout(() => {
          sendToDemo({ type: "done", message: "✅ Demo complete!" });
          demoClients = [];
        }, 3000);
      }

      if (msg.type === "prevented") {
        sendToDemo({ type: "log", message: `🛡️ ATTACK PREVENTED! Safe gas: ${msg.safeGasPrice} gwei` });
        sendToDemo({ type: "log", message: `🔗 https://sepolia.etherscan.io/tx/${msg.txHash}` });
      }

    } catch (e) {}
  });

  ws.on("close", () => {
    console.log("⚠️ Bot WebSocket disconnected — retrying in 3s...");
    setTimeout(connectToBotWS, 3000);
  });

  ws.on("error", () => {
    setTimeout(connectToBotWS, 3000);
  });
}

// connect to bot on startup
connectToBotWS();

// ─── fetch transactions for a wallet ─────────────────────────────
async function getTransactions(address) {
  try {
    const url = `${ETHERSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=YourApiKeyToken`;
    const res = await axios.get(url);
    if (res.data.status === "1") return res.data.result;
    return [];
  } catch (err) {
    console.error("Failed to fetch transactions:", err.message);
    return [];
  }
}

// ─── AI explanation ───────────────────────────────────────────────
async function explainAttack(attack) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const prompt = [
    "You are a blockchain security expert.",
    "Explain this MEV sandwich attack in 3 short sentences:",
    `- Victim transaction: ${attack.victimTx}`,
    `- Bot transaction: ${attack.botTx}`,
    `- Block: ${attack.block}`,
    `- Victim gas: ${attack.victimGas} gwei`,
    `- Bot gas: ${attack.botGas} gwei`,
    "",
    "1. Why was the victim vulnerable?",
    "2. How did the bot profit?",
    "3. How can the victim protect themselves next time?"
  ].join("\n");

  try {
    const res = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      max_tokens: 200,
      temperature: 0.7
    });
    return res.choices[0]?.message?.content?.trim();
  } catch (err) {
    return "Could not generate AI analysis at this time.";
  }
}

// ─── scan API ─────────────────────────────────────────────────────
app.post("/api/scan", async (req, res) => {
  const { address } = req.body;

  if (!address || !address.startsWith("0x")) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  console.log("🔍 Scanning wallet:", address);

  const transactions = await getTransactions(address);
  console.log(`📦 Found ${transactions.length} transactions`);

  if (transactions.length === 0) {
    return res.json({
      address,
      totalTxs: 0,
      attackCount: 0,
      attacks: [],
      message: "No transactions found for this address on Sepolia"
    });
  }

  const attacks = detectSandwich(transactions);
  console.log(`🎯 Found ${attacks.length} potential attacks`);

  for (const attack of attacks) {
    attack.aiAnalysis = await explainAttack(attack);
  }

  res.json({
    address,
    totalTxs:    transactions.length,
    attackCount: attacks.length,
    attacks
  });
});

// ─── live demo SSE ────────────────────────────────────────────────
app.get("/api/demo", (req, res) => {
  console.log("🎬 Demo client connected");

  res.writeHead(200, {
    "Content-Type":  "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection":    "keep-alive"
  });

  // add this client to list so bot events reach it
  demoClients.push(res);

  // welcome messages
  res.write(`data: ${JSON.stringify({ type: "log", message: "✅ Connected to MEV bot server" })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: "log", message: "👀 Bot is watching mempool..." })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: "log", message: "⏳ Preparing victim transaction..." })}\n\n`);

  // wait 3 seconds then trigger victim
  // this gives bot time to be fully ready
  setTimeout(() => {
    res.write(`data: ${JSON.stringify({ type: "log", message: "🎯 Sending vulnerable swap transaction..." })}\n\n`);

    const victim = exec("node scripts/victim.js");

    victim.stdout.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach(line => {
        if (
          line.trim() &&
          !line.includes("injected env") &&
          !line.includes("dotenvx") &&
          !line.includes("vestauth")
        ) {
          res.write(`data: ${JSON.stringify({ type: "log", message: "👤 " + line.trim() })}\n\n`);
        }
      });
    });

    victim.on("close", () => {
      res.write(`data: ${JSON.stringify({ type: "log", message: "⏳ Victim tx in mempool — bot is hunting it..." })}\n\n`);
    });

  }, 3000);

  // remove client if browser disconnects
  req.on("close", () => {
    demoClients = demoClients.filter(c => c !== res);
  });
});

// ─── serve pages ──────────────────────────────────────────────────
app.get("/",        (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/results", (req, res) => res.sendFile(path.join(__dirname, "public/results.html")));
app.get("/demo",    (req, res) => res.sendFile(path.join(__dirname, "public/demo.html")));

app.listen(PORT, () => {
  console.log(`🚀 DeFi Shield running at http://localhost:${PORT}`);
  console.log(`📄 Landing:  http://localhost:${PORT}/`);
  console.log(`⚡ Demo:     http://localhost:${PORT}/demo`);
  console.log(`📊 Results:  http://localhost:${PORT}/results`);
});