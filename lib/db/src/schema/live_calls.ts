import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const liveCallsTable = pgTable(
  "live_calls",
  {
    id: serial("id").primaryKey(),
    visitorId: text("visitor_id").notNull(),
    userId: integer("user_id"),
    callerName: text("caller_name"),
    callerEmail: text("caller_email"),
    callerPhone: text("caller_phone"),
    status: text("status").notNull().default("queued"),
    sessionId: integer("session_id"),
    acceptedBy: text("accepted_by"),
    queuedAt: timestamp("queued_at").notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at"),
    endedAt: timestamp("ended_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    queueOrderIdx: index("live_calls_queue_order_idx").on(table.status, table.queuedAt, table.id),
    visitorStatusIdx: index("live_calls_visitor_status_idx").on(table.visitorId, table.status),
  }),
);

export const insertLiveCallSchema = createInsertSchema(liveCallsTable).omit({
  id: true,
  queuedAt: true,
  updatedAt: true,
});
export const selectLiveCallSchema = createSelectSchema(liveCallsTable);

export type LiveCall = typeof liveCallsTable.$inferSelect;