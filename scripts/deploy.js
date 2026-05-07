const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SimpleSwap...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwap.deploy();
  await simpleSwap.waitForDeployment();

  const address = await simpleSwap.getAddress();
  console.log("✅ SimpleSwap deployed to:", address);
  console.log("📋 Copy this address — you need it!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});