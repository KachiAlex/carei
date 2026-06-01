import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["carer", "admin", "supervisor"] })
    .notNull()
    .default("carer"),
  phone: text("phone"),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age"),
  condition: text("condition"),
  address: text("address"),
  phone: text("phone"),
  emergencyContact: text("emergency_contact"),
  nextVisit: timestamp("next_visit"),
  avatar: text("avatar"),
  needs: text("needs").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  dose: text("dose"),
  schedule: text("schedule"),
});

export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  carerId: integer("carer_id").references(() => users.id),
  date: timestamp("date").notNull(),
  type: text("type"),
  duration: integer("duration"),
  status: text("status", {
    enum: ["scheduled", "in_progress", "completed", "cancelled"],
  }).default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const careNotes = pgTable("care_notes", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").references(() => visits.id),
  clientId: integer("client_id").references(() => clients.id),
  content: text("content"),
  vitals: jsonb("vitals"),
  fluidIntake: integer("fluid_intake"),
  mealStatus: text("meal_status"),
  mood: text("mood"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medicationLogs = pgTable("medication_logs", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").references(() => visits.id),
  clientId: integer("client_id").references(() => clients.id),
  medicationName: text("medication_name").notNull(),
  dose: text("dose"),
  status: text("status", { enum: ["taken", "refused", "missed"] }),
  refusalReason: text("refusal_reason"),
  refusalWhatSaid: text("refusal_what_said"),
  refusalAction: text("refusal_action"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type CareNote = typeof careNotes.$inferSelect;
export type MedicationLog = typeof medicationLogs.$inferSelect;
