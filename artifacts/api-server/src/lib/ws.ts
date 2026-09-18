import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger";
import { db, liveCallsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const subscribers = new Map<number, Set<WebSocket>>();
const callSubscribers = new Map<number, Set<WebSocket>>();
const callRoles = new WeakMap<WebSocket, "admin" | "user">();

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

    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as {
          type?: string;
          orderId?: unknown;
          callId?: unknown;
          signalToken?: unknown;
          role?: unknown;
          payload?: unknown;
        };
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
        if (data.type === "call-join" && typeof data.callId === "number" && typeof data.signalToken === "string" && (data.role === "admin" || data.role === "user")) {
          const [call] = await db
            .select({ signalToken: liveCallsTable.signalToken, status: liveCallsTable.status })
            .from(liveCallsTable)
            .where(eq(liveCallsTable.id, data.callId))
            .limit(1);
          if (!call || !call.signalToken || call.signalToken !== data.signalToken || !["ringing", "active"].includes(call.status)) {
            ws.send(JSON.stringify({ type: "call-error", message: "This call is not available." }));
            return;
          }
          const current = callSubscribers.get(data.callId) ?? new Set<WebSocket>();
          current.add(ws);
          callSubscribers.set(data.callId, current);
          callRoles.set(ws, data.role);
          ws.send(JSON.stringify({ type: "call-joined", callId: data.callId }));
          for (const peer of current) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify({ type: "call-peer-joined", callId: data.callId }));
            }
          }
          logger.debug({ callId: data.callId, role: data.role }, "WS: call participant joined");
        }
        if (data.type === "call-signal" && typeof data.callId === "number" && data.payload && callSubscribers.has(data.callId)) {
          const senderRole = callRoles.get(ws);
          for (const peer of callSubscribers.get(data.callId) ?? []) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify({ type: "call-signal", callId: data.callId, from: senderRole, payload: data.payload }));
            }
          }
        }
        if (data.type === "call-leave" && typeof data.callId === "number") {
          removeCallSubscriber(data.callId, ws);
          for (const peer of callSubscribers.get(data.callId) ?? []) {
            if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ type: "call-ended", callId: data.callId }));
          }
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
      for (const [callId, clients] of callSubscribers) {
        if (clients.has(ws)) {
          removeCallSubscriber(callId, ws);
          for (const peer of clients) {
            if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ type: "call-peer-left", callId }));
          }
        }
      }
    });

    ws.on("error", () => ws.terminate());
  });

  logger.info("WS server attached at /api/ws");
}

function removeCallSubscriber(callId: number, ws: WebSocket) {
  const clients = callSubscribers.get(callId);
  if (!clients) return;
  clients.delete(ws);
  if (clients.size === 0) callSubscribers.delete(callId);
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
