import { type IAgentRuntime, type Memory, type Provider, type State } from '@elizaos/core';

// Mocked Smart Account State
const MOCK_SMART_ACCOUNT = {
    address: "0xMezoSmartAccount123456789",
    sessionKeyActive: true,
    permissions: ["SWAP_TIGRIS", "DEPOSIT_UPSHIFT", "CHECK_YIELD"],
    balance: {
        tBTC: "5.432",
        MUSD: "125000.00"
    }
};

const walletProvider: Provider = {
    name: 'MEZO_WALLET',
    description: 'Provides details about the agent\'s Mezo Smart Account and Session Keys',
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
        try {
            // In a real implementation, this would query the Mezo chain using the session key
            // to fetch the Smart Account state and validate permissions.

            const walletInfo = `
Smart Account Address: ${MOCK_SMART_ACCOUNT.address}
Session Key Status: ${MOCK_SMART_ACCOUNT.sessionKeyActive ? "ACTIVE" : "INACTIVE"}
Permissions: ${MOCK_SMART_ACCOUNT.permissions.join(", ")}
Balances:
  - tBTC: ${MOCK_SMART_ACCOUNT.balance.tBTC}
  - MUSD: ${MOCK_SMART_ACCOUNT.balance.MUSD}
            `.trim();

            return {
                values: {
                    walletAddress: MOCK_SMART_ACCOUNT.address,
                    balances: MOCK_SMART_ACCOUNT.balance
                },
                data: MOCK_SMART_ACCOUNT,
                text: `Current Mezo Wallet Status:\n${walletInfo}`
            };
        } catch (error) {
            console.error("Error in walletProvider:", error);
            return {
                values: {},
                data: null,
                text: "Error fetching Mezo Wallet data."
            };
        }
    }
};

export { walletProvider };
