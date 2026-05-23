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

export interface DetectorState {
  status: DetectorStatus;
  mode: "demo" | "live";
  chains: Record<ChainKey, DetectorStatus>;
  projects: ProjectSnapshot[];
  events: ChainEvent[];
  updatedAt: string;
}
