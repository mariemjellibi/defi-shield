# ⚡ DeFi Shield — MEV Sandwich Attack Analyzer

> AI-powered tool that detects, executes, and explains MEV sandwich attacks on Ethereum in real time.

![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-627EEA?style=flat&logo=ethereum)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=flat&logo=solidity)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=nodedotjs)
![AI](https://img.shields.io/badge/AI-Llama3_via_Groq-FF6B35?style=flat)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

---

## 🎯 What is an MEV Sandwich Attack?

Every time you swap tokens on Uniswap or any DEX, your transaction sits in a **public waiting room** called the mempool before it confirms.

MEV bots watch this waiting room 24/7.

When they spot your swap they:
1. **Jump ahead** of you with a higher gas fee
2. **Move the price** against you before your swap confirms
3. **Sell immediately** after — pocketing the difference

You receive fewer tokens than expected. You never know why.

This extracts **$1,000,000+ from regular users every single day**.

---

## 🔨 What This Project Does

| Feature | Description |
|---------|-------------|
| 🔴 Live mempool monitoring | Watches all pending Ethereum transactions via WebSocket |
| 🎯 Attack detection | Decodes raw transaction data to identify vulnerable swaps |
| ⚡ Sandwich execution | Fires front-run transactions automatically at double gas price |
| 📊 Loss calculation | Calculates exact token loss down to 6 decimal places |
| 🤖 AI analysis | Uses Llama 3 via Groq to explain every attack in plain English |
| 🔗 Etherscan proof | Generates clickable links to verify every transaction on chain |
| 🛡️ Protection mode | Intercepts vulnerable transactions and fixes them automatically |
| 📺 Live dashboard | Real time web UI showing attacks as they happen |

---

## 🖥️ Demo

The demo shows a real sandwich attack on Sepolia testnet:

```
00:01 — Victim sends swap at 20 gwei
00:02 — Bot detects it in the mempool
00:03 — Bot fires front-run at 40 gwei
00:14 — Attack confirmed on chain
00:14 — Victim receives fewer tokens than expected
00:15 — AI explains exactly what happened
```

Every transaction is real and verifiable on Sepolia Etherscan.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    DEFI SHIELD                      │
├──────────────┬──────────────┬───────────────────────┤
│  SimpleSwap  │   bot.js     │     server.js         │
│  .sol        │              │                       │
│              │  WebSocket   │  Express API          │
│  Vulnerable  │  mempool     │  SSE streaming        │
│  DEX on      │  listener    │  to dashboard         │
│  Sepolia     │              │                       │
│              │  Detects +   │  Serves web UI        │
│              │  Executes    │  Triggers victim      │
│              │  attacks     │  Scan wallet API      │
├──────────────┴──────────────┴───────────────────────┤
│                  Groq AI (Llama 3)                  │
│            Explains every attack                    │
├─────────────────────────────────────────────────────┤
│              Live Web Dashboard                     │
│   Dark terminal UI — updates in real time           │
└─────────────────────────────────────────────────────┘
```

---

## ⚙️ Tech Stack

- **Solidity 0.8.20** — Vulnerable DEX smart contract
- **Hardhat** — Contract compilation and deployment
- **Ethers.js v6** — Mempool monitoring via WebSocket
- **Node.js + Express** — Backend server
- **Groq API + Llama 3** — AI attack analysis
- **WebSocket (ws)** — Real time bot ↔ dashboard communication
- **Vanilla JS** — Live terminal dashboard
- **Sepolia testnet** — All transactions are real and verifiable

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MetaMask with 2 Sepolia accounts
- Free [Alchemy](https://alchemy.com) account
- Free [Groq](https://groq.com) API key

### Installation

```bash
git clone https://github.com/yourusername/defi-shield
cd defi-shield
npm install
```

### Environment Setup

Create a `.env` file:

```env
SEPOLIA_RPC_HTTP=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
SEPOLIA_RPC_WSS=wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
BOT_PRIVATE_KEY=your_bot_wallet_private_key
VICTIM_PRIVATE_KEY=your_victim_wallet_private_key
GROQ_API_KEY=your_groq_api_key
```

> ⚠️ Never share your private keys. Never commit `.env` to GitHub.

### Deploy the Contract

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Save the contract address and update `CONTRACT_ADDRESS` in `scripts/bot.js`, `scripts/victim.js`, and `scripts/protect.js`.

---

## 🎮 Running the Project

**Terminal 1 — Start the bot:**
```bash
node scripts/bot.js
```

**Terminal 2 — Start the website:**
```bash
node server.js
```

**Browser — Open the dashboard:**
```
http://localhost:3000
```

**Watch a live attack:**
```
http://localhost:3000/demo
```

---

## 📁 Project Structure

```
defi-shield/
├── contracts/
│   └── SimpleSwap.sol      ← vulnerable DEX contract
├── scripts/
│   ├── deploy.js           ← deploys contract to Sepolia
│   ├── bot.js              ← mempool watcher + attack engine
│   ├── victim.js           ← simulates vulnerable user
│   └── protect.js          ← protection mode
├── public/
│   ├── index.html          ← landing page
│   ├── results.html        ← wallet scan results
│   ├── demo.html           ← live attack demo
│   └── style.css           ← dark terminal UI
├── analyzer.js             ← MEV detection logic
├── server.js               ← Express backend
├── dashboard.html          ← real time attack dashboard
├── .env.example            ← environment template
└── README.md
```

---

## 🛡️ Protection Mode

Run `protect.js` to see how the attack is prevented:

```bash
node scripts/protect.js
```

It automatically detects:
- Gas price too low (easy to front-run)
- No slippage protection set

And fixes both before sending the transaction safely.

---

## 🔒 Security Notice

- This tool is built for **educational purposes** on a testnet
- All transactions use **fake Sepolia ETH** with no real value
- Never use private keys with real funds in any script
- This tool only reads **public blockchain data**

---

## 💡 How to Protect Yourself

1. **Set slippage tolerance** to max 1-2% on every DEX swap
2. **Use MEV Blocker** — add `https://rpc.mevblocker.io` to MetaMask
3. **Never use 0 slippage** on any transaction
4. **Verify full addresses** before sending any transaction
5. **Never interact** with random tokens that appear in your wallet

---

## 📄 License

MIT — feel free to use, modify, and share.

---

## 👤 Author

Built by [Your Name] — blockchain security enthusiast.

Connect on [LinkedIn](https://linkedin.com/in/yourprofile)

---

> *"You have been swimming in shark-infested waters. Now you know the sharks exist."*
