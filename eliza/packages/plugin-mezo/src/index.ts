import { Plugin } from "@elizaos/core";
import { swapTigrisAction } from "./actions/swapTigris";
import { depositUpshiftAction } from "./actions/depositUpshift";
import { walletProvider } from "./providers/wallet";
import { marketProvider } from "./providers/market";
import { riskEvaluator } from "./evaluators/risk";

export const mezoPlugin: Plugin = {
    name: "mezo",
    description: "Mezo Stealth Agent integration for autonomous finance",
    actions: [
        swapTigrisAction,
        depositUpshiftAction
    ],
    evaluators: [
        riskEvaluator
    ],
    providers: [
        walletProvider,
        marketProvider
    ],
};

export default mezoPlugin;
