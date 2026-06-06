import { pgTable, serial, text, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { ordersTable } from "./orders";

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  price: numeric("price").notNull(),
  quantity: integer("quantity").notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export const selectOrderItemSchema = createSelectSchema(orderItemsTable);

export type InsertOrderItem = typeof orderItemsTable.$inferInsert;
export type OrderItem = typeof orderItemsTable.$inferSelect;
