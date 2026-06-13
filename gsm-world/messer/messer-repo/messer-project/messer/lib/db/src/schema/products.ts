import { pgTable, serial, text, numeric, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { categoriesTable } from "./categories";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price").notNull(),
  originalPrice: numeric("original_price"),
  imageUrl: text("image_url").notNull().default(""),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  inStock: boolean("in_stock").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export const selectProductSchema = createSelectSchema(productsTable);

export type InsertProduct = typeof productsTable.$inferInsert;
export type Product = typeof productsTable.$inferSelect;
