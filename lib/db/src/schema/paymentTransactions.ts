import { pgTable, serial, text, numeric, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { ordersTable } from "./orders";

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference"),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("pending"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectPaymentTransactionSchema = createSelectSchema(paymentTransactionsTable);

export type InsertPaymentTransaction = typeof paymentTransactionsTable.$inferInsert;
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
