import { Plugin } from '@elizaos/core';
import { swapTigrisAction } from './actions/swapTigris';
import { depositUpshiftAction } from './actions/depositUpshift';
import { autonomousPaymentAction } from './actions/autonomousPayment';
import { optimizeGasAction } from './actions/optimizeGas';
import { walletProvider } from './providers/wallet';
import { marketProvider } from './providers/market';
import { x402Provider } from './providers/x402Provider';
import { treasuryProvider } from './providers/treasuryProvider';
import { riskEvaluator } from './evaluators/risk';
import { paymentEvaluator } from './evaluators/paymentEvaluator';
import { treasuryHealthEvaluator } from './evaluators/treasuryHealthEvaluator';

export const mezoPlugin: Plugin = {
  name: 'mezo',
  description: 'Mezo Stealth Agent integration for autonomous finance with X402 self-autonomous payment',
  actions: [
    swapTigrisAction,
    depositUpshiftAction,
    autonomousPaymentAction,
    optimizeGasAction
  ],
  evaluators: [
    riskEvaluator,
    paymentEvaluator,
    treasuryHealthEvaluator
  ],
  providers: [
    walletProvider,
    marketProvider,
    x402Provider,
    treasuryProvider
  ],
};

export default mezoPlugin;

// Export X402 utilities for external use
export { x402Utils } from './providers/x402Provider';
export {
  recordSpending,
  harvestYields,
  autoRefund,
  rebalanceTreasury,
  monitorHealth
} from './providers/treasuryProvider';
export {
  recordOperationResult,
  incrementRateLimit,
  canAffordOperation
} from './evaluators/paymentEvaluator';
export { wrapWithAutonomousPayment } from './actions/autonomousPayment';
export { gasOptimizationUtils } from './actions/optimizeGas';
export { treasuryHealthUtils } from './evaluators/treasuryHealthEvaluator';
export * from './utils/userOpBuilder';
export * from './utils/paymasterClient';
export * from './types/x402';
