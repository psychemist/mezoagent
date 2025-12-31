# X402 Self-Autonomous Payment System - Quick Reference Guide

## 🎯 Overview

The X402 system enables the Mezo Agent to autonomously manage its own gas payments, treasury, and operational costs without human intervention.

---

## 🚀 Quick Start

### 1. Import the Plugin

```typescript
import { mezoPlugin } from '@elizaos/plugin-mezo';

// Add to your agent configuration
const agent = {
  plugins: [mezoPlugin],
  // ... other config
};
```

### 2. Start Treasury Monitoring

```typescript
import { treasuryHealthUtils } from '@elizaos/plugin-mezo';

// Start continuous monitoring (runs every 60 seconds)
treasuryHealthUtils.startMonitoring(runtime, config);

// Stop monitoring when needed
treasuryHealthUtils.stopMonitoring();
```

### 3. Execute Operations with Autonomous Payment

```typescript
import { autonomousPaymentAction } from '@elizaos/plugin-mezo';

// Execute any operation with automatic payment handling
const result = await autonomousPaymentAction.handler(
  runtime,
  message,
  {
    targetAction: 'swapTigris',
    params: {
      fromToken: 'MEZO',
      toToken: 'USDC',
      amount: ethers.parseEther('100'),
    },
  }
);
```

---

## 📊 Key Components

### X402 Provider
**Purpose:** Core payment logic and treasury state tracking

```typescript
import { x402Provider } from '@elizaos/plugin-mezo';

// Get treasury state
const state = await x402Provider.get(runtime, message);

// Access treasury data
console.log(state.values.treasuryHealth); // 'healthy' | 'warning' | 'critical' | 'emergency'
console.log(state.values.primaryBalance); // Current balance in wei
console.log(state.values.runwayDays); // Days until funds depleted
```

### Treasury Management
**Purpose:** Autonomous treasury maintenance

```typescript
import { 
  harvestYields, 
  autoRefund, 
  recordSpending 
} from '@elizaos/plugin-mezo';

// Harvest yields from Upshift
const harvestResult = await harvestYields(runtime);
if (harvestResult.success) {
  console.log(`Harvested ${ethers.formatEther(harvestResult.harvested)} MEZO`);
}

// Trigger auto-refund
const refundResult = await autoRefund(runtime, config);
if (refundResult.success) {
  console.log(`Refunded ${ethers.formatEther(refundResult.amount)} from ${refundResult.source}`);
}

// Record spending for burn rate calculation
recordSpending(ethers.parseEther('0.5'), 'swap');
```

### Payment Feasibility Evaluator
**Purpose:** Validate operations before execution

```typescript
import { paymentEvaluator, canAffordOperation } from '@elizaos/plugin-mezo';

// Check if operation is feasible
const canAfford = await canAffordOperation(
  runtime,
  'swap',
  { amount: ethers.parseEther('100') }
);

if (canAfford.canAfford) {
  // Execute operation
} else {
  console.log(`Cannot afford: ${canAfford.reason}`);
  console.log(`Suggested action: ${canAfford.suggestedAction}`);
}
```

### Gas Optimization
**Purpose:** Minimize transaction costs

```typescript
import { 
  gasOptimizationUtils,
  optimizeGasAction 
} from '@elizaos/plugin-mezo';

// Queue an operation for batching
gasOptimizationUtils.queueOperation({
  id: 'op_1',
  type: 'swap',
  params: { /* ... */ },
  urgency: 'normal',
  estimatedGas: 200000n,
  createdAt: Date.now(),
});

// Run optimization (batches queued operations)
await optimizeGasAction.handler(runtime, message);

// Check if operation should be delayed
const shouldDelay = await gasOptimizationUtils.shouldDelayOperation(
  operation,
  currentGasPrice
);
```

### UserOperation Builder
**Purpose:** Construct EIP-4337 UserOperations

```typescript
import { 
  buildUserOp,
  signUserOp,
  bundleOperations 
} from '@elizaos/plugin-mezo';

// Build a UserOperation
const userOp = buildUserOp({
  sender: smartAccountAddress,
  target: tigrisAddress,
  value: 0n,
  data: swapCalldata,
  usePaymaster: true,
});

// Sign it
const signedUserOp = await signUserOp(userOp, wallet, chainId);

// Bundle multiple operations
const bundled = bundleOperations([op1, op2, op3]);
```

### Paymaster Client
**Purpose:** Enable gasless transactions

```typescript
import { 
  requestSponsorship,
  compareCosts 
} from '@elizaos/plugin-mezo';

// Request gas sponsorship
const sponsorship = await requestSponsorship(userOp);

if (sponsorship.sponsored) {
  console.log('Operation will be gasless!');
  userOp.paymasterAndData = sponsorship.paymasterAndData;
}

// Compare costs
const costComparison = await compareCosts(userOp, gasPrice);
console.log(`Paymaster: ${ethers.formatEther(costComparison.paymaster)} MEZO`);
console.log(`Direct: ${ethers.formatEther(costComparison.direct)} MEZO`);
console.log(`Recommended: ${costComparison.recommended}`);
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
MEZO_RPC_URL=https://rpc.mezo.org
MEZO_PRIVATE_KEY=0x...
MEZO_SMART_ACCOUNT_ADDRESS=0x...

# Token Addresses
MEZO_TOKEN_ADDRESS=0x...
MEZO_TBTC_ADDRESS=0x...
MEZO_USDC_ADDRESS=0x...

# Contracts
MEZO_UPSHIFT_ADDRESS=0x...
MEZO_TIGRIS_ADDRESS=0x...
MEZO_ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

# Paymaster (Optional)
MEZO_PAYMASTER_ENDPOINT=https://paymaster.mezo.org
MEZO_PAYMASTER_ADDRESS=0x...

# Treasury (Optional)
MEZO_EMERGENCY_FUNDING_ADDRESS=0x...
TREASURY_ALERT_WEBHOOK=https://...
```

### X402 Config Object

```typescript
const x402Config = {
  enabled: true,
  treasury: {
    minReserve: ethers.parseEther('10'), // 10 MEZO
    warningThreshold: ethers.parseEther('20'), // 20 MEZO
    criticalThreshold: ethers.parseEther('5'), // 5 MEZO
    autoRefundEnabled: true,
    supportedTokens: ['MEZO', 'BTC', 'USDC'],
  },
  gas: {
    maxGasPrice: ethers.parseUnits('100', 'gwei'),
    optimizationEnabled: true,
    batchingEnabled: true,
    gasMultiplier: 1.2,
    priorityFee: ethers.parseUnits('2', 'gwei'),
  },
  paymaster: {
    enabled: true,
    endpoint: 'https://paymaster.mezo.org',
    fallbackToDirectPayment: true,
    preferredStrategy: 'token-based',
  },
  limits: {
    maxOperationCost: ethers.parseEther('1'), // 1 MEZO
    maxOperationsPerHour: 100,
    maxDailySpend: ethers.parseEther('50'), // 50 MEZO
  },
  funding: {
    sources: ['upshift-yields', 'external-wallet'],
    autoHarvestEnabled: true,
    harvestThreshold: ethers.parseEther('5'), // 5 MEZO
    emergencyFundingAddress: '0x...',
  },
};
```

---

## 📈 Monitoring & Alerts

### Treasury Health Status

| Status | Balance Range | Action |
|--------|---------------|--------|
| **Healthy** | ≥ Warning Threshold | Normal operations |
| **Warning** | ≥ Critical Threshold | Alert sent, monitoring increased |
| **Critical** | > 0 | Auto-refund triggered |
| **Emergency** | = 0 | Operations halted |

### Get Current Metrics

```typescript
import { treasuryHealthUtils } from '@elizaos/plugin-mezo';

// Get current metrics
const metrics = await treasuryHealthUtils.exportMetrics(runtime, config);

console.log(`Status: ${metrics.status}`);
console.log(`Balance: ${ethers.formatEther(metrics.currentBalance)} MEZO`);
console.log(`Burn Rate: ${metrics.burnRate.toFixed(4)} MEZO/day`);
console.log(`Runway: ${metrics.runwayDays.toFixed(1)} days`);
console.log(`24h Spent: ${ethers.formatEther(metrics.totalSpent24h)} MEZO`);
console.log(`24h Operations: ${metrics.operationCount24h}`);
```

### Generate Daily Report

```typescript
const report = await treasuryHealthUtils.generateDailyReport(runtime, config);
console.log(report);
```

Output:
```
📊 Daily Treasury Report
========================

Health Status: HEALTHY
Current Balance: 25.5 MEZO
Burn Rate: 0.5000 MEZO/day
Runway: 51.0 days
Utilization: 85.0%

Last 24 Hours:
- Total Spent: 0.5 MEZO
- Operations: 12
- Average Cost: 0.0417 MEZO/op

Thresholds:
- Warning: 20.0 MEZO
- Critical: 5.0 MEZO
- Min Reserve: 10.0 MEZO

Auto-Refund: ENABLED
Auto-Harvest: ENABLED
```

---

## 🛡️ Circuit Breaker

The circuit breaker prevents runaway spending by halting operations after consecutive failures.

### Configuration
- **Threshold:** 5 consecutive failures
- **Timeout:** 5 minutes (operations halted)
- **Auto-reset:** After 30 minutes

### Manual Control

```typescript
import { 
  recordFailure,
  recordSuccess,
  resetCircuitBreaker 
} from '@elizaos/plugin-mezo';

// Record operation result
if (operationSucceeded) {
  recordSuccess(); // Decreases failure count
} else {
  recordFailure(); // Increases failure count, may trip breaker
}

// Manually reset circuit breaker
resetCircuitBreaker();
```

---

## 💡 Common Patterns

### Pattern 1: Safe Operation Execution

```typescript
async function executeSafeOperation(runtime, operation) {
  // 1. Check feasibility
  const feasible = await paymentEvaluator.validate(runtime, message, {
    action: operation.type,
    params: operation.params,
  });

  if (!feasible) {
    console.log('Operation not feasible - attempting auto-refund');
    await autoRefund(runtime, config);
    return;
  }

  // 2. Execute with autonomous payment
  const result = await autonomousPaymentAction.handler(
    runtime,
    message,
    {
      targetAction: operation.type,
      params: operation.params,
    }
  );

  // 3. Record result
  if (result.success) {
    recordSuccess();
    recordSpending(result.costBreakdown.totalCost, operation.type);
  } else {
    recordFailure();
  }

  return result;
}
```

### Pattern 2: Batch Operations for Gas Savings

```typescript
async function executeBatchedOperations(runtime, operations) {
  // 1. Queue all operations
  operations.forEach(op => {
    gasOptimizationUtils.queueOperation(op);
  });

  // 2. Run optimization (batches compatible ops)
  await optimizeGasAction.handler(runtime, message);

  // 3. Get ready operations
  const currentGasPrice = await x402Utils.getCurrentGasPrice(provider);
  const ready = await gasOptimizationUtils.getReadyOperations(
    currentGasPrice,
    10 // max operations
  );

  // 4. Execute batched operations
  for (const op of ready) {
    await executeSafeOperation(runtime, op);
  }
}
```

### Pattern 3: Monitor and Auto-Maintain Treasury

```typescript
async function setupTreasuryMaintenance(runtime, config) {
  // Start continuous monitoring
  treasuryHealthUtils.startMonitoring(runtime, config);

  // Set up daily reports
  setInterval(async () => {
    const report = await treasuryHealthUtils.generateDailyReport(runtime, config);
    console.log(report);
    
    // Send to webhook, Discord, etc.
    if (process.env.TREASURY_ALERT_WEBHOOK) {
      await fetch(process.env.TREASURY_ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report }),
      });
    }
  }, 24 * 60 * 60 * 1000); // Daily
}
```

---

## 🐛 Troubleshooting

### Issue: "Circuit breaker is open"
**Solution:** Wait 5 minutes for auto-reset, or manually reset:
```typescript
import { resetCircuitBreaker } from '@elizaos/plugin-mezo';
resetCircuitBreaker();
```

### Issue: "Insufficient treasury balance"
**Solution:** Trigger auto-refund or add funds manually:
```typescript
import { autoRefund } from '@elizaos/plugin-mezo';
await autoRefund(runtime, config);
```

### Issue: "Gas price too high"
**Solution:** Queue operation for later execution:
```typescript
import { queueOperation } from '@elizaos/plugin-mezo';
queueOperation({
  id: 'op_1',
  type: 'swap',
  params: { /* ... */ },
  urgency: 'low', // Will wait for better gas prices
  estimatedGas: 200000n,
  createdAt: Date.now(),
});
```

### Issue: "Paymaster unavailable"
**Solution:** System automatically falls back to direct payment if configured:
```typescript
// Ensure fallback is enabled in config
config.paymaster.fallbackToDirectPayment = true;
```

---

## 📚 API Reference

### Providers

#### x402Provider
- `get(runtime, message, state?)` - Get treasury state and payment context

#### treasuryProvider
- `get(runtime, message, state?)` - Get treasury health metrics

### Actions

#### autonomousPaymentAction
- `handler(runtime, message, state, options, callback)` - Execute operation with autonomous payment

#### optimizeGasAction
- `handler(runtime, message, state, options, callback)` - Optimize gas costs through batching

### Evaluators

#### paymentEvaluator
- `validate(runtime, message, state?)` - Check if operation is financially feasible
- `handler(runtime, message, state?)` - Get detailed feasibility information

#### treasuryHealthEvaluator
- `validate(runtime, message, state?)` - Check if treasury is healthy
- `handler(runtime, message, state?)` - Get treasury health metrics

### Utilities

See full API documentation in each component file.

---

## 🎓 Best Practices

1. **Always check feasibility before operations**
   ```typescript
   const feasible = await paymentEvaluator.validate(runtime, message, state);
   ```

2. **Record all spending for accurate burn rate**
   ```typescript
   recordSpending(cost, operationType);
   ```

3. **Use batching for gas savings**
   ```typescript
   queueOperation(op); // Queue instead of immediate execution
   ```

4. **Monitor treasury health continuously**
   ```typescript
   treasuryHealthUtils.startMonitoring(runtime, config);
   ```

5. **Set up alerts for critical events**
   ```typescript
   process.env.TREASURY_ALERT_WEBHOOK = 'https://...';
   ```

6. **Test on testnet first**
   ```bash
   MEZO_NETWORK=testnet bun run start
   ```

---

## 🚀 Next Steps

1. Review [X402_IMPLEMENTATION_STATUS.md](./X402_IMPLEMENTATION_STATUS.md) for full implementation details
2. Configure environment variables
3. Make human decisions (see status document)
4. Update existing actions to use X402
5. Create test suite
6. Deploy to testnet
7. Monitor and iterate

---

**Need Help?** Check the implementation status document or review the source code in `src/` directory.
