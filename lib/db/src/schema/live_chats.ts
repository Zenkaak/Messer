import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const liveChatSessionsTable = pgTable("live_chat_sessions", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  visitorName: text("visitor_name"),
  visitorEmail: text("visitor_email"),
  status: text("status").notNull().default("waiting"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  closedBy: text("closed_by"),
  lastMessage: text("last_message"),
  unreadAdmin: integer("unread_admin").notNull().default(0),
});

export const liveChatMessagesTable = pgTable("live_chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  senderType: text("sender_type").notNull(),
  message: text("message").notNull().default(""),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

export const insertLiveChatSessionSchema = createInsertSchema(liveChatSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLiveChatMessageSchema = createInsertSchema(liveChatMessagesTable).omit({ id: true, createdAt: true });
export const selectLiveChatSessionSchema = createSelectSchema(liveChatSessionsTable);
export const selectLiveChatMessageSchema = createSelectSchema(liveChatMessagesTable);

export type LiveChatSession = typeof liveChatSessionsTable.$inferSelect;
export type LiveChatMessage = typeof liveChatMessagesTable.$inferSelect;
