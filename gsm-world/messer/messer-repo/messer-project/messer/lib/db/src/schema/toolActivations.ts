import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const toolActivationsTable = pgTable("tool_activations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  toolName: text("tool_name").notNull(),
  toolCategory: text("tool_category").notNull(),
  username: text("username").notNull(),
  serialKey: text("serial_key").notNull(),
  orderRef: text("order_ref"),
  status: text("status").notNull().default("pending"),
  activationCode: text("activation_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertToolActivationSchema = createInsertSchema(toolActivationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectToolActivationSchema = createSelectSchema(toolActivationsTable);

export type InsertToolActivation = typeof toolActivationsTable.$inferInsert;
export type ToolActivation = typeof toolActivationsTable.$inferSelect;
