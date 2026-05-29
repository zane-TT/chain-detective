import { createPublicClient, formatUnits, getAddress, http, isAddress, parseAbiItem, type Log } from "viem";
import { bsc, mainnet } from "viem/chains";
import { chains } from "../shared/chainConfig.js";
import { nexProject, seedEvents } from "../shared/seedData.js";
import type {
  ChainConfig,
  ChainEvent,
  ChainKey,
  DetectorState,
  DetectorStatus,
  LiquidityPoolAnalysis,
  LiquidityProviderWallet,
  TokenLiquidityAnalysis,
  WalletRelationEdge,
  WatchTarget,
} from "../shared/types.js";

const viemChains = {
  bsc,
  ethereum: mainnet,
} as const;

type Listener = (state: DetectorState, event?: ChainEvent) => void;
type AddTokenTargetInput = {
  chain: ChainKey;
  address: string;
  label?: string;
};
type AnalyzeTokenLiquidityInput = {
  chain: ChainKey;
  address: string;
};

const pollIntervalMs = 8_000;
const liquidityHolderThresholdPercent = 0.1;
const defaultLiquidityScanBlocks = 250_000n;
const defaultLogChunkSize = 20_000n;

const pairCreatedEvent = parseAbiItem(
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
);
const mintEvent = parseAbiItem(
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
);
const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
const v2FactoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;
const v2PairAbi = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

type DexFactory = {
  name: string;
  address: `0x${string}`;
  quoteTokens: `0x${string}`[];
};

const v2Factories: Record<ChainKey, DexFactory[]> = {
  bsc: [
    {
      name: "PancakeSwap V2",
      address: "0xCA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
      quoteTokens: [
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "0x55d398326f99059fF775485246999027B3197955",
        "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      ],
    },
    {
      name: "Biswap V2",
      address: "0x858E3312ed3A876947EA49d572A7C42DE08af7EE",
      quoteTokens: [
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "0x55d398326f99059fF775485246999027B3197955",
      ],
    },
  ],
  ethereum: [
    {
      name: "Uniswap V2",
      address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
      quoteTokens: [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      ],
    },
    {
      name: "SushiSwap V2",
      address: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
      quoteTokens: [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ],
    },
  ],
};

function resolveRpcUrl(chain: ChainConfig) {
  return process.env[chain.rpcEnv] || chain.publicRpcUrl;
}

type GetLogsInput = {
  address: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  event?: any;
  args?: any;
};
type ChainClient = {
  getBlockNumber: () => Promise<bigint>;
  getLogs: (input: GetLogsInput) => Promise<Log[]>;
  getTransaction?: (input: { hash: `0x${string}` }) => Promise<{ from: `0x${string}` }>;
  readContract?: (input: any) => Promise<unknown>;
};
type ChainDetectorOptions = {
  chainConfigs?: ChainConfig[];
  createClient?: (chain: ChainConfig, rpcUrl: string) => ChainClient;
  initialLatestBlocks?: Partial<Record<ChainKey, bigint>>;
  pollIntervalMs?: number;
};

export class ChainDetector {
  private readonly chainConfigs: ChainConfig[];
  private readonly createClient: (chain: ChainConfig, rpcUrl: string) => ChainClient;
  private readonly pollIntervalMs: number;
  private state: DetectorState = {
    status: "demo",
    mode: "demo",
    chains: {
      bsc: "demo",
      ethereum: "demo",
    },
    projects: [nexProject],
    events: seedEvents,
    liquidityAnalyses: [],
    updatedAt: new Date().toISOString(),
  };

  private listeners = new Set<Listener>();
  private timers: NodeJS.Timeout[] = [];
  private latestBlocks = new Map<ChainKey, bigint>();

  constructor(options: ChainDetectorOptions = {}) {
    this.chainConfigs = options.chainConfigs ?? chains;
    this.createClient =
      options.createClient ??
      ((chain, rpcUrl) =>
        createPublicClient({
          chain: viemChains[chain.key],
          transport: http(rpcUrl),
        }) as unknown as ChainClient);
    this.pollIntervalMs = options.pollIntervalMs ?? pollIntervalMs;

    for (const [chain, blockNumber] of Object.entries(options.initialLatestBlocks ?? {})) {
      if (blockNumber !== undefined) {
        this.latestBlocks.set(chain as ChainKey, blockNumber);
      }
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  addTokenTarget(input: AddTokenTargetInput) {
    if (!viemChains[input.chain]) {
      throw new Error("Unsupported chain.");
    }

    if (!isAddress(input.address)) {
      throw new Error("Invalid EVM token address.");
    }

    const address = getAddress(input.address) as `0x${string}`;
    const project = this.state.projects[0];
    const alreadyWatched = project.contracts.some(
      (target) => target.chain === input.chain && target.address.toLowerCase() === address.toLowerCase(),
    );

    if (alreadyWatched) {
      throw new Error("This token address is already being watched.");
    }

    const label = input.label?.trim() || `${input.chain.toUpperCase()} token ${address.slice(0, 6)}...${address.slice(-4)}`;
    const target: WatchTarget = {
      id: `custom-${input.chain}-${address.toLowerCase()}`,
      projectId: project.id,
      chain: input.chain,
      label,
      address,
      kind: "token",
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      ],
    };

    this.state = {
      ...this.state,
      projects: [
        {
          ...project,
          contracts: [...project.contracts, target],
          pool: {
            ...project.pool,
            status: "watching",
          },
        },
        ...this.state.projects.slice(1),
      ],
      updatedAt: new Date().toISOString(),
    };

    const event: ChainEvent = {
      id: `watch-${target.id}-${Date.now()}`,
      projectId: project.id,
      chain: input.chain,
      severity: "watch",
      source: "detector",
      signal: "Transfer",
      title: `${label} added to watchlist`,
      detail: `Token ${address} will be scanned for Transfer logs when ${input.chain} RPC polling is available.`,
      address,
      timestamp: new Date().toISOString(),
    };

    this.pushEvent(event);
    return target;
  }

  async analyzeTokenLiquidity(input: AnalyzeTokenLiquidityInput) {
    if (!viemChains[input.chain]) {
      throw new Error("Unsupported chain.");
    }

    if (!isAddress(input.address)) {
      throw new Error("Invalid EVM token address.");
    }

    const chain = this.chainConfigs.find((item) => item.key === input.chain);
    const rpcUrl = chain ? resolveRpcUrl(chain) : undefined;

    if (!chain || !rpcUrl) {
      throw new Error(`No RPC URL configured for ${input.chain}.`);
    }

    const tokenAddress = getAddress(input.address) as `0x${string}`;
    const client = this.createClient(chain, rpcUrl);

    if (!client.readContract) {
      throw new Error("The configured RPC client does not support contract reads.");
    }

    const toBlock = await client.getBlockNumber();
    const scanBlocks = BigInt(process.env.LIQUIDITY_SCAN_BLOCKS ?? defaultLiquidityScanBlocks.toString());
    const fromBlock = process.env.LIQUIDITY_SCAN_FROM_BLOCK
      ? BigInt(process.env.LIQUIDITY_SCAN_FROM_BLOCK)
      : toBlock > scanBlocks
        ? toBlock - scanBlocks
        : 0n;
    const warnings: string[] = [];

    if (!process.env.LIQUIDITY_SCAN_FROM_BLOCK) {
      warnings.push(
        `Historical scan is limited to the latest ${scanBlocks.toString()} blocks. Set LIQUIDITY_SCAN_FROM_BLOCK for a deeper archive scan.`,
      );
    }

    const pools = await this.findV2Pools(client, input.chain, tokenAddress, fromBlock, toBlock, warnings);
    const analysis = await this.buildLiquidityAnalysis(
      client,
      input.chain,
      tokenAddress,
      fromBlock,
      toBlock,
      pools,
      warnings,
    );

    this.state = {
      ...this.state,
      liquidityAnalyses: [
        analysis,
        ...this.state.liquidityAnalyses.filter(
          (item) =>
            item.chain !== analysis.chain ||
            item.tokenAddress.toLowerCase() !== analysis.tokenAddress.toLowerCase(),
        ),
      ].slice(0, 8),
      updatedAt: new Date().toISOString(),
    };

    this.pushEvent({
      id: `liquidity-analysis-${input.chain}-${tokenAddress.toLowerCase()}-${Date.now()}`,
      projectId: "nexus-nex",
      chain: input.chain,
      severity: analysis.wallets.some((wallet) => wallet.isMajorHolder) ? "alert" : "watch",
      source: "detector",
      signal: "Liquidity Added",
      title: `Liquidity wallets analyzed for ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`,
      detail: `Found ${analysis.pools.length} V2-style pools and ${analysis.wallets.length} add-liquidity wallets. ${analysis.wallets.filter((wallet) => wallet.isMajorHolder).length} wallet(s) hold at least ${liquidityHolderThresholdPercent}% supply.`,
      address: tokenAddress,
      timestamp: new Date().toISOString(),
    });

    return analysis;
  }

  start() {
    const liveChains = this.chainConfigs.filter((chain) => Boolean(resolveRpcUrl(chain)));

    if (liveChains.length === 0) {
      this.startDemoPulse();
      return;
    }

    this.state.mode = "live";
    this.state.status = "connecting";
    this.emit();

    for (const chain of liveChains) {
      this.startChainPolling(chain);
    }
  }

  stop() {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
  }

  private startDemoPulse() {
    let index = 0;
    const demoSignals = seedEvents.map((event) => event.signal);

    const timer = setInterval(() => {
      const signal = demoSignals[index % demoSignals.length];
      index += 1;

      this.pushEvent({
        id: `demo-${Date.now()}`,
        projectId: "nexus-nex",
        chain: index % 2 === 0 ? "bsc" : "ethereum",
        severity: signal === "Single-sided Pool" ? "alert" : "info",
        source: "detector",
        signal,
        title: `Demo detector heartbeat: ${signal}`,
        detail:
          "Set BSC_RPC_URL or ETH_RPC_URL to switch this stream from seeded demo events to live chain polling.",
        timestamp: new Date().toISOString(),
      });
    }, 10_000);

    this.timers.push(timer);
  }

  private startChainPolling(chain: ChainConfig) {
    const rpcUrl = resolveRpcUrl(chain);
    if (!rpcUrl) return;

    const client = this.createClient(chain, rpcUrl);

    this.setChainStatus(chain.key, "connecting");

    const tick = async () => {
      try {
        await this.pollChain(chain, client);
        this.setChainStatus(chain.key, "live");
      } catch (error) {
        this.setChainStatus(chain.key, "degraded");
        this.pushEvent({
          id: `rpc-error-${chain.key}-${Date.now()}`,
          projectId: "nexus-nex",
          chain: chain.key,
          severity: "alert",
          source: "detector",
          signal: "Unknown Mechanism",
          title: `${chain.label} polling degraded`,
          detail: error instanceof Error ? error.message : "Unknown RPC polling error",
          timestamp: new Date().toISOString(),
        });
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), this.pollIntervalMs);
    this.timers.push(timer);
  }

  private async pollChain(chain: ChainConfig, client: ChainClient) {
    const blockNumber = await client.getBlockNumber();
    const previous = this.latestBlocks.get(chain.key);
    this.latestBlocks.set(chain.key, blockNumber);

    this.pushEvent({
      id: `block-${chain.key}-${blockNumber.toString()}`,
      projectId: "nexus-nex",
      chain: chain.key,
      severity: "info",
      source: "rpc",
      signal: "Block",
      title: `${chain.label} block ${blockNumber.toString()}`,
      detail: "Live RPC connection is active.",
      blockNumber: blockNumber.toString(),
      timestamp: new Date().toISOString(),
    });

    if (!previous || blockNumber <= previous) {
      return;
    }

    const targets = this.state.projects.flatMap((project) =>
      project.contracts.filter((target) => target.chain === chain.key),
    );
    await Promise.all(
      targets.map((target) =>
        this.scanTargetLogs(client, target, previous + 1n, blockNumber),
      ),
    );
  }

  private async scanTargetLogs(
    client: ChainClient,
    target: WatchTarget,
    fromBlock: bigint,
    toBlock: bigint,
  ) {
    const logs = await client.getLogs({
      address: target.address,
      fromBlock,
      toBlock,
      event: undefined,
      args: undefined,
    });

    for (const log of logs) {
      this.pushEvent(this.toEvent(target, log));
    }
  }

  private async findV2Pools(
    client: ChainClient,
    chain: ChainKey,
    tokenAddress: `0x${string}`,
    fromBlock: bigint,
    toBlock: bigint,
    warnings: string[],
  ) {
    const pools = new Map<
      string,
      LiquidityPoolAnalysis & { pairAddress: `0x${string}`; tokenSide: "token0" | "token1" }
    >();

    for (const factory of v2Factories[chain]) {
      for (const quoteToken of factory.quoteTokens) {
        try {
          const pair = await client.readContract?.({
            address: factory.address,
            abi: v2FactoryAbi,
            functionName: "getPair",
            args: [tokenAddress, quoteToken],
          });

          if (typeof pair !== "string" || /^0x0{40}$/i.test(pair)) {
            continue;
          }

          const pairAddress = getAddress(pair) as `0x${string}`;
          const token0 = await client.readContract?.({
            address: pairAddress,
            abi: v2PairAbi,
            functionName: "token0",
          });
          const side =
            typeof token0 === "string" && token0.toLowerCase() === tokenAddress.toLowerCase()
              ? "token0"
              : "token1";

          pools.set(pairAddress.toLowerCase(), {
            dex: factory.name,
            factoryAddress: factory.address,
            pairAddress,
            tokenSide: side,
            mintEventCount: 0,
            providerCount: 0,
          });
        } catch (error) {
          warnings.push(`${factory.name} getPair lookup failed: ${this.errorMessage(error)}`);
        }
      }

      try {
        const token0Logs = await this.scanLogs(client, {
          address: factory.address,
          event: pairCreatedEvent,
          args: { token0: tokenAddress },
        }, fromBlock, toBlock);
        const token1Logs = await this.scanLogs(client, {
          address: factory.address,
          event: pairCreatedEvent,
          args: { token1: tokenAddress },
        }, fromBlock, toBlock);

        for (const log of [...token0Logs, ...token1Logs]) {
          const args = (log as Log & { args?: { pair?: `0x${string}`; token0?: `0x${string}` } }).args;
          if (!args?.pair) continue;

          const pairAddress = getAddress(args.pair) as `0x${string}`;
          const side = args.token0?.toLowerCase() === tokenAddress.toLowerCase() ? "token0" : "token1";
          pools.set(pairAddress.toLowerCase(), {
            dex: factory.name,
            factoryAddress: factory.address,
            pairAddress,
            tokenSide: side,
            mintEventCount: 0,
            providerCount: 0,
            firstBlock: log.blockNumber?.toString(),
            lastBlock: log.blockNumber?.toString(),
          });
        }
      } catch (error) {
        warnings.push(`${factory.name} PairCreated scan failed: ${this.errorMessage(error)}`);
      }
    }

    return [...pools.values()];
  }

  private async buildLiquidityAnalysis(
    client: ChainClient,
    chain: ChainKey,
    tokenAddress: `0x${string}`,
    fromBlock: bigint,
    toBlock: bigint,
    pools: LiquidityPoolAnalysis[],
    warnings: string[],
  ): Promise<TokenLiquidityAnalysis> {
    const walletMap = new Map<
      string,
      {
        address: `0x${string}`;
        poolAddresses: Set<`0x${string}`>;
        addLiquidityTxs: Set<`0x${string}`>;
        firstBlock?: bigint;
        lastBlock?: bigint;
      }
    >();
    const poolWallets = new Map<string, Set<`0x${string}`>>();
    const txWallets = new Map<string, Set<`0x${string}`>>();

    for (const pool of pools) {
      try {
        const logs = await this.scanLogs(client, {
          address: pool.pairAddress,
          event: mintEvent,
        }, fromBlock, toBlock);
        const providers = new Set<`0x${string}`>();

        for (const log of logs) {
          const txHash = log.transactionHash;
          if (!txHash) continue;

          let wallet: `0x${string}` | undefined;
          try {
            wallet = client.getTransaction
              ? getAddress((await client.getTransaction({ hash: txHash })).from) as `0x${string}`
              : undefined;
          } catch (error) {
            warnings.push(`Unable to resolve tx.from for ${txHash}: ${this.errorMessage(error)}`);
          }

          if (!wallet) {
            const args = (log as Log & { args?: { sender?: `0x${string}` } }).args;
            wallet = args?.sender ? getAddress(args.sender) as `0x${string}` : undefined;
          }

          if (!wallet) continue;

          const key = wallet.toLowerCase();
          const record = walletMap.get(key) ?? {
            address: wallet,
            poolAddresses: new Set<`0x${string}`>(),
            addLiquidityTxs: new Set<`0x${string}`>(),
          };
          record.poolAddresses.add(pool.pairAddress);
          record.addLiquidityTxs.add(txHash);
          if (log.blockNumber !== undefined && log.blockNumber !== null) {
            record.firstBlock =
              record.firstBlock === undefined || log.blockNumber < record.firstBlock
                ? log.blockNumber
                : record.firstBlock;
            record.lastBlock =
              record.lastBlock === undefined || log.blockNumber > record.lastBlock
                ? log.blockNumber
                : record.lastBlock;
          }
          walletMap.set(key, record);
          providers.add(wallet);

          const txKey = txHash.toLowerCase();
          const txSet = txWallets.get(txKey) ?? new Set<`0x${string}`>();
          txSet.add(wallet);
          txWallets.set(txKey, txSet);
        }

        pool.mintEventCount = logs.length;
        pool.providerCount = providers.size;
        pool.firstBlock = logs[0]?.blockNumber?.toString() ?? pool.firstBlock;
        pool.lastBlock = logs.at(-1)?.blockNumber?.toString() ?? pool.lastBlock;
        poolWallets.set(pool.pairAddress.toLowerCase(), providers);
      } catch (error) {
        warnings.push(`Mint scan failed for ${pool.dex} ${pool.pairAddress}: ${this.errorMessage(error)}`);
      }
    }

    const totalSupply = await this.readTokenTotalSupply(client, tokenAddress, warnings);
    const decimals = await this.readTokenDecimals(client, tokenAddress, warnings);
    const relationEdges = this.buildRelations(poolWallets, txWallets, walletMap);
    const relationLookup = new Map<string, WalletRelationEdge[]>();

    for (const edge of relationEdges) {
      const sourceKey = edge.source.toLowerCase();
      const targetKey = edge.target.toLowerCase();
      relationLookup.set(sourceKey, [...(relationLookup.get(sourceKey) ?? []), edge]);
      relationLookup.set(targetKey, [
        ...(relationLookup.get(targetKey) ?? []),
        {
          ...edge,
          source: edge.target,
          target: edge.source,
        },
      ]);
    }

    const wallets: LiquidityProviderWallet[] = [];
    for (const record of walletMap.values()) {
      const balance = await this.readTokenBalance(client, tokenAddress, record.address, warnings);
      const sharePercent = totalSupply > 0n ? Number((balance * 1_000_000n) / totalSupply) / 10_000 : 0;
      wallets.push({
        address: record.address,
        poolAddresses: [...record.poolAddresses],
        addLiquidityTxs: [...record.addLiquidityTxs],
        firstBlock: record.firstBlock?.toString() ?? "unknown",
        lastBlock: record.lastBlock?.toString() ?? "unknown",
        tokenBalance: decimals === undefined ? balance.toString() : formatUnits(balance, decimals),
        totalSupplySharePercent: sharePercent,
        isMajorHolder: sharePercent >= liquidityHolderThresholdPercent,
        relations: (relationLookup.get(record.address.toLowerCase()) ?? []).map((edge) => ({
          wallet: edge.target,
          relation: edge.relation,
          evidence: edge.evidence,
        })),
      });
    }

    wallets.sort((left, right) => right.totalSupplySharePercent - left.totalSupplySharePercent);

    return {
      id: `${chain}-${tokenAddress.toLowerCase()}-${Date.now()}`,
      chain,
      tokenAddress,
      status: warnings.length > 0 ? "degraded" : "complete",
      thresholdPercent: liquidityHolderThresholdPercent,
      scannedFromBlock: fromBlock.toString(),
      scannedToBlock: toBlock.toString(),
      pools,
      wallets,
      relations: relationEdges,
      warnings,
      updatedAt: new Date().toISOString(),
    };
  }

  private buildRelations(
    poolWallets: Map<string, Set<`0x${string}`>>,
    txWallets: Map<string, Set<`0x${string}`>>,
    walletMap: Map<string, { address: `0x${string}`; poolAddresses: Set<`0x${string}`> }>,
  ) {
    const edges = new Map<string, WalletRelationEdge>();
    const addEdge = (
      left: `0x${string}`,
      right: `0x${string}`,
      relation: WalletRelationEdge["relation"],
      evidence: string,
    ) => {
      if (left.toLowerCase() === right.toLowerCase()) return;
      const [source, target] = [left, right].sort((a, b) => a.localeCompare(b)) as [`0x${string}`, `0x${string}`];
      const key = `${source.toLowerCase()}-${target.toLowerCase()}-${relation}`;
      edges.set(key, { source, target, relation, evidence });
    };

    for (const [pool, wallets] of poolWallets) {
      const list = [...wallets];
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          addEdge(list[i], list[j], "same-pool", `Both added liquidity to pool ${pool}.`);
        }
      }
    }

    for (const [txHash, wallets] of txWallets) {
      const list = [...wallets];
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          addEdge(list[i], list[j], "same-transaction", `Both appear in add-liquidity transaction ${txHash}.`);
        }
      }
    }

    const records = [...walletMap.values()];
    for (let i = 0; i < records.length; i += 1) {
      for (let j = i + 1; j < records.length; j += 1) {
        const overlap = [...records[i].poolAddresses].filter((pool) => records[j].poolAddresses.has(pool));
        if (overlap.length > 1) {
          addEdge(records[i].address, records[j].address, "multi-pool", `Wallets overlap across ${overlap.length} pools.`);
        }
      }
    }

    return [...edges.values()];
  }

  private async readTokenTotalSupply(client: ChainClient, tokenAddress: `0x${string}`, warnings: string[]) {
    try {
      const value = await client.readContract?.({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "totalSupply",
      });
      return typeof value === "bigint" ? value : 0n;
    } catch (error) {
      warnings.push(`Unable to read totalSupply: ${this.errorMessage(error)}`);
      return 0n;
    }
  }

  private async readTokenDecimals(client: ChainClient, tokenAddress: `0x${string}`, warnings: string[]) {
    try {
      const value = await client.readContract?.({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "decimals",
      });
      return typeof value === "number" ? value : undefined;
    } catch (error) {
      warnings.push(`Unable to read decimals: ${this.errorMessage(error)}`);
      return undefined;
    }
  }

  private async readTokenBalance(
    client: ChainClient,
    tokenAddress: `0x${string}`,
    wallet: `0x${string}`,
    warnings: string[],
  ) {
    try {
      const value = await client.readContract?.({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
      });
      return typeof value === "bigint" ? value : 0n;
    } catch (error) {
      warnings.push(`Unable to read balanceOf(${wallet}): ${this.errorMessage(error)}`);
      return 0n;
    }
  }

  private async scanLogs(
    client: ChainClient,
    input: Omit<GetLogsInput, "fromBlock" | "toBlock">,
    fromBlock: bigint,
    toBlock: bigint,
  ) {
    const logs: Log[] = [];
    const chunkSize = BigInt(process.env.LIQUIDITY_LOG_CHUNK_SIZE ?? defaultLogChunkSize.toString());

    for (let cursor = fromBlock; cursor <= toBlock; cursor += chunkSize + 1n) {
      const chunkTo = cursor + chunkSize > toBlock ? toBlock : cursor + chunkSize;
      logs.push(
        ...(await client.getLogs({
          ...input,
          fromBlock: cursor,
          toBlock: chunkTo,
        })),
      );
    }

    return logs;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
  }

  private toEvent(target: WatchTarget, log: Log): ChainEvent {
    const topic0 = log.topics[0];
    const isWatchedTopic = topic0 && target.topics?.includes(topic0);

    return {
      id: `${target.chain}-${log.transactionHash}-${log.logIndex}`,
      projectId: target.projectId,
      chain: target.chain,
      severity: isWatchedTopic ? "watch" : "info",
      source: "rpc",
      signal: isWatchedTopic ? "Transfer" : "Log Match",
      title: `${target.label} emitted ${isWatchedTopic ? "watched transfer" : "log"}`,
      detail: `Address ${target.address} matched at log index ${log.logIndex}.`,
      blockNumber: log.blockNumber?.toString(),
      txHash: log.transactionHash ?? undefined,
      address: log.address,
      timestamp: new Date().toISOString(),
    };
  }

  private setChainStatus(chain: ChainKey, status: DetectorStatus) {
    this.state = {
      ...this.state,
      status: this.state.mode === "live" ? "live" : this.state.status,
      chains: {
        ...this.state.chains,
        [chain]: status,
      },
      updatedAt: new Date().toISOString(),
    };
    this.emit();
  }

  private pushEvent(event: ChainEvent) {
    this.state = {
      ...this.state,
      events: [event, ...this.state.events].slice(0, 80),
      updatedAt: new Date().toISOString(),
    };
    this.emit(event);
  }

  private emit(event?: ChainEvent) {
    for (const listener of this.listeners) {
      listener(this.state, event);
    }
  }
}
