import { type IAgentRuntime, type Memory, type Provider, type State } from '@elizaos/core';

const MOCK_MARKET_DATA = {
    migris: {
        tBTC_MUSD: 65000.50, // 1 tBTC = 65k MUSD
        MUSD_tBTC: 0.00001538,
        slippage: "0.5%"
    },
    upshift: {
        apy: "12.4%",
        tvl: "$450M",
        strategy: "Delta Neutral BTC"
    }
};

const marketProvider: Provider = {
    name: 'MEZO_MARKET',
    description: 'Provides real-time market data from Tigris DEX and Upshift Vaults',
    get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
        try {
            const info = `
Tigris DEX:
  - tBTC/MUSD Price: $${MOCK_MARKET_DATA.migris.tBTC_MUSD}
  - Estimated Slippage: ${MOCK_MARKET_DATA.migris.slippage}

Upshift Vaults:
  - Current APY: ${MOCK_MARKET_DATA.upshift.apy}
  - TVL: ${MOCK_MARKET_DATA.upshift.tvl}
  - Strategy: ${MOCK_MARKET_DATA.upshift.strategy}
            `.trim();

            return {
                values: MOCK_MARKET_DATA,
                data: MOCK_MARKET_DATA,
                text: `Current Mezo Market Data:\n${info}`
            };
        } catch (error) {
            console.error("Error in marketProvider:", error);
            return {
                values: {},
                data: null,
                text: "Error fetching Mezo Market data."
            };
        }
    }
};

export { marketProvider };
