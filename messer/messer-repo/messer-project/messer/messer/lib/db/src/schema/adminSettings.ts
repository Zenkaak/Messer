import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const adminSettingsTable = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminSettingSchema = createInsertSchema(adminSettingsTable).omit({ id: true });
export const selectAdminSettingSchema = createSelectSchema(adminSettingsTable);

export type InsertAdminSetting = typeof adminSettingsTable.$inferInsert;
export type AdminSetting = typeof adminSettingsTable.$inferSelect;
