# Quick Start Guide - Executor Contracts

## 🚀 Fastest Way to Get Started

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd abt-un

# Install dependencies
npm install --legacy-peer-deps
```

### 2. Configuration

```bash
# Copy configuration template
cp scripts/deployment/executor-config.template.js scripts/deployment/executor-config.js

# Edit configuration (use your favorite editor)
nano scripts/deployment/executor-config.js
```

**Minimal Configuration Required:**
- Network RPC URL in `hardhat.config.js`
- Private key for deployment
- Treasury address (or defaults to deployer)

### 3. Deployment

```bash
# Deploy to local hardhat network (for testing)
npx hardhat run scripts/deployment/deploy-executors.js --network localhost

# Deploy to testnet (e.g., Goerli)
npx hardhat run scripts/deployment/deploy-executors.js --network goerli

# Deploy to mainnet (after thorough testing!)
npx hardhat run scripts/deployment/deploy-executors.js --network mainnet
```

### 4. Post-Deployment Setup

After deployment, you'll get addresses like:
```
FlashLoanExecutor: 0x1234...
ArbitrageExecutor: 0x5678...
MEVProtectedExecutor: 0x9abc...
```

**Configure the contracts:**

```javascript
const { ethers } = require("hardhat");

async function configure() {
  const [owner] = await ethers.getSigners();
  
  // Get deployed contracts
  const flashLoanExecutor = await ethers.getContractAt("FlashLoanExecutor", "0x1234...");
  const arbitrageExecutor = await ethers.getContractAt("ArbitrageExecutor", "0x5678...");
  const mevProtectedExecutor = await ethers.getContractAt("MEVProtectedExecutor", "0x9abc...");
  
  // Add operators (your bot addresses)
  await flashLoanExecutor.addOperator("0xYourBotAddress");
  await arbitrageExecutor.addOperator("0xYourBotAddress");
  await mevProtectedExecutor.addOperator("0xYourBotAddress");
  
  // Authorize MEV relays
  await mevProtectedExecutor.setRelayAuthorization("0xFlashbotsRelayAddress", true);
  
  console.log("Configuration complete!");
}

configure();
```

---

## 💡 Usage Examples

### Example 1: Execute Flash Loan (Aave V3)

```javascript
const flashLoanParams = {
  protocol: 0, // Protocol.AAVE_V3
  assets: ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], // WETH
  amounts: [ethers.parseEther("10")],
  userData: "0x", // Custom data for your arbitrage logic
  initiator: botAddress
};

const tx = await flashLoanExecutor.executeFlashLoan(flashLoanParams);
await tx.wait();
console.log("Flash loan executed!");
```

### Example 2: Execute Simple Arbitrage

```javascript
const route = {
  hops: [
    {
      dexType: 0, // UNISWAP_V2
      router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      tokenIn: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      tokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      fee: 0,
      extraData: "0x"
    },
    {
      dexType: 2, // SUSHISWAP
      router: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
      tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      fee: 0,
      extraData: "0x"
    }
  ],
  amountIn: ethers.parseEther("1"),
  minAmountOut: ethers.parseEther("1.01"), // Expect 1% profit
  deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
  recipient: botAddress
};

const result = await arbitrageExecutor.executeArbitrage(route);
console.log("Arbitrage executed, profit:", result.profit.toString());
```

### Example 3: Submit MEV-Protected Bundle

```javascript
// Prepare arbitrage transaction
const arbTx = await arbitrageExecutor.populateTransaction.executeArbitrage(route);

const bundleTxs = [{
  target: arbitrageExecutor.address,
  data: arbTx.data,
  value: 0,
  gasLimit: 500000,
  maxPriorityFee: ethers.parseUnits("2", "gwei"),
  maxFeePerGas: ethers.parseUnits("100", "gwei")
}];

const targetBlock = await ethers.provider.getBlockNumber() + 2;

const bundleId = await mevProtectedExecutor.submitBundle(
  bundleTxs,
  targetBlock,
  0 // ProtectionStrategy.FLASHBOTS
);

console.log("Bundle submitted:", bundleId.toString());
```

---

## 🔧 Common Operations

### Check Contract Status

```javascript
// Check if contracts are paused
const isPausedFlashLoan = await flashLoanExecutor.paused();
const isPausedArbitrage = await arbitrageExecutor.paused();
const isPausedMEV = await mevProtectedExecutor.paused();

// Check if emergency stop is active
const emergencyStoppedFlashLoan = await flashLoanExecutor.emergencyStopped();
const emergencyStoppedArbitrage = await arbitrageExecutor.emergencyStopped();

// Check kill switch status
const killSwitchActive = await mevProtectedExecutor.killSwitchActivated();

console.log("Status:", {
  flashLoan: { paused: isPausedFlashLoan, emergencyStopped: emergencyStoppedFlashLoan },
  arbitrage: { paused: isPausedArbitrage, emergencyStopped: emergencyStoppedArbitrage },
  mev: { paused: isPausedMEV, killSwitch: killSwitchActive }
});
```

### Emergency Operations

```javascript
// Pause a contract
await flashLoanExecutor.pause();

// Unpause a contract
await flashLoanExecutor.unpause();

// Emergency token rescue (when paused)
await flashLoanExecutor.emergencyWithdraw(
  "0xTokenAddress",
  ethers.parseEther("10"),
  "0xRecipientAddress"
);

// Activate circuit breaker (MEV contract)
// This happens automatically on repeated failures, but can be reset:
await mevProtectedExecutor.resetCircuitBreaker();

// Activate kill switch (complete shutdown)
await mevProtectedExecutor.activateKillSwitch();
```

### Monitor Events

```javascript
// Listen for arbitrage execution events
arbitrageExecutor.on("ArbitrageExecuted", (executor, tokenIn, tokenOut, amountIn, amountOut, profit, gasUsed) => {
  console.log("Arbitrage executed!");
  console.log("Executor:", executor);
  console.log("Profit:", ethers.formatEther(profit), "tokens");
  console.log("Gas used:", gasUsed.toString());
});

// Listen for flash loan events
flashLoanExecutor.on("FlashLoanExecuted", (protocol, initiator, assets, amounts, premiums, success) => {
  console.log("Flash loan executed!");
  console.log("Protocol:", protocol);
  console.log("Success:", success);
  console.log("Amounts:", amounts.map(a => ethers.formatEther(a)));
});

// Listen for MEV bundle events
mevProtectedExecutor.on("BundleSubmitted", (bundleId, submitter, targetBlock, strategy, txCount) => {
  console.log("Bundle submitted!");
  console.log("Bundle ID:", bundleId.toString());
  console.log("Target block:", targetBlock.toString());
  console.log("Transaction count:", txCount.toString());
});
```

---

## 🛡️ Security Checklist

Before going live:

- [ ] All contracts deployed and verified on Etherscan
- [ ] Owner transferred to multisig wallet
- [ ] Operators configured with bot addresses only
- [ ] Slippage limits set appropriately
- [ ] Circuit breaker parameters configured
- [ ] MEV relays authorized
- [ ] Treasury address set to secure wallet
- [ ] Emergency contacts configured
- [ ] Monitoring and alerting set up
- [ ] Small test transactions executed successfully
- [ ] Gas limits tested under various network conditions

---

## 📊 Gas Costs (Approximate)

| Operation | Estimated Gas | At 50 gwei | At 100 gwei |
|-----------|---------------|------------|-------------|
| Deploy FlashLoanExecutor | ~2,500,000 | ~0.125 ETH | ~0.25 ETH |
| Deploy ArbitrageExecutor | ~3,000,000 | ~0.15 ETH | ~0.3 ETH |
| Deploy MEVProtectedExecutor | ~3,500,000 | ~0.175 ETH | ~0.35 ETH |
| Execute Flash Loan | ~300,000 | ~0.015 ETH | ~0.03 ETH |
| Execute Simple Arbitrage | ~250,000 | ~0.0125 ETH | ~0.025 ETH |
| Submit MEV Bundle | ~150,000 | ~0.0075 ETH | ~0.015 ETH |

*Note: Gas costs vary based on network conditions and transaction complexity*

---

## 🐛 Troubleshooting

### Common Issues

**Problem:** Contract deployment fails
- Check you have enough ETH for gas
- Verify network configuration in hardhat.config.js
- Ensure dependencies are installed

**Problem:** "Unauthorized" error
- Check you're calling from an operator address
- Use `addOperator()` to authorize addresses

**Problem:** "Circuit breaker tripped"
- Wait for cooldown period (30 minutes default)
- Or manually reset: `mevProtectedExecutor.resetCircuitBreaker()`

**Problem:** "Slippage too high"
- Increase `maxSlippageBps` in route
- Check pool liquidity
- Reduce trade size

**Problem:** Flash loan fails to repay
- Ensure arbitrage is profitable enough to cover fees
- Check token approvals
- Verify swap routes are correct

---

## 📚 Additional Resources

- **Full Documentation:** `EXECUTOR_CONTRACTS_README.md`
- **Implementation Details:** `IMPLEMENTATION_CHECKLIST.md`
- **Deployment Scripts:** `scripts/deployment/`
- **Configuration Template:** `scripts/deployment/executor-config.template.js`
- **Contract Source:** `contracts/*.sol`

---

## 🆘 Support

If you encounter issues:
1. Check the logs and error messages
2. Review the documentation
3. Test on testnet first
4. Start with small amounts
5. Open an issue on GitHub

**Remember:** These contracts handle real value. Always test thoroughly before mainnet deployment!
