import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, inArray, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { db, liveCallPresenceTable, liveCallSignalsTable, liveCallsTable, liveChatSessionsTable, usersTable } from "@workspace/db";
import { checkAdminPassword } from "../lib/admin-settings";
import { sendIncomingCallPush } from "../lib/onesignal";

const router: IRouter = Router();
const ACTIVE_CALL_STATUSES = ["queued", "ringing", "active"] as const;
const JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";
const PRESENCE_WINDOW_MS = 20_000;

type CallStatus = "queued" | "ringing" | "active" | "completed" | "cancelled";

function createSignalToken() {
  return randomBytes(24).toString("hex");
}

function getAuthenticatedUser(req: import("express").Request) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

function canAccessCall(
  call: typeof liveCallsTable.$inferSelect,
  req: import("express").Request,
  visitorId: string,
) {
  if (call.targetUserId !== null) {
    return getAuthenticatedUser(req)?.userId === call.targetUserId;
  }
  return Boolean(visitorId && call.visitorId === visitorId);
}

async function authenticateAdmin(req: import("express").Request, res: import("express").Response) {
  const password = req.headers["x-admin-password"];
  if (typeof password !== "string" || !(await checkAdminPassword(password))) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function getQueuePosition(callId: number): Promise<number | null> {
  const queued = await db
    .select({ id: liveCallsTable.id })
    .from(liveCallsTable)
    .where(eq(liveCallsTable.status, "queued"))
    .orderBy(asc(liveCallsTable.queuedAt), asc(liveCallsTable.id));
  const index = queued.findIndex((call) => call.id === callId);
  return index === -1 ? null : index + 1;
}

async function presentCall(call: typeof liveCallsTable.$inferSelect) {
  return {
    ...call,
    position: call.status === "queued" ? await getQueuePosition(call.id) : null,
    signalToken: call.signalToken,
  };
}

async function findVisitorCall(visitorId: string) {
  const rows = await db
    .select()
    .from(liveCallsTable)
    .where(and(eq(liveCallsTable.visitorId, visitorId), inArray(liveCallsTable.status, [...ACTIVE_CALL_STATUSES])))
    .orderBy(desc(liveCallsTable.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

async function touchPresence(actorKey: string, role: "admin" | "user") {
  await db
    .insert(liveCallPresenceTable)
    .values({ actorKey, role, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: liveCallPresenceTable.actorKey,
      set: { role, lastSeenAt: new Date() },
    });
}

async function isOnline(actorKey: string) {
  const [presence] = await db
    .select({ lastSeenAt: liveCallPresenceTable.lastSeenAt })
    .from(liveCallPresenceTable)
    .where(eq(liveCallPresenceTable.actorKey, actorKey))
    .limit(1);
  return Boolean(presence && Date.now() - presence.lastSeenAt.getTime() < PRESENCE_WINDOW_MS);
}

router.post("/calls", async (req, res) => {
  try {
    const visitorId = String(req.body?.visitorId ?? "").trim();
    if (!visitorId || visitorId.length > 160) {
      res.status(400).json({ error: "visitorId is required" });
      return;
    }

    const existing = await findVisitorCall(visitorId);
    if (existing) {
      res.json(await presentCall(existing));
      return;
    }

    const [call] = await db
      .insert(liveCallsTable)
      .values({
        visitorId,
        callerName: typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 120) || null : null,
        callerEmail: typeof req.body?.email === "string" ? req.body.email.trim().slice(0, 200) || null : null,
        callerPhone: typeof req.body?.phone === "string" ? req.body.phone.trim().slice(0, 40) || null : null,
        userId: getAuthenticatedUser(req)?.userId ?? null,
        callerLabel: "GSM UNLOCK",
        direction: "user_to_admin",
        signalToken: createSignalToken(),
        status: await isOnline("admin") ? "ringing" : "queued",
      })
      .returning();

    res.status(201).json(await presentCall(call));
  } catch (err) {
    req.log.error({ err }, "Failed to create live call request");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/calls/:id", async (req, res) => {
  try {
    if (req.params.id === "history") {
      const user = getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const calls = await db
        .select()
        .from(liveCallsTable)
        .where(or(eq(liveCallsTable.userId, user.userId), eq(liveCallsTable.targetUserId, user.userId)))
        .orderBy(desc(liveCallsTable.queuedAt), desc(liveCallsTable.id))
        .limit(100);
      res.json(calls);
      return;
    }
    if (req.params.id === "incoming") {
      const user = getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({ error: "Sign in to receive direct calls." });
        return;
      }
      await touchPresence(`user:${user.userId}`, "user");
      const calls = await db
        .select()
        .from(liveCallsTable)
        .where(and(eq(liveCallsTable.targetUserId, user.userId), inArray(liveCallsTable.status, ["queued", "ringing", "active"])))
        .orderBy(desc(liveCallsTable.updatedAt))
        .limit(1);
      if (calls[0]?.status === "queued") {
        const [promoted] = await db
          .update(liveCallsTable)
          .set({ status: "ringing", updatedAt: new Date() })
          .where(and(eq(liveCallsTable.id, calls[0].id), eq(liveCallsTable.status, "queued")))
          .returning();
        res.json(promoted ? await presentCall(promoted) : await presentCall(calls[0]));
        return;
      }
      res.json(calls.length ? await presentCall(calls[0]) : null);
      return;
    }
    const id = Number(req.params.id);
    const visitorId = String(req.query.visitorId ?? "").trim();
    if (!id || !visitorId) {
      res.status(400).json({ error: "Call id and visitorId are required" });
      return;
    }

    const [call] = await db.select().from(liveCallsTable).where(eq(liveCallsTable.id, id)).limit(1);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (!canAccessCall(call, req, visitorId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(await presentCall(call));
  } catch (err) {
    req.log.error({ err }, "Failed to get live call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/calls/:id/accept", async (req, res) => {
  try {
    const user = getAuthenticatedUser(req);
    const id = Number(req.params.id);
    if (!user || !id) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const [call] = await db.select().from(liveCallsTable).where(eq(liveCallsTable.id, id)).limit(1);
    if (!call || call.targetUserId !== user.userId || call.status !== "ringing") {
      res.status(404).json({ error: "Incoming call not found" });
      return;
    }
    const [updated] = await db
      .update(liveCallsTable)
      .set({ status: "active", acceptedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(liveCallsTable.id, id), eq(liveCallsTable.status, "ringing")))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "This call was accepted by another participant." });
      return;
    }
    res.json(await presentCall(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to accept incoming call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/calls/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visitorId = String(req.query.visitorId ?? "").trim();
    const [call] = await db
      .select()
      .from(liveCallsTable)
      .where(eq(liveCallsTable.id, id))
      .limit(1);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (!canAccessCall(call, req, visitorId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (call.status !== "queued" && call.status !== "ringing") {
      res.status(409).json({ error: "This call can no longer be declined" });
      return;
    }

    const [updated] = await db
      .update(liveCallsTable)
      .set({ status: "cancelled", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(liveCallsTable.id, id))
      .returning();
    res.json(await presentCall(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to cancel live call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/calls/:id/hangup", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visitorId = String(req.body?.visitorId ?? req.query.visitorId ?? "").trim();
    const [call] = await db.select().from(liveCallsTable).where(eq(liveCallsTable.id, id)).limit(1);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (!canAccessCall(call, req, visitorId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!ACTIVE_CALL_STATUSES.includes(call.status as (typeof ACTIVE_CALL_STATUSES)[number])) {
      res.status(409).json({ error: "Call is no longer active" });
      return;
    }

    const [updated] = await db
      .update(liveCallsTable)
      .set({ status: "completed", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(liveCallsTable.id, id))
      .returning();
    if (call.sessionId) {
      await db
        .update(liveChatSessionsTable)
        .set({ status: "closed", closedBy: "user", updatedAt: new Date() })
        .where(eq(liveChatSessionsTable.id, call.sessionId));
    }
    res.json(await presentCall(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to hang up live call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/calls", async (req, res) => {
  try {
    if (!(await authenticateAdmin(req, res))) return;
    const requestedStatuses = String(req.query.status ?? "queued,active").split(",").filter(Boolean);
    const statusFilter = requestedStatuses.includes("all") ? undefined : requestedStatuses as CallStatus[];
    const calls = await db
      .select()
      .from(liveCallsTable)
      .where(statusFilter && statusFilter.length ? inArray(liveCallsTable.status, statusFilter) : undefined)
      .orderBy(desc(liveCallsTable.queuedAt), desc(liveCallsTable.id))
      .limit(200);
    res.json(await Promise.all(calls.map(presentCall)));
  } catch (err) {
    req.log.error({ err }, "Failed to list live calls");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/calls/presence", async (req, res) => {
  try {
    if (!(await authenticateAdmin(req, res))) return;
    await touchPresence("admin", "admin");
    res.json({ online: true, expiresInMs: PRESENCE_WINDOW_MS });
  } catch (err) {
    req.log.error({ err }, "Failed to update admin call presence");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/calls/:id/accept", async (req, res) => {
  try {
    if (!(await authenticateAdmin(req, res))) return;
    const id = Number(req.params.id);
    const active = await db
      .select({ id: liveCallsTable.id })
      .from(liveCallsTable)
      .where(eq(liveCallsTable.status, "active"))
      .limit(1);
    if (active.length > 0) {
      res.status(409).json({ error: "Finish the current call before accepting another." });
      return;
    }

    const [call] = await db
      .select()
      .from(liveCallsTable)
      .where(eq(liveCallsTable.id, id))
      .limit(1);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (!["queued", "ringing"].includes(call.status)) {
      res.status(409).json({ error: "Call is no longer available" });
      return;
    }

    const [session] = await db
      .insert(liveChatSessionsTable)
      .values({
        visitorId: call.visitorId,
        visitorName: call.callerName,
        visitorEmail: call.callerEmail,
        status: "active",
        lastMessage: "Call connected",
        unreadAdmin: 0,
      })
      .returning();
    const [updated] = await db
      .update(liveCallsTable)
      .set({
        status: "active",
        sessionId: session.id,
        acceptedAt: new Date(),
        acceptedBy: "admin",
        callerLabel: "GSM UNLOCK",
        updatedAt: new Date(),
      })
      .where(and(eq(liveCallsTable.id, id), inArray(liveCallsTable.status, ["queued", "ringing"])))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "Call was accepted by another admin." });
      return;
    }

    res.json(await presentCall(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to accept live call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/calls/:id/hangup", async (req, res) => {
  try {
    if (!(await authenticateAdmin(req, res))) return;
    const id = Number(req.params.id);
    const [call] = await db.select().from(liveCallsTable).where(eq(liveCallsTable.id, id)).limit(1);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (!ACTIVE_CALL_STATUSES.includes(call.status as (typeof ACTIVE_CALL_STATUSES)[number])) {
      res.status(409).json({ error: "Call is no longer active" });
      return;
    }

    const [updated] = await db
      .update(liveCallsTable)
      .set({ status: "completed", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(liveCallsTable.id, id))
      .returning();
    if (call.sessionId) {
      await db
        .update(liveChatSessionsTable)
        .set({ status: "closed", closedBy: "admin", updatedAt: new Date() })
        .where(eq(liveChatSessionsTable.id, call.sessionId));
    }
    res.json(await presentCall(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to hang up live call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/calls/:id/retry", async (req, res) => {
  try {
    if (!(await authenticateAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "A valid call id is required" });
      return;
    }

    const [previous] = await db
      .select()
      .from(liveCallsTable)
      .where(eq(liveCallsTable.id, id))
      .limit(1);
    if (!previous) {
      res.status(404).json({ error: "Call not found" });
      return;
    }

    const targetUserId = previous.targetUserId ?? previous.userId;
    if (!targetUserId) {
      res.status(409).json({ error: "This guest call does not have a user account to call back." });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "The user account for this call no longer exists." });
      return;
    }

    const [existing] = await db
      .select({ id: liveCallsTable.id })
      .from(liveCallsTable)
      .where(and(eq(liveCallsTable.targetUserId, targetUserId), inArray(liveCallsTable.status, ["ringing", "active"])))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "This user already has an active or ringing call." });
      return;
    }

    const [call] = await db
      .insert(liveCallsTable)
      .values({
        visitorId: `user:${targetUserId}`,
        userId: targetUserId,
        targetUserId,
        callerName: "GSM UNLOCK",
        callerEmail: user.email,
        callerLabel: "GSM UNLOCK",
        direction: "admin_to_user",
        signalToken: createSignalToken(),
        status: await isOnline(`user:${targetUserId}`) ? "ringing" : "queued",
      })
      .returning();
    if (call) {
      void sendIncomingCallPush({ userId: targetUserId, callId: call.id });
    }
    res.status(201).json(await presentCall(call));
  } catch (err) {
    req.log.error({ err }, "Failed to retry live call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/calls/user/:userId", async (req, res) => {
  try {
    if (!(await authenticateAdmin(req, res))) return;
    const targetUserId = Number(req.params.userId);
    if (!targetUserId) {
      res.status(400).json({ error: "A valid user id is required" });
      return;
    }
    const [user] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [existing] = await db
      .select()
      .from(liveCallsTable)
      .where(and(eq(liveCallsTable.targetUserId, targetUserId), inArray(liveCallsTable.status, ["ringing", "active"])))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "This user already has an active or ringing call." });
      return;
    }
    const [call] = await db
      .insert(liveCallsTable)
      .values({
        visitorId: `user:${targetUserId}`,
        userId: targetUserId,
        targetUserId,
        callerName: "GSM UNLOCK",
        callerEmail: user.email,
        callerLabel: "GSM UNLOCK",
        direction: "admin_to_user",
        signalToken: createSignalToken(),
        status: await isOnline(`user:${targetUserId}`) ? "ringing" : "queued",
      })
      .returning();
    if (call) {
      void sendIncomingCallPush({ userId: targetUserId, callId: call.id });
    }
    res.status(201).json(await presentCall(call));
  } catch (err) {
    req.log.error({ err }, "Failed to create direct admin call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/calls/:id/signals", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const after = Math.max(0, Number(req.query.after ?? 0));
    const visitorId = String(req.query.visitorId ?? "").trim();
    const signalToken = String(req.query.signalToken ?? "").trim();
    const [call] = await db.select().from(liveCallsTable).where(eq(liveCallsTable.id, id)).limit(1);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (!call.signalToken || signalToken !== call.signalToken) {
      res.status(403).json({ error: "Invalid call signal token" });
      return;
    }
    const isAdmin = typeof req.headers["x-admin-password"] === "string" && await checkAdminPassword(req.headers["x-admin-password"] as string);
    if (!isAdmin && !canAccessCall(call, req, visitorId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const signals = await db
      .select()
      .from(liveCallSignalsTable)
      .where(and(eq(liveCallSignalsTable.callId, id), gt(liveCallSignalsTable.id, after)))
      .orderBy(asc(liveCallSignalsTable.id))
      .limit(100);
    res.json(signals);
  } catch (err) {
    req.log.error({ err }, "Failed to load call signals");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/calls/:id/signals", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const role = req.body?.role;
    const payload = req.body?.payload;
    const visitorId = String(req.body?.visitorId ?? "").trim();
    const signalToken = String(req.body?.signalToken ?? "").trim();
    if (!id || (role !== "admin" && role !== "user") || !payload || typeof payload !== "object") {
      res.status(400).json({ error: "A call id, role, and payload are required" });
      return;
    }
    const [call] = await db.select().from(liveCallsTable).where(eq(liveCallsTable.id, id)).limit(1);
    if (!call || !["ringing", "active"].includes(call.status)) {
      res.status(404).json({ error: "Call is not available" });
      return;
    }
    if (!call.signalToken || signalToken !== call.signalToken) {
      res.status(403).json({ error: "Invalid call signal token" });
      return;
    }
    const isAdmin = role === "admin" && typeof req.headers["x-admin-password"] === "string" &&
      await checkAdminPassword(req.headers["x-admin-password"] as string);
    const isUser = role === "user" && canAccessCall(call, req, visitorId);
    if (!isAdmin && !isUser) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [signal] = await db
      .insert(liveCallSignalsTable)
      .values({ callId: id, senderRole: role, payload })
      .returning();
    res.status(201).json(signal);
  } catch (err) {
    req.log.error({ err }, "Failed to save call signal");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;