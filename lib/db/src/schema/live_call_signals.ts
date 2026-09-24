import { integer, jsonb, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const liveCallSignalsTable = pgTable(
  "live_call_signals",
  {
    id: serial("id").primaryKey(),
    callId: integer("call_id").notNull(),
    senderRole: text("sender_role").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    callCursorIdx: index("live_call_signals_call_cursor_idx").on(table.callId, table.id),
  }),
);

export type LiveCallSignal = typeof liveCallSignalsTable.$inferSelect;