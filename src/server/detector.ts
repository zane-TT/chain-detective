import { createPublicClient, getAddress, http, isAddress, type Log, type PublicClient } from "viem";
import { bsc, mainnet } from "viem/chains";
import { chains } from "../shared/chainConfig.js";
import { nexProject, seedEvents } from "../shared/seedData.js";
import type {
  ChainConfig,
  ChainEvent,
  ChainKey,
  DetectorState,
  DetectorStatus,
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

const pollIntervalMs = 8_000;

function resolveRpcUrl(chain: ChainConfig) {
  return process.env[chain.rpcEnv] || chain.publicRpcUrl;
}

type GetLogsInput = {
  address: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  event?: undefined;
  args?: undefined;
};
type ChainClient = {
  getBlockNumber: () => Promise<bigint>;
  getLogs: (input: GetLogsInput) => Promise<Log[]>;
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
        }) as ChainClient);
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
