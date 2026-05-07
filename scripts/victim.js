require("dotenv").config();
const { ethers } = require("ethers");

const CONTRACT_ADDRESS = "0xcb50EA7028Ccc307E3C45C7fc0cF3a5475e449cA";

const ABI = [
  "function getTokens() external",
  "function swap(uint256 amountIn) external",
  "function tokenA(address) view returns (uint256)",
  "function tokenB(address) view returns (uint256)",
  "function getPrice() view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_HTTP);
  const victim = new ethers.Wallet(process.env.VICTIM_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, victim);

  console.log("👤 Victim address:", victim.address);

  // get free tokens first
  console.log("🪙 Getting tokens...");
  const tx1 = await contract.getTokens();
  await tx1.wait();
  console.log("✅ Got tokens!");

  // check balance
  const balance = await contract.tokenA(victim.address);
  console.log("💰 Token A balance:", ethers.formatEther(balance));

  // swap — this is the vulnerable transaction the bot will attack
  console.log("🔄 Sending swap transaction...");
  const tx2 = await contract.swap(ethers.parseEther("1"), {
    gasPrice: ethers.parseUnits("20", "gwei")  // low gas = easy to front-run
  });
  
  console.log("⏳ Tx hash:", tx2.hash);
  console.log("📡 Waiting in mempool — bot should see this...");
  
  await tx2.wait();
  console.log("✅ Swap confirmed!");
}

main().catch(console.error);