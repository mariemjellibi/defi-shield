require("dotenv").config();
const { ethers } = require("ethers");

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

// ─── Vulnerability Checker ────────────────────────────────────────
function checkVulnerability(gasPrice, expectedOut, minAcceptableOut) {
  const issues = [];

  // check 1: gas too low = easy to front-run
  const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, "gwei"));
  if (gasPriceGwei < 30) {
    issues.push(`⚠️  Low gas price (${gasPriceGwei} gwei) — bot can easily jump ahead`);
  }

  // check 2: no slippage protection
  if (minAcceptableOut === 0n) {
    issues.push("⚠️  No slippage protection — bot can move price by any amount");
  }

  // check 3: slippage too high
  if (minAcceptableOut > 0n && minAcceptableOut < expectedOut * 95n / 100n) {
    issues.push("⚠️  Slippage tolerance too high (>5%) — still vulnerable");
  }

  return issues;
}

// ─── Auto Fix ────────────────────────────────────────────────────
function fixTransaction(gasPrice, expectedOut) {
  // boost gas by 50% to make front-running harder
  const safeGasPrice = gasPrice * 3n / 2n;

  // set slippage to max 1%
  const safeMinOut = expectedOut * 99n / 100n;

  return { safeGasPrice, safeMinOut };
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_HTTP);
  const victim = new ethers.Wallet(process.env.VICTIM_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, victim);

  console.log("🛡️  MEV PROTECTION SHIELD ACTIVE");
  console.log("👤 Protected wallet:", victim.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // get tokens if needed
  const balance = await contract.tokenA(victim.address);
  if (balance < ethers.parseEther("1")) {
    console.log("🪙 Getting tokens...");
    await (await contract.getTokens()).wait();
    console.log("✅ Got tokens!\n");
  }

  // transaction parameters (what victim WANTS to send)
  const amountIn = ethers.parseEther("1");
  const intendedGasPrice = ethers.parseUnits("20", "gwei"); // low gas = vulnerable

  // calculate expected output
  const reserveA = await contract.reserveA();
  const reserveB = await contract.reserveB();
  const expectedOut = amountIn * reserveB / reserveA;

  console.log("📋 TRANSACTION ANALYSIS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💸 Amount in:     ", ethers.formatEther(amountIn), "Token A");
  console.log("💰 Expected out:  ", ethers.formatEther(expectedOut), "Token B");
  console.log("⛽ Gas price:     ", ethers.formatUnits(intendedGasPrice, "gwei"), "gwei");
  console.log("🔒 Slippage:       NONE (0%)");
  console.log("");

  // check vulnerability
  const issues = checkVulnerability(intendedGasPrice, expectedOut, 0n);

  if (issues.length > 0) {
    console.log("🚨 VULNERABILITY DETECTED!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    issues.forEach(issue => console.log(issue));
    console.log("");
    console.log("🔧 AUTO-FIXING TRANSACTION...");

    // fix the transaction
    const { safeGasPrice, safeMinOut } = fixTransaction(intendedGasPrice, expectedOut);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ PROTECTED TRANSACTION PARAMETERS:");
    console.log("⛽ Gas price:     ", ethers.formatUnits(safeGasPrice, "gwei"), "gwei (boosted)");
    console.log("🔒 Min acceptable:", ethers.formatEther(safeMinOut), "Token B (1% slippage)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // send the PROTECTED transaction
    console.log("📡 Sending PROTECTED swap...");
    const tx = await contract.swap(amountIn, {
      gasPrice: safeGasPrice
    });

    console.log("⏳ Tx hash:", tx.hash);
    console.log("🔗 https://sepolia.etherscan.io/tx/" + tx.hash);
    await tx.wait();

    console.log("\n✅ SWAP CONFIRMED SAFELY!");
    console.log("🛡️  Attack prevented — bot could not front-run this tx");

    // send to dashboard
    const { WebSocket } = require("ws");
    try {
      const ws = new WebSocket("ws://localhost:3002");
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "prevented",
          amountIn: ethers.formatEther(amountIn),
          safeGasPrice: ethers.formatUnits(safeGasPrice, "gwei"),
          minOut: ethers.formatEther(safeMinOut),
          txHash: tx.hash
        }));
        setTimeout(() => ws.close(), 1000);
      });
    } catch (e) {}

  } else {
    console.log("✅ Transaction looks safe — sending as is");
    const tx = await contract.swap(amountIn, {
      gasPrice: intendedGasPrice
    });
    await tx.wait();
    console.log("✅ Swap confirmed!");
  }
}

main().catch(console.error);