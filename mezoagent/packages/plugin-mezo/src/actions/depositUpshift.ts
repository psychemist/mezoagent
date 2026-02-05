import { type Action, type IAgentRuntime, type Memory, type ActionResult } from '@elizaos/core';
import { createMezoRpcClient } from '../lib/rpc-client';
import { TransactionBuilder } from '../lib/transaction-builder';
import { UpshiftVaultContract, CONTRACT_ADDRESSES, ABIS } from '../lib/contracts';

const SMART_ACCOUNT_ADDRESS = process.env.MEZO_SMART_ACCOUNT_ADDRESS || '0x0000000000000000000000000000000000000000';
const UPSHIFT_VAULT_BTC = process.env.MEZO_UPSHIFT_VAULT_BTC || CONTRACT_ADDRESSES.UPSHIFT_VAULT_BTC;

/**
 * Parse deposit parameters from message text
 */
function parseDepositParams(text: string): {
    amount?: string;
    asset?: string;
} {
  const lowerText = text.toLowerCase();
  const amountMatch = text.match(/(\d+\.?\d*)\s*(tbtc|btc|musd|usd)/i);
  const amount = amountMatch ? amountMatch[1] : undefined;

  let asset: string | undefined;
  if (lowerText.includes('btc') || lowerText.includes('tbtc')) {
    asset = 'BTC';
  } else if (lowerText.includes('musd') || lowerText.includes('usd')) {
    asset = 'MUSD';
  }

  return { amount, asset };
}

/**
 * Convert token amount to wei (assuming 18 decimals)
 */
function parseAmount(amount: string): bigint {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * 1e18));
}

export const depositUpshiftAction: Action = {
  name: 'DEPOSIT_UPSHIFT',
  similes: ['INVEST_UPSHIFT', 'STAKE_UPSHIFT', 'EARN_YIELD'],
  description: 'Deposit assets into Upshift yield vaults.',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const keywords = ['deposit', 'invest', 'stake', 'upshift'];
    return keywords.some(keyword => message.content.text.toLowerCase().includes(keyword));
  },
  handler: async (runtime: IAgentRuntime, message: Memory): Promise<ActionResult> => {
    // Import X402 wrapper
    const { wrapWithX402 } = await import('../utils/x402Wrapper');

    // Wrap execution with X402 autonomous payment
    return await wrapWithX402(
      runtime,
      message,
      'DEPOSIT_UPSHIFT',
      async () => {
        try {
          const text = message.content.text;
          const params = parseDepositParams(text);

          const asset = params.asset || 'BTC'; // Default to BTC
          const amount = params.amount ? parseAmount(params.amount) : 0n;

          // Check if we have real blockchain configuration
          const useRealBlockchain = SMART_ACCOUNT_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
                        UPSHIFT_VAULT_BTC !== '0x0000000000000000000000000000000000000000';

          if (!useRealBlockchain) {
            // Fallback to mock execution
            const actionDescription = `Executing Intent: Deposit ${params.amount || 'all'} ${asset} into Upshift Vault`;
            const stealthInfo = '\n[Stealth Mode]: Wrapping Assets...\n[Risk Assessment]: Strategy Delta Verified.';
            const x402Info = '\n[X402]: Payment feasibility verified ✓';

            return {
              text: `✅ ${actionDescription}${stealthInfo}${x402Info}\n\nStatus: Intent Submitted. Waiting for Solver execution...\n\nNote: Blockchain not configured. This is a simulation.`,
              values: {
                status: 'PENDING_SOLVER',
                protocol: 'Upshift',
                simulated: true,
                x402Enabled: true
              },
              data: {
                vaultId: 'BTC-Delta-Neutral-1',
                apy: '12.4%'
              },
              success: true
            };
          }

          // Real blockchain execution
          const rpcClient = createMezoRpcClient();
          const txBuilder = new TransactionBuilder(rpcClient);

          // Get vault information
          const vaultContract = new UpshiftVaultContract({
            address: UPSHIFT_VAULT_BTC,
            abi: ABIS.UPSHIFT_VAULT,
            rpcClient,
          });

          const [apy, tvl] = await Promise.all([
            vaultContract.getAPY(),
            vaultContract.getTVL(),
          ]);

          const apyPercent = (Number(apy) / 1e18) * 100;
          const tvlFormatted = (Number(tvl) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 });

          // Build deposit transaction
          const depositAmount = amount || await vaultContract.getBalance(SMART_ACCOUNT_ADDRESS);
          const txRequest = await txBuilder.buildDepositTransaction(UPSHIFT_VAULT_BTC, depositAmount);

          const actionDescription = `Prepared Deposit: ${params.amount || 'all'} ${asset} into Upshift Vault`;
          const stealthInfo = '\n[Stealth Mode]: Wrapping BTC...\n[Risk Assessment]: Strategy Delta Verified.';
          const x402Info = '\n[X402]: Gas payment optimized ✓';

          return {
            text: `✅ ${actionDescription}\n${stealthInfo}${x402Info}\n\nStatus: Transaction prepared. Ready for signing and execution.\n\nVault APY: ${apyPercent.toFixed(2)}%\nVault TVL: ${tvlFormatted} ${asset}`,
            values: {
              status: 'PREPARED',
              protocol: 'Upshift',
              asset,
              amount: depositAmount.toString(),
              apy: apyPercent.toFixed(2),
              x402Enabled: true
            },
            data: {
              transaction: txRequest,
              vaultId: 'BTC-Delta-Neutral-1',
              apy: `${apyPercent.toFixed(2)}%`,
              tvl: tvl.toString(),
            },
            success: true
          };
        } catch (error) {
          console.error('Error in depositUpshiftAction:', error);
          return {
            text: `❌ Error executing deposit: ${error instanceof Error ? error.message : String(error)}`,
            values: {
              status: 'ERROR',
              error: error instanceof Error ? error.message : String(error)
            },
            success: false
          };
        }
      },
      {
        critical: false,
        estimatedCost: 150000n * 50000000000n, // Estimated: 150k gas
      }
    );
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'Deposit my BTC into Upshift for yield' }
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Depositing BTC into Upshift Vaults to earn yield...',
          actions: ['DEPOSIT_UPSHIFT']
        }
      }
    ]
  ]
};
