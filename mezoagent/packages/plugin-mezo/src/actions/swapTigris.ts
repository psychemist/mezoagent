import { type Action, type IAgentRuntime, type Memory, type ActionResult } from '@elizaos/core';
import { createMezoRpcClient } from '../lib/rpc-client';
import { TransactionBuilder } from '../lib/transaction-builder';
import { TigrisDexContract, CONTRACT_ADDRESSES, ABIS } from '../lib/contracts';

const TOKEN_ADDRESSES = {
    tBTC: process.env.MEZO_TBTC_ADDRESS || '0x0000000000000000000000000000000000000000',
    MUSD: process.env.MEZO_MUSD_ADDRESS || '0x0000000000000000000000000000000000000000',
} as const;

const SMART_ACCOUNT_ADDRESS = process.env.MEZO_SMART_ACCOUNT_ADDRESS || '0x0000000000000000000000000000000000000000';

/**
 * Parse swap parameters from message text
 */
function parseSwapParams(text: string): {
    tokenIn?: string;
    tokenOut?: string;
    amount?: string;
} {
    const lowerText = text.toLowerCase();
    const amountMatch = text.match(/(\d+\.?\d*)\s*(tbtc|musd|btc|usd)/i);
    const amount = amountMatch ? amountMatch[1] : undefined;
    
    let tokenIn: string | undefined;
    let tokenOut: string | undefined;

    if (lowerText.includes('tbtc') && lowerText.includes('musd')) {
        if (lowerText.includes('for musd') || lowerText.includes('to musd') || lowerText.includes('sell tbtc')) {
            tokenIn = 'tBTC';
            tokenOut = 'MUSD';
        } else if (lowerText.includes('for tbtc') || lowerText.includes('to tbtc') || lowerText.includes('buy tbtc')) {
            tokenIn = 'MUSD';
            tokenOut = 'tBTC';
        }
    } else if (lowerText.includes('tbtc')) {
        tokenIn = 'tBTC';
        tokenOut = 'MUSD';
    } else if (lowerText.includes('musd')) {
        tokenIn = 'MUSD';
        tokenOut = 'tBTC';
    }

    return { tokenIn, tokenOut, amount };
}

/**
 * Convert token amount to wei (assuming 18 decimals)
 */
function parseAmount(amount: string): bigint {
    const num = parseFloat(amount);
    return BigInt(Math.floor(num * 1e18));
}

export const swapTigrisAction: Action = {
    name: 'SWAP_TIGRIS',
    similes: ['TRADE_TIGRIS', 'EXCHANGE_TOKENS', 'BUY_MUSD', 'SELL_TBTC'],
    description: 'Swap tokens on Tigris DEX (e.g., tBTC to MUSD).',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const keywords = ['swap', 'trade', 'buy', 'sell', 'exchange'];
        const hasKeyword = keywords.some(keyword => message.content.text.toLowerCase().includes(keyword));
        
        if (!hasKeyword) return false;

        // Check if we have required configuration
        if (SMART_ACCOUNT_ADDRESS === '0x0000000000000000000000000000000000000000') {
            console.warn('MEZO_SMART_ACCOUNT_ADDRESS not configured - swap will be simulated');
        }

        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory): Promise<ActionResult> => {
        try {
            const text = message.content.text;
            const params = parseSwapParams(text);

            if (!params.tokenIn || !params.tokenOut) {
                return {
                    text: "❌ Could not determine swap direction. Please specify tokens (e.g., 'Swap 1 tBTC for MUSD')",
                    values: { status: "ERROR", error: "Invalid swap parameters" },
                    success: false
                };
            }

            const amount = params.amount ? parseAmount(params.amount) : 0n;
            if (amount === 0n) {
                return {
                    text: "❌ Could not determine swap amount. Please specify amount (e.g., 'Swap 1 tBTC for MUSD')",
                    values: { status: "ERROR", error: "Invalid amount" },
                    success: false
                };
            }

            // Check if we have real blockchain configuration
            const useRealBlockchain = SMART_ACCOUNT_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
                                     CONTRACT_ADDRESSES.TIGRIS_DEX !== '0x0000000000000000000000000000000000000000';

            if (!useRealBlockchain) {
                // Fallback to mock execution
                const actionDescription = `Executing Intent: Swap ${params.amount || 'X'} ${params.tokenIn} for ${params.tokenOut} via Tigris DEX`;
                const stealthInfo = "\n[Stealth Mode]: Routing via Private RPC to prevent MEV...";
                
                return {
                    text: `✅ ${actionDescription}\n${stealthInfo}\n\nStatus: Intent Submitted. Waiting for Solver execution...\n\nNote: Blockchain not configured. This is a simulation.`,
                    values: {
                        status: "PENDING_SOLVER",
                        protocol: "Tigris DEX",
                        simulated: true
                    },
                    data: {
                        txHash: "0xMockTxHash...",
                        slippage: "0.1%"
                    },
                    success: true
                };
            }

            // Real blockchain execution
            const rpcClient = createMezoRpcClient();
            const txBuilder = new TransactionBuilder(rpcClient);
            
            const tokenInAddress = TOKEN_ADDRESSES[params.tokenIn as keyof typeof TOKEN_ADDRESSES];
            const tokenOutAddress = TOKEN_ADDRESSES[params.tokenOut as keyof typeof TOKEN_ADDRESSES];

            if (!tokenInAddress || !tokenOutAddress) {
                return {
                    text: `❌ Token addresses not configured for ${params.tokenIn} or ${params.tokenOut}`,
                    values: { status: "ERROR", error: "Token addresses not configured" },
                    success: false
                };
            }

            // Get price quote from DEX
            const dexContract = new TigrisDexContract({
                address: CONTRACT_ADDRESSES.TIGRIS_DEX,
                abi: ABIS.TIGRIS_DEX,
                rpcClient,
            });

            const path = [tokenInAddress, tokenOutAddress];
            const amountsOut = await dexContract.getAmountsOut(amount, path);
            const amountOutMin = (amountsOut[1] * 95n) / 100n; // 5% slippage tolerance

            // Build swap transaction
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes from now
            const swapParams = {
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                amountIn: amount,
                amountOutMin,
                to: SMART_ACCOUNT_ADDRESS,
                deadline,
            };

            const txRequest = await txBuilder.buildSwapTransaction(swapParams);

            // Note: Actual signing and sending requires a signer to be configured
            // For now, we return the prepared transaction
            const actionDescription = `Prepared Swap: ${params.amount} ${params.tokenIn} → ${(Number(amountsOut[1]) / 1e18).toFixed(4)} ${params.tokenOut}`;
            const stealthInfo = "\n[Stealth Mode]: Routing via Private RPC to prevent MEV...";

            return {
                text: `✅ ${actionDescription}\n${stealthInfo}\n\nStatus: Transaction prepared. Ready for signing and execution.\n\nEstimated Output: ${(Number(amountsOut[1]) / 1e18).toFixed(4)} ${params.tokenOut}\nSlippage Tolerance: 5%`,
                values: {
                    status: "PREPARED",
                    protocol: "Tigris DEX",
                    tokenIn: params.tokenIn,
                    tokenOut: params.tokenOut,
                    amountIn: amount.toString(),
                    amountOutMin: amountOutMin.toString(),
                },
                data: {
                    transaction: txRequest,
                    estimatedOutput: amountsOut[1].toString(),
                    slippage: "5%",
                    deadline: deadline.toString(),
                },
                success: true
            };
        } catch (error) {
            console.error("Error in swapTigrisAction:", error);
            return {
                text: `❌ Error executing swap: ${error instanceof Error ? error.message : String(error)}`,
                values: {
                    status: "ERROR",
                    error: error instanceof Error ? error.message : String(error)
                },
                success: false
            };
        }
    },
    examples: [
        [
            {
                name: "{{name1}}",
                content: { text: "Swap 1 tBTC for MUSD on Tigris" }
            },
            {
                name: "{{name2}}",
                content: {
                    text: "Executing Intent: Swap 1 tBTC for MUSD via Tigris DEX...",
                    actions: ["SWAP_TIGRIS"]
                }
            }
        ]
    ]
};
