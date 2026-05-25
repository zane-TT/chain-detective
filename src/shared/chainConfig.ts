import type { ChainConfig } from "./types.js";

export const chains: ChainConfig[] = [
  {
    key: "bsc",
    label: "BNB Smart Chain",
    chainId: 56,
    rpcEnv: "BSC_RPC_URL",
    publicRpcUrl: "https://bsc-dataseed-public.bnbchain.org",
    nativeSymbol: "BNB",
  },
  {
    key: "ethereum",
    label: "Ethereum",
    chainId: 1,
    rpcEnv: "ETH_RPC_URL",
    nativeSymbol: "ETH",
  },
];

export const chainLabels = Object.fromEntries(
  chains.map((chain) => [chain.key, chain.label]),
) as Record<(typeof chains)[number]["key"], string>;

