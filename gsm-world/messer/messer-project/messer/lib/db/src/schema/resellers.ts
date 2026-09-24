import { pgTable, serial, text, numeric, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const resellerApplicationsTable = pgTable("reseller_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  email: text("email").notNull(),
  storeName: text("store_name"),
  storeSlug: text("store_slug").notNull().unique(),
  status: text("status").notNull().default("pending_payment"),
  securityFeePaid: boolean("security_fee_paid").notNull().default(false),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  commissionRate: numeric("commission_rate").notNull().default("10.00"),
  totalEarned: numeric("total_earned").notNull().default("0.00"),
  totalOrders: integer("total_orders").notNull().default(0),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const insertResellerApplicationSchema = createInsertSchema(resellerApplicationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const selectResellerApplicationSchema = createSelectSchema(resellerApplicationsTable);

export type InsertResellerApplication = typeof resellerApplicationsTable.$inferInsert;
export type ResellerApplication = typeof resellerApplicationsTable.$inferSelect;

// ─── Withdrawal requests ─────────────────────────────────────────────────────

export const resellerWithdrawalsTable = pgTable("reseller_withdrawals", {
  id: serial("id").primaryKey(),
  resellerId: integer("reseller_id").notNull().references(() => resellerApplicationsTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),  // pending | approved | rejected
  paymentMethod: text("payment_method").notNull(),
  paymentAddress: text("payment_address").notNull(),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertResellerWithdrawalSchema = createInsertSchema(resellerWithdrawalsTable).omit({
  id: true, createdAt: true,
});
export const selectResellerWithdrawalSchema = createSelectSchema(resellerWithdrawalsTable);

export type InsertResellerWithdrawal = typeof resellerWithdrawalsTable.$inferInsert;
export type ResellerWithdrawal = typeof resellerWithdrawalsTable.$inferSelect;
