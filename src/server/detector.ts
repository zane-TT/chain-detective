import { createPublicClient, http, type Log, type PublicClient } from "viem";
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

const pollIntervalMs = 8_000;

export class ChainDetector {
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

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  start() {
    const liveChains = chains.filter((chain) => Boolean(process.env[chain.rpcEnv]));

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
    const rpcUrl = process.env[chain.rpcEnv];
    if (!rpcUrl) return;

    const client = createPublicClient({
      chain: viemChains[chain.key],
      transport: http(rpcUrl),
    });

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
    const timer = setInterval(() => void tick(), pollIntervalMs);
    this.timers.push(timer);
  }

  private async pollChain(chain: ChainConfig, client: PublicClient) {
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

    const targets = nexProject.contracts.filter((target) => target.chain === chain.key);
    await Promise.all(
      targets.map((target) =>
        this.scanTargetLogs(client, target, previous + 1n, blockNumber),
      ),
    );
  }

  private async scanTargetLogs(
    client: PublicClient,
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
