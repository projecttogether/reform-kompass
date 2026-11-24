import { pgTable, text, timestamp, boolean, jsonb, index, integer } from "drizzle-orm/pg-core";
import type { BewertungStand } from "../bewertung";

const zeit = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// Better Auth core tables. Property names must match Better Auth field names.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: zeit("created_at").notNull().defaultNow(),
  updatedAt: zeit("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: zeit("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: zeit("created_at").notNull().defaultNow(),
  updatedAt: zeit("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_id_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: zeit("access_token_expires_at"),
  refreshTokenExpiresAt: zeit("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: zeit("created_at").notNull().defaultNow(),
  updatedAt: zeit("updated_at").notNull().defaultNow(),
}, (t) => [index("account_user_id_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: zeit("expires_at").notNull(),
  createdAt: zeit("created_at").notNull().defaultNow(),
  updatedAt: zeit("updated_at").notNull().defaultNow(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

// Application tables.

/** Profile and account status. One row per user, created on first use. */
export const mitglied = pgTable("mitglied", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  kommune: text("kommune").notNull().default(""),
  funktion: text("funktion").notNull().default(""),
  fachbereich: text("fachbereich").notNull().default(""),
  /** Set when deletion is requested. The account is removed 30 days later unless restored. */
  loeschungBeantragtAm: zeit("loeschung_beantragt_am"),
  aktualisiertAm: zeit("aktualisiert_am").notNull().defaultNow(),
});

export const bewertung = pgTable("bewertung", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  stand: jsonb("stand").$type<BewertungStand>().notNull(),
  /** Increases with every save. Saves must name the revision they build on. */
  revision: integer("revision").notNull().default(1),
  erstelltAm: zeit("erstellt_am").notNull().defaultNow(),
  aktualisiertAm: zeit("aktualisiert_am").notNull().defaultNow(),
}, (t) => [index("bewertung_user_id_idx").on(t.userId, t.aktualisiertAm)]);

/** Public data about a municipality fetched from outside sources (mayor, council papers). Shared by all users. */
export const kommunalCache = pgTable("kommunal_cache", {
  ags: text("ags").primaryKey(),
  daten: jsonb("daten").notNull(),
  abgerufenAm: zeit("abgerufen_am").notNull(),
});

export const schema = { user, session, account, verification, mitglied, bewertung, kommunalCache };
