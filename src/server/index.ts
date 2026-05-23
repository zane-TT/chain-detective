import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { ChainDetector } from "./detector.js";

const app = Fastify({ logger: true });
const detector = new ChainDetector();

await app.register(cors, {
  origin: true,
});
await app.register(websocket);

app.get("/api/status", async () => detector.getState());

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
