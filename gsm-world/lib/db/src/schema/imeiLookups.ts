import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const imeiLookupsTable = pgTable("imei_lookups", {
  id: serial("id").primaryKey(),
  imei: text("imei").notNull(),
  brand: text("brand"),
  model: text("model"),
  marketingName: text("marketing_name"),
  simLock: text("sim_lock"),
  carrier: text("carrier"),
  blacklist: text("blacklist"),
  enhanced: boolean("enhanced").notNull().default(false),
  source: text("source"),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});

export const insertImeiLookupSchema = createInsertSchema(imeiLookupsTable).omit({ id: true });
export const selectImeiLookupSchema = createSelectSchema(imeiLookupsTable);

export type InsertImeiLookup = typeof imeiLookupsTable.$inferInsert;
export type ImeiLookup = typeof imeiLookupsTable.$inferSelect;
