import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, insertUserSchema } from "@workspace/db";
import { z } from "zod";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const USER_SELECT = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  username: usersTable.username,
  createdAt: usersTable.createdAt,
  walletBalance: usersTable.walletBalance,
  status: usersTable.status,
  registrationIp: usersTable.registrationIp,
  country: usersTable.country,
} as const;

// All /users routes are admin-only — protect every endpoint with requireAdmin.

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await db
      .select(USER_SELECT)
      .from(usersTable);
    res.json(users);
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", requireAdmin, async (req, res) => {
  try {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [user] = await db
      .insert(usersTable)
      .values(parsed.data)
      .returning(USER_SELECT);
    res.status(201).json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to create user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [user] = await db
      .select(USER_SELECT)
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = z
      .object({
        name: z.string().nullable().optional(),
        status: z.string().optional(),
        walletBalance: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set(parsed.data)
      .where(eq(usersTable.id, id))
      .returning(USER_SELECT);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
