import { useState, useEffect, useMemo } from 'react';
import type { DashboardMetrics } from '../components/mezo/MezoDashboard';
import type { PortfolioAsset } from '../components/mezo/PortfolioView';
import type { YieldDataPoint } from '../components/mezo/YieldChart';

// Default addresses for testnet/simulation if not provided
const DEFAULTS = {
    RPC_URL: 'https://rpc.mezo.org', // Placeholder, user needs to set this
    TBTC: '0x0000000000000000000000000000000000000000',
    MUSD: '0x0000000000000000000000000000000000000000',
};

interface UseMezoRealDataResult {
    metrics: DashboardMetrics | undefined;
    assets: PortfolioAsset[] | undefined;
    yieldData: YieldDataPoint[] | undefined;
    isLoading: boolean;
    error: string | null;
    isLive: boolean;
    refresh: () => Promise<void>;
}

export function useMezoRealData(): UseMezoRealDataResult {
    const [metrics, setMetrics] = useState<DashboardMetrics | undefined>();
    const [assets, setAssets] = useState<PortfolioAsset[] | undefined>();
    const [yieldData, setYieldData] = useState<YieldDataPoint[] | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const config = useMemo(() => ({
        rpcUrl: import.meta.env.VITE_MEZO_RPC_URL || DEFAULTS.RPC_URL,
        smartAccount: import.meta.env.VITE_MEZO_SMART_ACCOUNT_ADDRESS,
        tBtcAddress: import.meta.env.VITE_MEZO_TBTC_ADDRESS || DEFAULTS.TBTC,
        mUsdAddress: import.meta.env.VITE_MEZO_MUSD_ADDRESS || DEFAULTS.MUSD,
    }), []);

    const isLive = !!(import.meta.env.VITE_MEZO_RPC_URL && import.meta.env.VITE_MEZO_SMART_ACCOUNT_ADDRESS);

    const fetchData = async () => {
        if (!isLive) return;

        setIsLoading(true);
        setError(null);

        try {
            // Helper for RPC calls
            const rpcCall = async (method: string, params: unknown[]) => {
                const response = await fetch(config.rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: Date.now(),
                        method,
                        params,
                    }),
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                return data.result;
            };

            // Fetch prices from CoinGecko (free API, no key needed)
            const fetchPrices = async () => {
                try {
                    const response = await fetch(
                        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd',
                        { 
                            headers: { 'Accept': 'application/json' },
                            // Add timeout
                            signal: AbortSignal.timeout(5000)
                        }
                    );
                    if (!response.ok) throw new Error('Price fetch failed');
                    const data = await response.json();
                    return {
                        ethPrice: data.ethereum?.usd || 3000,
                        btcPrice: data.bitcoin?.usd || 65000,
                    };
                } catch (error) {
                    console.warn('Failed to fetch prices, using defaults:', error);
                    return { ethPrice: 3000, btcPrice: 65000 };
                }
            };

            // Fetch session keys count
            const fetchSessionKeysCount = async (): Promise<number> => {
                try {
                    // Try to fetch from SessionKeyManager contract if address is configured
                    const sessionKeyManagerAddress = import.meta.env.VITE_MEZO_SESSION_KEY_MANAGER_ADDRESS;
                    if (!sessionKeyManagerAddress || sessionKeyManagerAddress === '0x0000000000000000000000000000000000000000') {
                        return 0;
                    }

                    // Function selector for getSessionKeysCount(address): 0x... (would need actual ABI)
                    // For now, return 0 as we don't have the contract ABI in the client
                    // This would require either:
                    // 1. A backend API endpoint that queries the contract
                    // 2. Including the contract ABI in the client
                    // 3. Using a service like Alchemy/Infura that provides contract read methods
                    return 0;
                } catch (error) {
                    console.warn('Failed to fetch session keys count:', error);
                    return 0;
                }
            };

            // Fetch yield data (basic implementation)
            const fetchYieldData = async (): Promise<YieldDataPoint[]> => {
                try {
                    // For now, return empty array - would need to:
                    // 1. Query Upshift contract for yield history
                    // 2. Or fetch from a backend API that aggregates yield data
                    // 3. Or use The Graph subgraph if available
                    return [];
                } catch (error) {
                    console.warn('Failed to fetch yield data:', error);
                    return [];
                }
            };

            // Fetch all data in parallel
            const [prices, sessionKeysCount, yieldDataResult] = await Promise.all([
                fetchPrices(),
                fetchSessionKeysCount(),
                fetchYieldData(),
            ]);

            // 1. Get ETH (Native) Balance
            const ethBalanceHex = await rpcCall('eth_getBalance', [config.smartAccount, 'latest']);
            const ethBalance = parseInt(ethBalanceHex, 16) / 1e18;

            // 2. Get Token Balances (ERC20 balanceOf)
            // Function selector for balanceOf(address): 0x70a08231
            const balanceOfSelector = '0x70a08231';
            const paddedAddress = config.smartAccount!.slice(2).padStart(64, '0');
            const data = balanceOfSelector + paddedAddress;

            // tBTC
            let tBtcBalance = 0;
            if (config.tBtcAddress !== DEFAULTS.TBTC) {
                const hex = await rpcCall('eth_call', [{ to: config.tBtcAddress, data }, 'latest']);
                tBtcBalance = parseInt(hex, 16) / 1e18; // Assuming 18 decimals
            }

            // MUSD
            let mUsdBalance = 0;
            if (config.mUsdAddress !== DEFAULTS.MUSD) {
                const hex = await rpcCall('eth_call', [{ to: config.mUsdAddress, data }, 'latest']);
                mUsdBalance = parseInt(hex, 16) / 1e18; // Assuming 18 decimals
            }

            // Construct Real Assets with real prices
            const realAssets: PortfolioAsset[] = [
                {
                    id: 'eth',
                    symbol: 'ETH',
                    name: 'Ethereum',
                    amount: ethBalance,
                    value: ethBalance * prices.ethPrice,
                    percentage: 0,
                    protocol: 'Wallet',
                    type: 'TOKEN' as const,
                },
                {
                    id: 'tbtc',
                    symbol: 'tBTC',
                    name: 'Tether Bitcoin',
                    amount: tBtcBalance,
                    value: tBtcBalance * prices.btcPrice,
                    percentage: 0,
                    protocol: 'Wallet',
                    type: 'TOKEN' as const,
                },
                {
                    id: 'musd',
                    symbol: 'MUSD',
                    name: 'Mezo USD',
                    amount: mUsdBalance,
                    value: mUsdBalance * 1, // Stablecoin
                    percentage: 0,
                    protocol: 'Wallet',
                    type: 'TOKEN' as const,
                }
            ].filter(a => a.value > 0);

            // Calculate Totals
            const totalValue = realAssets.reduce((sum, a) => sum + a.value, 0);

            // Recalculate percentages
            const finalAssets = realAssets.map(a => ({
                ...a,
                percentage: totalValue > 0 ? (a.value / totalValue) * 100 : 0
            }));

            setAssets(finalAssets);
            setMetrics({
                totalValue,
                totalYield: 0, // Hard to calc without history
                activePositions: finalAssets.length,
                sessionKeys: sessionKeysCount,
                riskLevel: 'LOW',
                lastUpdate: new Date()
            });

            // Set yield data
            setYieldData(yieldDataResult.length > 0 ? yieldDataResult : undefined);

        } catch (err: unknown) {
            console.error('Failed to fetch Mezo data:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isLive) {
            fetchData();
            // Poll every 30s
            const interval = setInterval(fetchData, 30000);
            return () => clearInterval(interval);
        }
    }, [isLive, config]);

    return { metrics, assets, yieldData, isLoading, error, isLive, refresh: fetchData };
}
