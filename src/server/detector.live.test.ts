import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createPublicClient, http, type Log } from "viem";
import { bsc } from "viem/chains";
import { ChainDetector } from "./detector.js";
import type { ChainConfig, ChainEvent } from "../shared/types.js";

const watchedAddress = "0x67de2c572fe83c2ff21452f9e7f64b1ac1be7777";
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const rpcUrl = process.env.BSC_RPC_URL || "https://bsc-dataseed-public.bnbchain.org";
const lookbackBlocks = BigInt(process.env.LIVE_BSC_LOOKBACK_BLOCKS ?? "20000");
const chunkSize = BigInt(process.env.LIVE_BSC_CHUNK_BLOCKS ?? "100");

const liveBscChain: ChainConfig = {
  key: "bsc",
  label: "BNB Smart Chain",
  chainId: 56,
  rpcEnv: "BSC_RPC_URL",
  publicRpcUrl: rpcUrl,
  nativeSymbol: "BNB",
};

const detectors: ChainDetector[] = [];

after(() => {
  for (const detector of detectors) {
    detector.stop();
  }
});

async function findRecentLiveLog(client: ReturnType<typeof createPublicClient>) {
  const latestBlock = await client.getBlockNumber();
  const minBlock = latestBlock > lookbackBlocks ? latestBlock - lookbackBlocks : 0n;
  let currentChunkSize = chunkSize;
  let toBlock = latestBlock;

  while (toBlock >= minBlock) {
    const fromBlock = toBlock > currentChunkSize ? toBlock - currentChunkSize : minBlock;
    let logs: Log[];

    try {
      logs = (await client.getLogs({
        address: watchedAddress,
        fromBlock,
        toBlock,
      })) as Log[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("limit exceeded") && currentChunkSize > 10n) {
        currentChunkSize = currentChunkSize / 2n;
        continue;
      }

      throw error;
    }

    if (logs.length > 0) {
      return logs[logs.length - 1];
    }

    if (fromBlock === minBlock) {
      break;
    }

    toBlock = fromBlock - 1n;
  }

  throw new Error(
    `No live logs found for ${watchedAddress} in the last ${lookbackBlocks.toString()} BSC blocks.`,
  );
}

test("live BSC RPC monitors the requested address with real on-chain logs", { skip: !process.env.RUN_LIVE_BSC_TESTS }, async () => {
  const client = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl),
  });

  const liveLog = await findRecentLiveLog(client);
  assert.ok(liveLog.blockNumber, "Live log must include a block number.");

  const detector = new ChainDetector({
    chainConfigs: [liveBscChain],
    initialLatestBlocks: {
      bsc: liveLog.blockNumber - 1n,
    },
    pollIntervalMs: 60_000,
    createClient: () => ({
      getBlockNumber: async () => liveLog.blockNumber!,
      getLogs: (input) => client.getLogs(input) as Promise<Log[]>,
    }),
  });
  detectors.push(detector);

  detector.addTokenTarget({
    chain: "bsc",
    address: watchedAddress,
    label: "Live requested token",
  });

  const matchedEvent = new Promise<ChainEvent>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for live matched event.")), 10_000);
    const expectedEventId = `bsc-${liveLog.transactionHash}-${liveLog.logIndex}`;
    const unsubscribe = detector.subscribe((_state, event) => {
      if (
        event?.source === "rpc" &&
        event.address?.toLowerCase() === watchedAddress &&
        event.blockNumber === liveLog.blockNumber?.toString() &&
        event.txHash === liveLog.transactionHash &&
        event.id === expectedEventId
      ) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      }
    });
  });

  detector.start();
  const event = await matchedEvent;

  assert.equal(event.address?.toLowerCase(), watchedAddress);
  assert.equal(event.blockNumber, liveLog.blockNumber.toString());
  assert.equal(event.txHash, liveLog.transactionHash);

  if (liveLog.topics[0] === transferTopic) {
    assert.equal(event.signal, "Transfer");
    assert.equal(event.severity, "watch");
  } else {
    assert.equal(event.signal, "Log Match");
    assert.equal(event.severity, "info");
  }
});
