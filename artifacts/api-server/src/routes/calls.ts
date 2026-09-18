import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { db, liveCallsTable, liveChatSessionsTable, usersTable } from "@workspace/db";
import { checkAdminPassword } from "../lib/admin-settings";

const router: IRouter = Router();
const ACTIVE_CALL_STATUSES = ["queued", "ringing", "active"] as const;
const JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

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
        status: "queued",
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
    if (call.visitorId !== visitorId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(await presentCall(call));
  } catch (err) {
    req.log.error({ err }, "Failed to get live call");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/calls/incoming", async (req, res) => {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Sign in to receive direct calls." });
      return;
    }
    const calls = await db
      .select()
      .from(liveCallsTable)
      .where(and(eq(liveCallsTable.targetUserId, user.userId), inArray(liveCallsTable.status, ["ringing", "active"])))
      .orderBy(desc(liveCallsTable.updatedAt))
      .limit(1);
    res.json(calls.length ? await presentCall(calls[0]) : null);
  } catch (err) {
    req.log.error({ err }, "Failed to load incoming calls");
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
    if (!visitorId || call.visitorId !== visitorId) {
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
    if (!visitorId || call.visitorId !== visitorId) {
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
    const statusFilter = String(req.query.status ?? "queued,active").split(",").filter(Boolean) as CallStatus[];
    const calls = await db
      .select()
      .from(liveCallsTable)
      .where(statusFilter.length ? inArray(liveCallsTable.status, statusFilter) : undefined)
      .orderBy(asc(liveCallsTable.status), asc(liveCallsTable.queuedAt), asc(liveCallsTable.id));
    res.json(await Promise.all(calls.map(presentCall)));
  } catch (err) {
    req.log.error({ err }, "Failed to list live calls");
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
    if (call.status !== "queued") {
      res.status(409).json({ error: "Call is no longer queued" });
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
      .where(and(eq(liveCallsTable.id, id), eq(liveCallsTable.status, "queued")))
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
        status: "ringing",
      })
      .returning();
    res.status(201).json(await presentCall(call));
  } catch (err) {
    req.log.error({ err }, "Failed to create direct admin call");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;