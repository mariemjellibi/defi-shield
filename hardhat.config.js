require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_HTTP,
      accounts: [
        process.env.BOT_PRIVATE_KEY,
        process.env.VICTIM_PRIVATE_KEY
      ]
    }
  }
};4