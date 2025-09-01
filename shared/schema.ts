import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position"),
  department: text("department"),
  investorGroup: text("investor_group"),
  phone: text("phone").notNull(),
  qrCode: text("qr_code"), // QR Code data untuk karyawan
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  date: text("date").notNull(),
  time: text("time").notNull(),
  jamTidur: text("jam_tidur"), // Jam tidur karyawan
  fitToWork: text("fit_to_work"), // Status fit to work
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
  hariKerja: text("hari_kerja"), // Hari kerja dari Excel upload (contoh: "Senin", "Selasa")
  status: text("status").notNull().default("scheduled"),
});

export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  employeeName: text("employee_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  leaveType: text("leave_type").notNull(),
  reason: text("reason"),
  attachmentPath: text("attachment_path"), // Path to uploaded PDF file
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Table untuk tracking saldo cuti karyawan
export const leaveBalances = pgTable("leave_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  year: integer("year").notNull(),
  totalDays: integer("total_days").notNull().default(0), // Total hari cuti yang berhak
  usedDays: integer("used_days").notNull().default(0), // Hari cuti yang sudah digunakan
  remainingDays: integer("remaining_days").notNull().default(0), // Sisa hari cuti
  workingDaysCompleted: integer("working_days_completed").notNull().default(0), // Hari kerja yang sudah diselesaikan
  lastWorkDate: text("last_work_date"), // Tanggal kerja terakhir
  lastLeaveDate: text("last_leave_date"), // Tanggal cuti terakhir
  nextLeaveEligible: text("next_leave_eligible"), // Tanggal kapan boleh cuti lagi
  status: text("status").notNull().default("active"), // active, expired
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Table untuk roster monitoring cuti karyawan
export const leaveRosterMonitoring = pgTable("leave_roster_monitoring", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nik: varchar("nik").notNull(),
  name: text("name").notNull(),
  month: varchar("month").notNull(), // Format: "YYYY-MM" e.g. "2024-08"
  investorGroup: text("investor_group").notNull(),
  lastLeaveDate: text("last_leave_date"), // Tanggal terakhir cuti
  leaveOption: text("leave_option").notNull(), // "70" atau "35" hari kerja
  monitoringDays: integer("monitoring_days").notNull().default(0), // Jumlah hari sejak terakhir cuti
  nextLeaveDate: text("next_leave_date"), // Tanggal cuti berikutnya (otomatis hitung)
  onSite: text("on_site"), // OnSite status: "Ya", "Tidak", atau kosong
  status: text("status").notNull().default("Aktif"), // Aktif, Menunggu Cuti, Sedang Cuti, Selesai Cuti
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // Unique constraint untuk NIK + Month (bisa ada duplikat NIK untuk bulan berbeda)
  nikMonthUnique: unique().on(table.nik, table.month),
}));

// Table untuk history cuti karyawan  
export const leaveHistory = pgTable("leave_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  leaveRequestId: varchar("leave_request_id").references(() => leaveRequests.id),
  leaveType: text("leave_type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  balanceBeforeLeave: integer("balance_before_leave").notNull(),
  balanceAfterLeave: integer("balance_after_leave").notNull(),
  status: text("status").notNull(), // taken, cancelled, pending
  remarks: text("remarks"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const qrTokens = pgTable("qr_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  token: text("token").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const leaveReminders = pgTable("leave_reminders", {
  id: varchar("id").primaryKey(),
  leaveRequestId: varchar("leave_request_id").notNull().references(() => leaveRequests.id),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  reminderType: text("reminder_type").notNull(), // '7_days', '3_days', '1_day'
  sentAt: timestamp("sent_at").notNull(),
  phoneNumber: text("phone_number").notNull(),
  message: text("message").notNull(),
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

export const insertLeaveReminderSchema = createInsertSchema(leaveReminders).omit({
  createdAt: true,
});

export const insertLeaveBalanceSchema = createInsertSchema(leaveBalances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeaveHistorySchema = createInsertSchema(leaveHistory).omit({
  id: true,
  createdAt: true,
});

export const insertLeaveRosterMonitoringSchema = createInsertSchema(leaveRosterMonitoring).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type LeaveReminder = typeof leaveReminders.$inferSelect;
export type InsertLeaveReminder = z.infer<typeof insertLeaveReminderSchema>;
export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type InsertLeaveBalance = z.infer<typeof insertLeaveBalanceSchema>;
export type LeaveHistory = typeof leaveHistory.$inferSelect;
export type InsertLeaveHistory = z.infer<typeof insertLeaveHistorySchema>;
export type LeaveRosterMonitoring = typeof leaveRosterMonitoring.$inferSelect;
export type InsertLeaveRosterMonitoring = z.infer<typeof insertLeaveRosterMonitoringSchema>;

// WhatsApp Blast schemas
export const whatsappBlasts = pgTable("whatsapp_blasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  imageUrl: varchar("image_url"),
  targetType: varchar("target_type").notNull().default("all"), // all, department, specific
  targetValue: text("target_value"), // department name or specific NIKs (JSON array)
  totalRecipients: integer("total_recipients").default(0),
  successCount: integer("success_count").default(0),
  failedCount: integer("failed_count").default(0),
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at")
});

export const whatsappBlastResults = pgTable("whatsapp_blast_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blastId: varchar("blast_id").notNull().references(() => whatsappBlasts.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  phoneNumber: varchar("phone_number").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, sent, failed
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertWhatsappBlastSchema = createInsertSchema(whatsappBlasts).omit({
  id: true,
  createdAt: true,
  completedAt: true
});

export const insertWhatsappBlastResultSchema = createInsertSchema(whatsappBlastResults).omit({
  id: true,
  createdAt: true,
  sentAt: true
});

export type WhatsappBlast = typeof whatsappBlasts.$inferSelect;
export type InsertWhatsappBlast = z.infer<typeof insertWhatsappBlastSchema>;
export type WhatsappBlastResult = typeof whatsappBlastResults.$inferSelect;
export type InsertWhatsappBlastResult = z.infer<typeof insertWhatsappBlastResultSchema>;

// Meeting attendance system
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  startTime: varchar("start_time").notNull(), // HH:MM format
  endTime: varchar("end_time").notNull(), // HH:MM format
  location: varchar("location").notNull(),
  organizer: varchar("organizer").notNull(),
  status: varchar("status").notNull().default("scheduled"), // scheduled, ongoing, completed, cancelled
  qrToken: varchar("qr_token").unique(), // Unique token for QR code
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const meetingAttendance = pgTable("meeting_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  scanTime: varchar("scan_time").notNull(), // HH:MM:SS format
  scanDate: varchar("scan_date").notNull(), // YYYY-MM-DD format
  deviceInfo: varchar("device_info"), // Browser/device information
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMeetingAttendanceSchema = createInsertSchema(meetingAttendance).omit({
  id: true,
  createdAt: true,
});

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type MeetingAttendance = typeof meetingAttendance.$inferSelect;
export type InsertMeetingAttendance = z.infer<typeof insertMeetingAttendanceSchema>;



