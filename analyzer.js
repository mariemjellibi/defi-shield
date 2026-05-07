const { ethers } = require("ethers");

// known DEX router signatures
const SWAP_SIGNATURES = [
  "0x38ed1739", // swapExactTokensForTokens
  "0x7ff36ab5", // swapExactETHForTokens
  "0x18cbafe5", // swapExactTokensForETH
  "0xfb3bdb41", // swapETHForExactTokens
  "0x5c11d795", // swapExactTokensForTokensSupportingFeeOnTransferTokens
];

function isSwapTransaction(tx) {
  if (!tx.input || tx.input.length < 10) return false;
  const sig = tx.input.slice(0, 10).toLowerCase();
  return SWAP_SIGNATURES.includes(sig);
}

function detectSandwich(transactions) {
  const attacks = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (!isSwapTransaction(tx)) continue;

    // look at transactions in same block
    const sameBlock = transactions.filter(
      t => t.blockNumber === tx.blockNumber &&
      t.hash !== tx.hash &&
      isSwapTransaction(t)
    );

    for (const other of sameBlock) {
      const victimGas = parseFloat(tx.gasPrice);
      const otherGas  = parseFloat(other.gasPrice);

      // sandwich pattern:
      // bot gas is significantly higher than victim
      // and bot tx is from different address
      if (
        otherGas > victimGas * 1.5 &&
        other.from.toLowerCase() !== tx.from.toLowerCase()
      ) {
        attacks.push({
          victimTx:    tx.hash,
          botTx:       other.hash,
          block:       tx.blockNumber,
          victimGas:   (victimGas / 1e9).toFixed(2),
          botGas:      (otherGas  / 1e9).toFixed(2),
          victimAddr:  tx.from,
          botAddr:     other.from,
          timestamp:   new Date(parseInt(tx.timeStamp) * 1000).toISOString()
        });
        break;
      }
    }
  }

  return attacks;
}

module.exports = { detectSandwich, isSwapTransaction };