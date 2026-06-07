import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { productsTable } from "./products";

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull().default(1),
  priceAtAdd: numeric("price_at_add").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  reminderSentAt: timestamp("reminder_sent_at"),
});

export const insertCartItemSchema = createInsertSchema(cartItemsTable).omit({ id: true });
export const selectCartItemSchema = createSelectSchema(cartItemsTable);

export type InsertCartItem = typeof cartItemsTable.$inferInsert;
export type CartItem = typeof cartItemsTable.$inferSelect;
