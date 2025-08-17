import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  nomorLambung: text("nomor_lambung").notNull(),
  phone: text("phone").notNull(),
  shift: text("shift").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("present"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const rosterSchedules = pgTable("roster_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  date: text("date").notNull(),
  shift: text("shift").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  jamTidur: text("jam_tidur"), // Jam tidur dalam angka (contoh: "6", "5")
  fitToWork: text("fit_to_work").notNull().default("Fit To Work"), // Status fit to work
  status: text("status").notNull().default("scheduled"),
});

export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  leaveType: text("leave_type").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const qrTokens = pgTable("qr_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  token: text("token").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Insert schemas
export const insertEmployeeSchema = createInsertSchema(employees).omit({
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  createdAt: true,
});

export const insertRosterSchema = createInsertSchema(rosterSchedules).omit({
  id: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
});

export const insertQrTokenSchema = createInsertSchema(qrTokens).omit({
  id: true,
  createdAt: true,
});

// Types
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceSchema>;
export type RosterSchedule = typeof rosterSchedules.$inferSelect;
export type InsertRosterSchedule = z.infer<typeof insertRosterSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type QrToken = typeof qrTokens.$inferSelect;
export type InsertQrToken = z.infer<typeof insertQrTokenSchema>;
