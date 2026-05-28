import { pgTable, serial, text, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id"),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  customerName: text("customer_name"),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  total: numeric("total").notNull(),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  deviceIdentifier: text("device_identifier"),
  orderType: text("order_type").notNull().default("product"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectOrderSchema = createSelectSchema(ordersTable);

export type InsertOrder = typeof ordersTable.$inferInsert;
export type Order = typeof ordersTable.$inferSelect;
