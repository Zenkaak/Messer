import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { ordersTable } from "./orders";

export const orderMessagesTable = pgTable("order_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(), // "admin" | "user"
  senderEmail: text("sender_email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderMessageSchema = createInsertSchema(orderMessagesTable).omit({ id: true, createdAt: true });
export const selectOrderMessageSchema = createSelectSchema(orderMessagesTable);

export type InsertOrderMessage = typeof orderMessagesTable.$inferInsert;
export type OrderMessage = typeof orderMessagesTable.$inferSelect;
