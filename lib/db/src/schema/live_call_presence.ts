import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const liveCallPresenceTable = pgTable("live_call_presence", {
  actorKey: text("actor_key").primaryKey(),
  role: text("role").notNull(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});