import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  orderId: integer("order_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export const selectNotificationSchema = createSelectSchema(notificationsTable);

export type InsertNotification = typeof notificationsTable.$inferInsert;
export type DbNotification = typeof notificationsTable.$inferSelect;
