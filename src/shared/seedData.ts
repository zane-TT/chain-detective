import type { ChainEvent, ProjectSnapshot } from "./types.js";

export const nexProject: ProjectSnapshot = {
  id: "nexus-nex",
  name: "Nexus",
  symbol: "NEX",
  primaryChain: "bsc",
  contracts: [
    {
      id: "nex-bsc-token",
      projectId: "nexus-nex",
      chain: "bsc",
      label: "NEX BSC token",
      address: "0x365de036a1f7dccb621530d517133521debb2013",
      kind: "token",
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      ],
    },
    {
      id: "nex-eth-token",
      projectId: "nexus-nex",
      chain: "ethereum",
      label: "NEX ETH token",
      address: "0xf57D49646621F563b0B905aFc8336923AC569Ec5",
      kind: "token",
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      ],
    },
  ],
  currentSignals: [
    "New Hook",
    "Pool Initialized",
    "Liquidity Added",
    "StartTime Detected",
    "Single-sided Pool",
    "Cross-chain Active",
    "CEX Funding",
  ],
  mechanism: {
    type: "Timed Alpha Pool",
    confidence: 82,
    evidence: [
      "Detected initializePool-style lifecycle",
      "Trading guarded by startTime/beforeSwap pattern",
      "Project-side liquidity ranges seed price discovery",
    ],
    missing: [
      "No deposit/subscription flow",
      "No claim/refund settlement flow",
      "No visible bonding-curve accounting",
    ],
  },
  pool: {
    status: "watching",
    initialFdv: "$150M",
    buyToTargetFdv: "$600K to reach ~$400M FDV",
    buyoutCost: "~$1.08M buy-side depth",
    openTime: "2026-05-20 22:00 UTC+8",
  },
  supply: {
    total: "100T NEX",
    bridgedToBsc: "~5T NEX",
    watchedCex: ["Coinbase", "Kraken", "KuCoin"],
  },
};

export const seedEvents: ChainEvent[] = [
  {
    id: "seed-1",
    projectId: "nexus-nex",
    chain: "bsc",
    severity: "watch",
    source: "seed",
    signal: "New Hook",
    title: "New Alpha hook pattern detected",
    detail: "Pool lifecycle uses a newer initializePool path, so legacy pool-add listeners can miss it.",
    timestamp: "2026-05-20T02:39:11.000Z",
  },
  {
    id: "seed-2",
    projectId: "nexus-nex",
    chain: "bsc",
    severity: "info",
    source: "seed",
    signal: "Pool Initialized",
    title: "Pool initialized with timed trading gate",
    detail: "Mechanism resembles a timed Alpha pool rather than deposit/claim based TGE subscription.",
    timestamp: "2026-05-20T02:40:00.000Z",
  },
  {
    id: "seed-3",
    projectId: "nexus-nex",
    chain: "bsc",
    severity: "alert",
    source: "seed",
    signal: "Single-sided Pool",
    title: "Pool depth capped near 1B FDV",
    detail: "Seeded liquidity suggests high volatility after roughly 600M FDV and buy-side depletion near 1.08M USDT.",
    timestamp: "2026-05-20T02:41:00.000Z",
  },
  {
    id: "seed-4",
    projectId: "nexus-nex",
    chain: "ethereum",
    severity: "watch",
    source: "seed",
    signal: "Cross-chain Active",
    title: "Hyperlane bridge supply requires monitoring",
    detail: "Main supply is on Ethereum; about 5T NEX appears bridged to BSC in the seed investigation.",
    timestamp: "2026-05-20T02:42:00.000Z",
  },
];

