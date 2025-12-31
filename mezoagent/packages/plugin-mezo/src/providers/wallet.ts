import { type IAgentRuntime, type Memory, type Provider, type State } from '@elizaos/core';
import { createMezoRpcClient } from '../lib/rpc-client';
import { SessionKeyManagerContract, CONTRACT_ADDRESSES, ABIS } from '../lib/contracts';

// Token addresses on Mezo chain (should be configured via env vars)
const TOKEN_ADDRESSES = {
    tBTC: process.env.MEZO_TBTC_ADDRESS || '0x0000000000000000000000000000000000000000',
    MUSD: process.env.MEZO_MUSD_ADDRESS || '0x0000000000000000000000000000000000000000',
} as const;

// Smart account address (should be configured)
const SMART_ACCOUNT_ADDRESS = process.env.MEZO_SMART_ACCOUNT_ADDRESS || '0x0000000000000000000000000000000000000000';

// Session key address (if using session keys)
const SESSION_KEY_ADDRESS = process.env.MEZO_SESSION_KEY_ADDRESS;

/**
 * Get token balance from blockchain
 */
async function getTokenBalance(
    rpcClient: ReturnType<typeof createMezoRpcClient>,
    tokenAddress: string,
    accountAddress: string
): Promise<string> {
    try {
        // ERC-20 balanceOf(address) function selector
        const balanceOfSelector = '0x70a08231';
        const paddedAddress = accountAddress.slice(2).padStart(64, '0');
        const data = balanceOfSelector + paddedAddress;

        const result = await rpcClient.call({
            to: tokenAddress,
            data,
        });

        // Decode the uint256 result
        const balance = BigInt(result);
        // Assuming 18 decimals for most tokens
        const decimals = 18;
        const divisor = BigInt(10 ** decimals);
        const wholePart = balance / divisor;
        const fractionalPart = balance % divisor;

        return `${wholePart}.${fractionalPart.toString().padStart(decimals, '0')}`;
    } catch (error) {
        console.error(`Error fetching balance for token ${tokenAddress}:`, error);
        return '0.0';
    }
}

/**
 * Get native token (ETH) balance
 */
async function getNativeBalance(
    rpcClient: ReturnType<typeof createMezoRpcClient>,
    accountAddress: string
): Promise<string> {
    try {
        const balance = await rpcClient.getBalance(accountAddress);
        const divisor = BigInt(10 ** 18);
        const wholePart = balance / divisor;
        const fractionalPart = balance % divisor;

        return `${wholePart}.${fractionalPart.toString().padStart(18, '0')}`;
    } catch (error) {
        console.error('Error fetching native balance:', error);
        return '0.0';
    }
}

/**
 * Check if session key is valid
 */
async function checkSessionKey(
    rpcClient: ReturnType<typeof createMezoRpcClient>,
    accountAddress: string,
    sessionKeyAddress: string
): Promise<{ active: boolean; permissions: string[] }> {
    if (!sessionKeyAddress || !CONTRACT_ADDRESSES.SESSION_KEY_MANAGER) {
        return { active: false, permissions: [] };
    }

    try {
        const sessionKeyManager = new SessionKeyManagerContract({
            address: CONTRACT_ADDRESSES.SESSION_KEY_MANAGER,
            abi: ABIS.SESSION_KEY_MANAGER,
            rpcClient,
        });

        const isValid = await sessionKeyManager.isValidSessionKey(accountAddress, sessionKeyAddress);
        const permissions = isValid
            ? await sessionKeyManager.getPermissions(accountAddress, sessionKeyAddress)
            : [];

        return {
            active: isValid,
            permissions,
        };
    } catch (error) {
        console.error('Error checking session key:', error);
        return { active: false, permissions: [] };
    }
}

const walletProvider: Provider = {
    name: 'MEZO_WALLET',
    description: 'Provides details about the agent\'s Mezo Smart Account and Session Keys',
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
        try {
            const rpcClient = createMezoRpcClient();
            const accountAddress = SMART_ACCOUNT_ADDRESS;

            // Check if we have a valid address
            if (accountAddress === '0x0000000000000000000000000000000000000000') {
                // Fallback to mock data if not configured
                const MOCK_SMART_ACCOUNT = {
                    address: "0xMezoSmartAccount123456789",
                    sessionKeyActive: false,
                    permissions: [],
                    balance: {
                        tBTC: "0.0",
                        MUSD: "0.0"
                    }
                };

                return {
                    values: {
                        walletAddress: MOCK_SMART_ACCOUNT.address,
                        balances: MOCK_SMART_ACCOUNT.balance
                    },
                    data: MOCK_SMART_ACCOUNT,
                    text: `Mezo Wallet not configured. Please set MEZO_SMART_ACCOUNT_ADDRESS environment variable.`
                };
            }

            // Fetch balances
            const [tBTCBalance, MUSDBalance, nativeBalance, sessionKeyStatus] = await Promise.all([
                getTokenBalance(rpcClient, TOKEN_ADDRESSES.tBTC, accountAddress),
                getTokenBalance(rpcClient, TOKEN_ADDRESSES.MUSD, accountAddress),
                getNativeBalance(rpcClient, accountAddress),
                SESSION_KEY_ADDRESS
                    ? checkSessionKey(rpcClient, accountAddress, SESSION_KEY_ADDRESS)
                    : Promise.resolve({ active: false, permissions: [] }),
            ]);

            const walletData = {
                address: accountAddress,
                sessionKeyActive: sessionKeyStatus.active,
                permissions: sessionKeyStatus.permissions,
                balance: {
                    tBTC: tBTCBalance,
                    MUSD: MUSDBalance,
                    ETH: nativeBalance,
                }
            };

            const walletInfo = `
Smart Account Address: ${accountAddress}
Session Key Status: ${sessionKeyStatus.active ? "ACTIVE" : "INACTIVE"}
Permissions: ${sessionKeyStatus.permissions.length > 0 ? sessionKeyStatus.permissions.join(", ") : "None"}
Balances:
  - tBTC: ${tBTCBalance}
  - MUSD: ${MUSDBalance}
  - ETH: ${nativeBalance}
            `.trim();

            return {
                values: {
                    walletAddress: accountAddress,
                    balances: walletData.balance,
                    sessionKeyActive: sessionKeyStatus.active,
                    permissions: sessionKeyStatus.permissions,
                },
                data: walletData,
                text: `Current Mezo Wallet Status:\n${walletInfo}`
            };
        } catch (error) {
            console.error("Error in walletProvider:", error);
            return {
                values: {},
                data: undefined,
                text: `Error fetching Mezo Wallet data: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
};

export { walletProvider };
