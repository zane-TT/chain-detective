import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { z } from "zod";
import { ChainDetector } from "./detector.js";

const app = Fastify({ logger: true });
const detector = new ChainDetector();
const watchTokenSchema = z.object({
  chain: z.enum(["bsc", "ethereum"]),
  address: z.string(),
  label: z.string().optional(),
});
const analyzeLiquiditySchema = z.object({
  chain: z.enum(["bsc", "ethereum"]),
  address: z.string(),
});

await app.register(cors, {
  origin: true,
});
await app.register(websocket);

app.get("/api/status", async () => detector.getState());

app.get("/api/summary", async () => detector.getSummary());

app.post("/api/watch-token", async (request, reply) => {
  const parsed = watchTokenSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ message: "Invalid watch token request." });
  }

  try {
    const target = detector.addTokenTarget(parsed.data);
    return { target, state: detector.getState() };
  } catch (error) {
    return reply.code(400).send({
      message: error instanceof Error ? error.message : "Unable to add token address.",
    });
  }
});

app.post("/api/analyze-liquidity", async (request, reply) => {
  const parsed = analyzeLiquiditySchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ message: "Invalid liquidity analysis request." });
  }

  try {
    const analysis = await detector.analyzeTokenLiquidity(parsed.data);
    return { analysis, state: detector.getState() };
  } catch (error) {
    return reply.code(400).send({
      message: error instanceof Error ? error.message : "Unable to analyze token liquidity.",
    });
  }
});

app.get("/stream", { websocket: true }, (socket) => {
  const unsubscribe = detector.subscribe((state, event) => {
    socket.send(JSON.stringify({ type: event ? "event" : "state", state, event }));
  });

  socket.on("close", unsubscribe);
});

const port = Number(process.env.PORT ?? 8787);

detector.start();

try {
  await app.listen({ host: "127.0.0.1", port });
} catch (error) {
  detector.stop();
  app.log.error(error);
  process.exit(1);
}
