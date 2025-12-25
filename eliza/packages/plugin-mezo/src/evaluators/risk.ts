import { type Evaluator, type IAgentRuntime, type Memory, type State } from '@elizaos/core';

export const riskEvaluator: Evaluator = {
    name: 'CHECK_RISK_LEVEL',
    description: 'Continuously monitors portfolio risk and asset pegs (e.g., MUSD peg, TVL drops).',
    similes: ['ASSESS_RISK', 'CHECK_SAFETY', 'MONITOR_PEG'],
    alwaysRun: true, // This evaluator should run frequently
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Always validate to ensure we are constantly checking risk
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        // Mock Risk Check
        const MUSD_PRICE = 0.999; // Mock price
        const PEG_THRESHOLD = 0.98;

        if (MUSD_PRICE < PEG_THRESHOLD) {
            console.warn(`[RISK ALERT] MUSD De-peg detected! Price: ${MUSD_PRICE}`);
            return {
                text: "CRITICAL: MUSD De-peg detected. Initiating emergency protocols.",
                values: {
                    riskLevel: "CRITICAL",
                    actionRequired: "ROTATE_TO_TBTC"
                }
            };
        }

        console.log(`[RISK CHECK] System Optimal. MUSD Price: ${MUSD_PRICE}`);
        return {
            text: "Risk levels nominal.",
            values: {
                riskLevel: "LOW",
                actionRequired: "NONE"
            }
        };
    },
    examples: [
        {
            context: "Market is volatile",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "check status" }
                }
            ],
            outcome: "Risk levels nominal."
        }
    ]
};
