import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger";

const subscribers = new Map<number, Set<WebSocket>>();

export function attachWss(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    if (!url.startsWith("/api/ws")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    let subscribedOrderId: number | null = null;

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as { type?: string; orderId?: unknown };
        if (data.type === "subscribe" && typeof data.orderId === "number") {
          if (subscribedOrderId !== null) {
            subscribers.get(subscribedOrderId)?.delete(ws);
          }
          subscribedOrderId = data.orderId;
          if (!subscribers.has(subscribedOrderId)) {
            subscribers.set(subscribedOrderId, new Set());
          }
          subscribers.get(subscribedOrderId)!.add(ws);
          ws.send(JSON.stringify({ type: "subscribed", orderId: subscribedOrderId }));
          logger.debug({ orderId: subscribedOrderId }, "WS: client subscribed to order");
        }
      } catch { /* ignore parse errors */ }
    });

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 25_000);

    ws.on("close", () => {
      clearInterval(pingInterval);
      if (subscribedOrderId !== null) {
        const set = subscribers.get(subscribedOrderId);
        set?.delete(ws);
        if (set?.size === 0) subscribers.delete(subscribedOrderId);
      }
    });

    ws.on("error", () => ws.terminate());
  });

  logger.info("WS server attached at /api/ws");
}

export function notifyOrderUpdate(orderId: number, payload: Record<string, unknown>): void {
  const clients = subscribers.get(orderId);
  if (!clients || clients.size === 0) return;
  const msg = JSON.stringify({ ...payload, orderId });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
  logger.debug({ orderId, clients: clients.size }, "WS: pushed order update");
}
