import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { Log } from "viem";
import { ChainDetector } from "./detector.js";
import type { ChainConfig, ChainEvent } from "../shared/types.js";

const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const watchedAddress = "0x67de2c572fe83c2ff21452f9e7f64b1ac1be7777";

const testChain: ChainConfig = {
  key: "bsc",
  label: "BNB Smart Chain",
  chainId: 56,
  rpcEnv: "TEST_BSC_RPC_URL",
  publicRpcUrl: "mock://bsc",
  nativeSymbol: "BNB",
};

const detectors: ChainDetector[] = [];

after(() => {
  for (const detector of detectors) {
    detector.stop();
  }
});

test("monitors the requested token address and emits Transfer matches", async () => {
  let blockNumber = 100n;
  const scannedAddresses: string[] = [];
  const detector = new ChainDetector({
    chainConfigs: [testChain],
    pollIntervalMs: 10,
    createClient: () => ({
      getBlockNumber: async () => blockNumber++,
      getLogs: async ({ address, fromBlock, toBlock, event }) => {
        scannedAddresses.push(address.toLowerCase());

        if (address.toLowerCase() !== watchedAddress) {
          return [];
        }

        assert.equal(event?.name, "Transfer");
        assert.equal(fromBlock, 101n);
        assert.equal(toBlock, 101n);

        return [
          {
            address,
            blockNumber: 101n,
            transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            logIndex: 0,
            topics: [transferTopic],
            data: "0x",
            blockHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            transactionIndex: 0,
            removed: false,
          } satisfies Log,
        ];
      },
    }),
  });
  detectors.push(detector);

  const target = detector.addTokenTarget({
    chain: "bsc",
    address: watchedAddress,
    label: "Requested token",
  });

  assert.equal(target.address.toLowerCase(), watchedAddress);
  assert.deepEqual(target.topics, [transferTopic]);

  const matchedEvent = new Promise<ChainEvent>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for watched Transfer event.")), 500);
    const unsubscribe = detector.subscribe((_state, event) => {
      if (event?.source === "rpc" && event.address?.toLowerCase() === watchedAddress) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      }
    });
  });

  detector.start();

  const event = await matchedEvent;

  assert.equal(event.signal, "Transfer");
  assert.equal(event.severity, "watch");
  assert.equal(event.blockNumber, "101");
  assert.equal(event.txHash, "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  assert.ok(scannedAddresses.includes(watchedAddress));
});

test("immediately scans an EVM token added after live polling has connected", async () => {
  const token = "0x7777777777777777777777777777777777777777";
  const txHash = "0x7777777777777777777777777777777777777777777777777777777777777777";
  const scannedRanges: Array<{ address: string; fromBlock: bigint; toBlock: bigint }> = [];
  const detector = new ChainDetector({
    chainConfigs: [testChain],
    pollIntervalMs: 60_000,
    createClient: () => ({
      getBlockNumber: async () => 500n,
      getLogs: async ({ address, fromBlock, toBlock }) => {
        scannedRanges.push({ address: address.toLowerCase(), fromBlock, toBlock });

        if (address.toLowerCase() !== token) {
          return [];
        }

        return [
          {
            address,
            blockNumber: 500n,
            transactionHash: txHash,
            logIndex: 2,
            topics: [transferTopic],
            data: "0x",
            blockHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
            transactionIndex: 0,
            removed: false,
          } satisfies Log,
        ];
      },
    }),
  });
  detectors.push(detector);

  const connected = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for live polling.")), 500);
    const unsubscribe = detector.subscribe((state) => {
      if (state.chains.bsc === "live") {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });

  detector.start();
  await connected;

  const matchedEvent = new Promise<ChainEvent>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for immediate watched Transfer event.")), 500);
    const unsubscribe = detector.subscribe((_state, event) => {
      if (event?.source === "rpc" && event.txHash === txHash) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      }
    });
  });

  detector.addTokenTarget({
    chain: "bsc",
    address: token,
    label: "Late token",
  });

  const event = await matchedEvent;

  assert.equal(event.signal, "Transfer");
  assert.equal(event.severity, "watch");
  assert.equal(event.blockNumber, "500");
  assert.deepEqual(scannedRanges.at(-1), { address: token, fromBlock: 500n, toBlock: 500n });
});

test("monitors an Ethereum contract address on the matching chain only", async () => {
  const ethereumAddress = "0x8888888888888888888888888888888888888888";
  const txHash = "0x8888888888888888888888888888888888888888888888888888888888888888";
  const scanned: Array<{ chain: string; address: string }> = [];
  const ethereumChain: ChainConfig = {
    key: "ethereum",
    label: "Ethereum",
    chainId: 1,
    rpcEnv: "TEST_ETH_RPC_URL",
    publicRpcUrl: "mock://ethereum",
    nativeSymbol: "ETH",
  };
  const detector = new ChainDetector({
    chainConfigs: [testChain, ethereumChain],
    pollIntervalMs: 10,
    initialLatestBlocks: {
      ethereum: 1000n,
      bsc: 1000n,
    },
    createClient: (chain) => ({
      getBlockNumber: async () => 1001n,
      getLogs: async ({ address }) => {
        scanned.push({ chain: chain.key, address: address.toLowerCase() });

        if (chain.key !== "ethereum" || address.toLowerCase() !== ethereumAddress) {
          return [];
        }

        return [
          {
            address,
            blockNumber: 1001n,
            transactionHash: txHash,
            logIndex: 0,
            topics: [transferTopic],
            data: "0x",
            blockHash: "0x8888888888888888888888888888888888888888888888888888888888888888",
            transactionIndex: 0,
            removed: false,
          } satisfies Log,
        ];
      },
    }),
  });
  detectors.push(detector);

  detector.addTokenTarget({
    chain: "ethereum",
    address: ethereumAddress,
    label: "Ethereum token",
  });

  const matchedEvent = new Promise<ChainEvent>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for Ethereum Transfer event.")), 500);
    const unsubscribe = detector.subscribe((_state, event) => {
      if (event?.txHash === txHash) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      }
    });
  });

  detector.start();

  const event = await matchedEvent;

  assert.equal(event.chain, "ethereum");
  assert.equal(event.signal, "Transfer");
  assert.ok(scanned.some((item) => item.chain === "ethereum" && item.address === ethereumAddress));
  assert.ok(!scanned.some((item) => item.chain === "bsc" && item.address === ethereumAddress));
});

test("continues monitoring requested EVM contracts when another target scan fails", async () => {
  const token = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const detector = new ChainDetector({
    chainConfigs: [testChain],
    pollIntervalMs: 60_000,
    initialLatestBlocks: {
      bsc: 300n,
    },
    createClient: () => ({
      getBlockNumber: async () => 301n,
      getLogs: async ({ address, event }) => {
        if (address.toLowerCase() !== token) {
          throw new Error("seed target RPC timed out");
        }

        assert.equal(event?.name, "Transfer");

        return [
          {
            address,
            blockNumber: 301n,
            transactionHash: txHash,
            logIndex: 0,
            topics: [transferTopic],
            data: "0x",
            blockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            transactionIndex: 0,
            removed: false,
          } satisfies Log,
        ];
      },
    }),
  });
  detectors.push(detector);

  detector.addTokenTarget({
    chain: "bsc",
    address: token,
    label: "Requested resilient token",
  });

  const matchedEvent = new Promise<ChainEvent>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for resilient Transfer event.")), 500);
    const unsubscribe = detector.subscribe((_state, event) => {
      if (event?.txHash === txHash) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      }
    });
  });

  detector.start();

  const event = await matchedEvent;

  assert.equal(event.signal, "Transfer");
  assert.equal(event.severity, "watch");
});

test("emits informational log matches for watched EVM targets without topic filters", async () => {
  const token = "0x9999999999999999999999999999999999999999";
  const txHash = "0x9999999999999999999999999999999999999999999999999999999999999999";
  const detector = new ChainDetector({
    chainConfigs: [testChain],
    pollIntervalMs: 10,
    initialLatestBlocks: {
      bsc: 200n,
    },
    createClient: () => ({
      getBlockNumber: async () => 201n,
      getLogs: async ({ address, event }) => {
        assert.equal(event, undefined);

        if (address.toLowerCase() !== token) {
          return [];
        }

        return [
          {
            address,
            blockNumber: 201n,
            transactionHash: txHash,
            logIndex: 3,
            topics: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
            data: "0x",
            blockHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
            transactionIndex: 0,
            removed: false,
          } satisfies Log,
        ];
      },
    }),
  });
  detectors.push(detector);

  detector.getState().projects[0].contracts.push({
    id: "generic-log-target",
    projectId: "nexus-nex",
    chain: "bsc",
    label: "Generic log target",
    address: token,
    kind: "hook",
  });

  const matchedEvent = new Promise<ChainEvent>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for generic log event.")), 500);
    const unsubscribe = detector.subscribe((_state, event) => {
      if (event?.txHash === txHash) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      }
    });
  });

  detector.start();

  const event = await matchedEvent;

  assert.equal(event.signal, "Log Match");
  assert.equal(event.severity, "info");
  assert.equal(event.address?.toLowerCase(), token);
});

test("summarizes watched targets and event severities", () => {
  const detector = new ChainDetector();
  const initialSummary = detector.getSummary();

  detector.addTokenTarget({
    chain: "bsc",
    address: "0x5555555555555555555555555555555555555555",
  });

  const summary = detector.getSummary();

  assert.equal(summary.projectCount, initialSummary.projectCount);
  assert.equal(summary.watchedTargetCount, initialSummary.watchedTargetCount + 1);
  assert.equal(summary.tokenTargetCount, initialSummary.tokenTargetCount + 1);
  assert.equal(summary.eventCount, initialSummary.eventCount + 1);
  assert.equal(summary.eventsBySeverity.watch, initialSummary.eventsBySeverity.watch + 1);
  assert.ok(summary.latestEventAt);
});

test("exposes a lightweight health snapshot", () => {
  const detector = new ChainDetector();
  const health = detector.getHealth();

  assert.equal(health.ok, true);
  assert.equal(health.mode, "demo");
  assert.equal(health.status, "demo");
  assert.deepEqual(health.chainStatuses, { bsc: "demo", ethereum: "demo" });
  assert.ok(health.updatedAt);
});

test("filters events by chain and severity with a bounded limit", () => {
  const detector = new ChainDetector();

  detector.addTokenTarget({
    chain: "bsc",
    address: "0x6666666666666666666666666666666666666666",
    label: "Filter token",
  });

  const watchEvents = detector.getEvents({ chain: "bsc", severity: "watch", limit: 1 });

  assert.equal(watchEvents.length, 1);
  assert.equal(watchEvents[0].chain, "bsc");
  assert.equal(watchEvents[0].severity, "watch");
});

test("analyzes V2 liquidity wallets and flags holders above threshold", async () => {
  const token = "0x1111111111111111111111111111111111111111";
  const pair = "0x2222222222222222222222222222222222222222";
  const walletA = "0x3333333333333333333333333333333333333333";
  const walletB = "0x4444444444444444444444444444444444444444";
  const txA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const txB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  const detector = new ChainDetector({
    chainConfigs: [testChain],
    createClient: () => ({
      getBlockNumber: async () => 100n,
      getLogs: async ({ address, event }) => {
        if (address.toLowerCase() !== pair || !event) {
          return [];
        }

        return [
          {
            address,
            blockNumber: 80n,
            transactionHash: txA,
            logIndex: 0,
            topics: [],
            data: "0x",
            blockHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
            transactionIndex: 0,
            removed: false,
          },
          {
            address,
            blockNumber: 90n,
            transactionHash: txB,
            logIndex: 1,
            topics: [],
            data: "0x",
            blockHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
            transactionIndex: 0,
            removed: false,
          },
        ] satisfies Log[];
      },
      getTransaction: async ({ hash }) => ({
        from: hash === txA ? walletA : walletB,
      }),
      readContract: async ({ address, functionName, args }) => {
        if (functionName === "getPair" && address === "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73") {
          return pair;
        }
        if (functionName === "getPair") {
          return "0x0000000000000000000000000000000000000000";
        }
        if (functionName === "token0") {
          return token;
        }
        if (functionName === "totalSupply") {
          return 1000n;
        }
        if (functionName === "decimals") {
          return 0;
        }
        if (functionName === "balanceOf") {
          return args[0] === walletA ? 2n : 1n;
        }
        return 0n;
      },
    }),
  });

  const analysis = await detector.analyzeTokenLiquidity({
    chain: "bsc",
    address: token,
  });

  assert.equal(analysis.pools.length, 1);
  assert.equal(analysis.wallets.length, 2);
  assert.equal(analysis.wallets[0].address, walletA);
  assert.equal(analysis.wallets[0].isMajorHolder, true);
  assert.equal(analysis.wallets[0].totalSupplySharePercent, 0.2);
  assert.equal(analysis.wallets[1].isMajorHolder, true);
  assert.equal(analysis.wallets[1].totalSupplySharePercent, 0.1);
  assert.equal(detector.getState().liquidityAnalyses[0].tokenAddress, token);
});

test("reports degraded globally when any live chain polling fails", async () => {
  const ethereumChain: ChainConfig = {
    key: "ethereum",
    label: "Ethereum",
    chainId: 1,
    rpcEnv: "TEST_ETH_RPC_URL",
    publicRpcUrl: "mock://ethereum",
    nativeSymbol: "ETH",
  };
  const detector = new ChainDetector({
    chainConfigs: [testChain, ethereumChain],
    pollIntervalMs: 10,
    createClient: (chain) => ({
      getBlockNumber: async () => {
        if (chain.key === "ethereum") {
          throw new Error("RPC unavailable");
        }

        return 100n;
      },
      getLogs: async () => [],
    }),
  });
  detectors.push(detector);

  const degradedState = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for degraded status.")), 500);
    const unsubscribe = detector.subscribe((state) => {
      if (state.chains.ethereum === "degraded") {
        clearTimeout(timeout);
        unsubscribe();
        assert.equal(state.status, "degraded");
        assert.equal(state.chains.bsc, "live");
        resolve();
      }
    });
  });

  detector.start();

  await degradedState;
});
