import { type IAgentRuntime, type Memory, type Provider, type State } from '@elizaos/core';
import { createMezoRpcClient } from '../lib/rpc-client';
import { TigrisDexContract, UpshiftVaultContract, CONTRACT_ADDRESSES, ABIS } from '../lib/contracts';

const TOKEN_ADDRESSES = {
  tBTC: process.env.MEZO_TBTC_ADDRESS || '0x0000000000000000000000000000000000000000',
  MUSD: process.env.MEZO_MUSD_ADDRESS || '0x0000000000000000000000000000000000000000',
} as const;

/**
 * Get price from DEX reserves
 */
async function getDexPrice(
  rpcClient: ReturnType<typeof createMezoRpcClient>,
  dexAddress: string,
  tokenA: string,
  tokenB: string
): Promise<{ price: number; reversePrice: number }> {
  try {
    const dexContract = new TigrisDexContract({
      address: dexAddress,
      abi: ABIS.TIGRIS_DEX,
      rpcClient,
    });

    const reserves = await dexContract.getPrice(tokenA, tokenB);
    // Simplified price calculation - in production, decode actual reserves
    const price = Number(reserves) / 1e18;
    const reversePrice = 1 / price;

    return { price, reversePrice };
  } catch (error) {
    console.error('Error fetching DEX price:', error);
    return { price: 0, reversePrice: 0 };
  }
}

/**
 * Get vault APY and TVL
 */
async function getVaultData(
  rpcClient: ReturnType<typeof createMezoRpcClient>,
  vaultAddress: string
): Promise<{ apy: number; tvl: number }> {
  try {
    const vaultContract = new UpshiftVaultContract({
      address: vaultAddress,
      abi: ABIS.UPSHIFT_VAULT,
      rpcClient,
    });

    const [apy, tvl] = await Promise.all([
      vaultContract.getAPY(),
      vaultContract.getTVL(),
    ]);

    return {
      apy: (Number(apy) / 1e18) * 100,
      tvl: Number(tvl) / 1e18,
    };
  } catch (error) {
    console.error('Error fetching vault data:', error);
    return { apy: 0, tvl: 0 };
  }
}

const marketProvider: Provider = {
  name: 'MEZO_MARKET',
  description: 'Provides real-time market data from Tigris DEX and Upshift Vaults',
  get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
    try {
      const rpcClient = createMezoRpcClient();
      const tigrisDex = CONTRACT_ADDRESSES.TIGRIS_DEX;
      const upshiftVault = CONTRACT_ADDRESSES.UPSHIFT_VAULT_BTC;

      // Check if we have real blockchain configuration
      const useRealBlockchain = tigrisDex !== '0x0000000000000000000000000000000000000000' &&
                upshiftVault !== '0x0000000000000000000000000000000000000000' &&
                TOKEN_ADDRESSES.tBTC !== '0x0000000000000000000000000000000000000000' &&
                TOKEN_ADDRESSES.MUSD !== '0x0000000000000000000000000000000000000000';

      if (!useRealBlockchain) {
        // Fallback to mock data
        const MOCK_MARKET_DATA = {
          tigris: {
            tBTC_MUSD: 65000.50,
            MUSD_tBTC: 0.00001538,
            slippage: '0.5%'
          },
          upshift: {
            apy: '12.4%',
            tvl: '$450M',
            strategy: 'Delta Neutral BTC'
          }
        };

        const info = `
Tigris DEX:
  - tBTC/MUSD Price: $${MOCK_MARKET_DATA.tigris.tBTC_MUSD}
  - Estimated Slippage: ${MOCK_MARKET_DATA.tigris.slippage}

Upshift Vaults:
  - Current APY: ${MOCK_MARKET_DATA.upshift.apy}
  - TVL: ${MOCK_MARKET_DATA.upshift.tvl}
  - Strategy: ${MOCK_MARKET_DATA.upshift.strategy}

Note: Using mock data. Configure contract addresses for real-time data.
                `.trim();

        return {
          values: MOCK_MARKET_DATA,
          data: MOCK_MARKET_DATA as unknown as Record<string, unknown>,
          text: `Current Mezo Market Data:\n${info}`
        };
      }

      // Fetch real blockchain data
      const [priceData, vaultData] = await Promise.all([
        getDexPrice(rpcClient, tigrisDex, TOKEN_ADDRESSES.tBTC, TOKEN_ADDRESSES.MUSD),
        getVaultData(rpcClient, upshiftVault),
      ]);

      const marketData = {
        tigris: {
          tBTC_MUSD: priceData.price,
          MUSD_tBTC: priceData.reversePrice,
          slippage: '0.5%', // Would need to calculate from reserves
        },
        upshift: {
          apy: `${vaultData.apy.toFixed(2)}%`,
          tvl: `$${(vaultData.tvl / 1e6).toFixed(1)}M`,
          strategy: 'Delta Neutral BTC',
        }
      };

      const info = `
Tigris DEX:
  - tBTC/MUSD Price: $${priceData.price.toFixed(2)}
  - MUSD/tBTC Price: ${priceData.reversePrice.toFixed(8)}
  - Estimated Slippage: ${marketData.tigris.slippage}

Upshift Vaults:
  - Current APY: ${marketData.upshift.apy}
  - TVL: ${marketData.upshift.tvl}
  - Strategy: ${marketData.upshift.strategy}
            `.trim();

      return {
        values: marketData,
        data: marketData as unknown as Record<string, unknown>,
        text: `Current Mezo Market Data:\n${info}`
      };
    } catch (error) {
      console.error('Error in marketProvider:', error);
      return {
        values: {},
        data: undefined,
        text: `Error fetching Mezo Market data: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

export { marketProvider };
