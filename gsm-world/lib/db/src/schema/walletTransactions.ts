import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(), // 'topup' | 'transfer_sent' | 'transfer_received' | 'credit'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  fee: numeric("fee", { precision: 12, scale: 2 }).notNull().default("0"),
  counterpartyUsername: text("counterparty_username"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactionsTable.$inferInsert;
