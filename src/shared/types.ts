export type ChainKey = "bsc" | "ethereum";

export type DetectorStatus =
  | "demo"
  | "connecting"
  | "live"
  | "degraded"
  | "offline";

export type LifecycleSignal =
  | "New Hook"
  | "Pool Initialized"
  | "Liquidity Added"
  | "Trading Locked"
  | "StartTime Detected"
  | "Trading Open"
  | "CEX Funding"
  | "Cross-chain Active"
  | "Single-sided Pool"
  | "Unknown Mechanism";

export type MechanismType =
  | "Timed Alpha Pool"
  | "TGE Subscription"
  | "Bonding Curve Sale"
  | "Fair Launch"
  | "Unknown";

export interface ChainConfig {
  key: ChainKey;
  label: string;
  chainId: number;
  rpcEnv: string;
  publicRpcUrl?: string;
  nativeSymbol: string;
}

export interface WatchTarget {
  id: string;
  projectId: string;
  chain: ChainKey;
  label: string;
  address: `0x${string}`;
  kind: "token" | "pool" | "hook" | "bridge" | "cex-wallet";
  topics?: `0x${string}`[];
}

export interface ProjectSnapshot {
  id: string;
  name: string;
  symbol: string;
  primaryChain: ChainKey;
  contracts: WatchTarget[];
  currentSignals: LifecycleSignal[];
  mechanism: {
    type: MechanismType;
    confidence: number;
    evidence: string[];
    missing: string[];
  };
  pool: {
    status: "seeded" | "watching" | "live" | "unknown";
    initialFdv: string;
    buyToTargetFdv: string;
    buyoutCost: string;
    openTime: string;
  };
  supply: {
    total: string;
    bridgedToBsc: string;
    watchedCex: string[];
  };
}

export interface ChainEvent {
  id: string;
  projectId: string;
  chain: ChainKey;
  severity: "info" | "watch" | "alert";
  source: "seed" | "rpc" | "detector";
  signal: LifecycleSignal | "Block" | "Transfer" | "Log Match";
  title: string;
  detail: string;
  blockNumber?: string;
  txHash?: `0x${string}`;
  address?: `0x${string}`;
  timestamp: string;
}

export interface LiquidityWalletRelation {
  wallet: `0x${string}`;
  relation: "same-pool" | "same-transaction" | "multi-pool";
  evidence: string;
}

export interface LiquidityProviderWallet {
  address: `0x${string}`;
  poolAddresses: `0x${string}`[];
  addLiquidityTxs: `0x${string}`[];
  firstBlock: string;
  lastBlock: string;
  tokenBalance: string;
  totalSupplySharePercent: number;
  isMajorHolder: boolean;
  relations: LiquidityWalletRelation[];
}

export interface LiquidityPoolAnalysis {
  dex: string;
  factoryAddress: `0x${string}`;
  pairAddress: `0x${string}`;
  tokenSide: "token0" | "token1";
  mintEventCount: number;
  providerCount: number;
  firstBlock?: string;
  lastBlock?: string;
}

export interface WalletRelationEdge {
  source: `0x${string}`;
  target: `0x${string}`;
  relation: "same-pool" | "same-transaction" | "multi-pool";
  evidence: string;
}

export interface TokenLiquidityAnalysis {
  id: string;
  chain: ChainKey;
  tokenAddress: `0x${string}`;
  status: "complete" | "degraded";
  thresholdPercent: number;
  scannedFromBlock: string;
  scannedToBlock: string;
  pools: LiquidityPoolAnalysis[];
  wallets: LiquidityProviderWallet[];
  relations: WalletRelationEdge[];
  warnings: string[];
  updatedAt: string;
}

export interface DetectorState {
  status: DetectorStatus;
  mode: "demo" | "live";
  chains: Record<ChainKey, DetectorStatus>;
  projects: ProjectSnapshot[];
  events: ChainEvent[];
  liquidityAnalyses: TokenLiquidityAnalysis[];
  updatedAt: string;
}
