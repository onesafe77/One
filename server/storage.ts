import { 
  type Employee, 
  type InsertEmployee, 
  type AttendanceRecord, 
  type InsertAttendanceRecord,
  type RosterSchedule,
  type InsertRosterSchedule,
  type LeaveRequest,
  type InsertLeaveRequest,
  type QrToken,
  type InsertQrToken,
  type LeaveReminder,
  type InsertLeaveReminder,
  type LeaveBalance,
  type InsertLeaveBalance,
  type LeaveHistory,
  type InsertLeaveHistory,
  type LeaveRosterMonitoring,
  type InsertLeaveRosterMonitoring,
  type Meeting,
  type InsertMeeting,
  type MeetingAttendance,
  type InsertMeetingAttendance,
  type SimperMonitoring,
  type InsertSimperMonitoring,
  type User,
  type UpsertUser,
  users,
  employees,
  attendanceRecords,
  rosterSchedules,
  leaveRequests,
  qrTokens,
  leaveReminders,
  leaveBalances,
  leaveHistory,
  leaveRosterMonitoring,
  meetings,
  meetingAttendance,
  simperMonitoring
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and } from "drizzle-orm";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Employee methods
  getEmployee(id: string): Promise<Employee | undefined>;
  getAllEmployees(): Promise<Employee[]>;
  getEmployees(): Promise<Employee[]>; // Alias for compatibility
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;
  deleteAllEmployees(): Promise<boolean>;

  // Attendance methods
  getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined>;
  getAttendanceByEmployee(employeeId: string, date?: string): Promise<AttendanceRecord[]>;
  getAllAttendance(date?: string): Promise<AttendanceRecord[]>;
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  
  // Roster methods
  getRosterSchedule(id: string): Promise<RosterSchedule | undefined>;
  getRosterByDate(date: string): Promise<RosterSchedule[]>;
  getRosterByEmployee(employeeId: string): Promise<RosterSchedule[]>;
  createRosterSchedule(schedule: InsertRosterSchedule): Promise<RosterSchedule>;
  updateRosterSchedule(id: string, schedule: Partial<InsertRosterSchedule>): Promise<RosterSchedule | undefined>;
  deleteRosterSchedule(id: string): Promise<boolean>;
  deleteAllRosterSchedules(): Promise<void>;
  
  // Leave methods
  getLeaveRequest(id: string): Promise<LeaveRequest | undefined>;
  getLeaveByEmployee(employeeId: string): Promise<LeaveRequest[]>;
  getAllLeaveRequests(): Promise<LeaveRequest[]>;
  getLeaveRequests(): Promise<LeaveRequest[]>; // Alias for compatibility
  createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequest(id: string, request: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined>;
  deleteLeaveRequest(id: string): Promise<boolean>;
  
  // QR Token methods
  getQrToken(employeeId: string): Promise<QrToken | undefined>;
  getQrTokensByEmployee(employeeId: string): Promise<QrToken[]>;
  createQrToken(token: InsertQrToken): Promise<QrToken>;
  validateQrToken(employeeId: string, token: string): Promise<boolean>;

  // Leave Reminder methods
  getLeaveReminder(leaveRequestId: string, reminderType: string): Promise<LeaveReminder | undefined>;
  getLeaveReminders(): Promise<LeaveReminder[]>;
  saveLeaveReminder(reminder: InsertLeaveReminder): Promise<LeaveReminder>;

  // Leave Balance methods
  getLeaveBalances(): Promise<LeaveBalance[]>;
  getLeaveBalanceByEmployee(employeeId: string, year?: number): Promise<LeaveBalance | undefined>;
  createLeaveBalance(balance: InsertLeaveBalance): Promise<LeaveBalance>;
  updateLeaveBalance(id: string, balance: Partial<InsertLeaveBalance>): Promise<LeaveBalance | undefined>;
  calculateLeaveEligibility(employeeId: string): Promise<{ eligible: boolean; daysEarned: number; nextEligibleDate: string | null }>;

  // Leave History methods
  getLeaveHistory(): Promise<LeaveHistory[]>;
  getLeaveHistoryByEmployee(employeeId: string): Promise<LeaveHistory[]>;
  createLeaveHistory(history: InsertLeaveHistory): Promise<LeaveHistory>;

  // Bulk upload methods
  bulkUploadLeaveRoster(data: Array<{ nik: string; leaveType: string; startDate: string; endDate: string; totalDays: number }>): Promise<{ success: number; errors: string[] }>;

  // Leave Roster Monitoring methods
  getLeaveRosterMonitoring(id: string): Promise<LeaveRosterMonitoring | undefined>;
  getLeaveRosterMonitoringByNik(nik: string): Promise<LeaveRosterMonitoring | undefined>;
  getAllLeaveRosterMonitoring(): Promise<LeaveRosterMonitoring[]>;
  createLeaveRosterMonitoring(monitoring: InsertLeaveRosterMonitoring): Promise<LeaveRosterMonitoring>;
  updateLeaveRosterMonitoring(id: string, monitoring: Partial<InsertLeaveRosterMonitoring>): Promise<LeaveRosterMonitoring | undefined>;
  deleteLeaveRosterMonitoring(id: string): Promise<boolean>;
  deleteAllLeaveRosterMonitoring(): Promise<void>;
  updateLeaveRosterStatus(): Promise<void>; // Update status berdasarkan tanggal
  

  // Meeting methods
  getMeeting(id: string): Promise<Meeting | undefined>;
  getAllMeetings(): Promise<Meeting[]>;
  getMeetingsByDate(date: string): Promise<Meeting[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, meeting: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<boolean>;
  getMeetingByQrToken(qrToken: string): Promise<Meeting | undefined>;

  // Meeting attendance methods
  getMeetingAttendance(meetingId: string): Promise<MeetingAttendance[]>;
  createMeetingAttendance(attendance: InsertMeetingAttendance): Promise<MeetingAttendance>;
  checkMeetingAttendance(meetingId: string, employeeId: string): Promise<MeetingAttendance | undefined>;
  deleteMeetingAttendance(attendanceId: string): Promise<boolean>;

  // SIMPER Monitoring methods
  getSimperMonitoring(id: string): Promise<SimperMonitoring | undefined>;
  getSimperMonitoringByNik(nik: string): Promise<SimperMonitoring | undefined>;
  getAllSimperMonitoring(): Promise<SimperMonitoring[]>;
  createSimperMonitoring(simper: InsertSimperMonitoring): Promise<SimperMonitoring>;
  updateSimperMonitoring(id: string, simper: Partial<InsertSimperMonitoring>): Promise<SimperMonitoring | undefined>;
  deleteSimperMonitoring(id: string): Promise<boolean>;
  deleteAllSimperMonitoring(): Promise<void>;
  bulkUploadSimperData(data: Array<{ employeeName: string; nik: string; simperBibExpiredDate?: string; simperTiaExpiredDate?: string }>): Promise<{ success: number; errors: string[] }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private employees: Map<string, Employee>;
  private attendanceRecords: Map<string, AttendanceRecord>;
  private rosterSchedules: Map<string, RosterSchedule>;
  private leaveRequests: Map<string, LeaveRequest>;
  private qrTokens: Map<string, QrToken>;
  private leaveBalances: Map<string, LeaveBalance>;
  private leaveHistory: Map<string, LeaveHistory>;
  private leaveRosterMonitoring: Map<string, LeaveRosterMonitoring>;
  private leaveReminders: Map<string, LeaveReminder>;
  private simperMonitoring: Map<string, SimperMonitoring>;
  private meetings: Map<string, Meeting>;
  private meetingAttendance: Map<string, MeetingAttendance>;

  constructor() {
    this.users = new Map();
    this.employees = new Map();
    this.attendanceRecords = new Map();
    this.rosterSchedules = new Map();
    this.leaveRequests = new Map();
    this.qrTokens = new Map();
    this.leaveBalances = new Map();
    this.leaveHistory = new Map();
    this.leaveRosterMonitoring = new Map();
    this.leaveReminders = new Map();
    this.simperMonitoring = new Map();
    this.meetings = new Map();
    this.meetingAttendance = new Map();
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // No sample employees - user will add their own data
    // (keeping empty for user to populate with real data)

    // No sample roster - user will add their own data through Excel upload or manual entry

    // No sample attendance - will be created through QR scan attendance system

    // No sample leave requests - will be created by employees as needed
  }

  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      id: userData.id || randomUUID(),
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: userData.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  // Employee methods
  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async getAllEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async getEmployees(): Promise<Employee[]> {
    return this.getAllEmployees();
  }

  private generateNextNIK(): string {
    const existingEmployees = Array.from(this.employees.values());
    const existingNumbers = existingEmployees
      .map(emp => {
        const match = emp.id.match(/^C-(\d{5})$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    return `C-${nextNumber.toString().padStart(5, '0')}`;
  }
  
  // Removed generateNextNomorLambung as it's no longer needed

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    // Generate NIK automatically if not provided
    const id = insertEmployee.id || this.generateNextNIK();
    
    const employee: Employee = { 
      ...insertEmployee,
      id,
      position: insertEmployee.position || null,
      nomorLambung: insertEmployee.nomorLambung || null,
      department: insertEmployee.department || null,
      investorGroup: insertEmployee.investorGroup || null,
      qrCode: insertEmployee.qrCode || null, // Add QR Code field
      status: insertEmployee.status || "active",
      isSpareOrigin: insertEmployee.nomorLambung === "SPARE" ? true : (insertEmployee.isSpareOrigin || false), // Track SPARE origin
      createdAt: new Date() 
    };
    this.employees.set(employee.id, employee);
    return employee;
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const existing = this.employees.get(id);
    if (!existing) return undefined;
    
    // Preserve isSpareOrigin if employee was originally SPARE
    let isSpareOrigin = existing.isSpareOrigin;
    if (existing.nomorLambung === "SPARE" && updateData.nomorLambung && updateData.nomorLambung !== "SPARE") {
      isSpareOrigin = true; // Mark as SPARE origin when updating from SPARE to new nomor lambung
    }
    
    const updated = { ...existing, ...updateData, isSpareOrigin };
    this.employees.set(id, updated);
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    return this.employees.delete(id);
  }

  async deleteAllEmployees(): Promise<boolean> {
    this.employees.clear();
    // Also clear related data when deleting all employees
    this.attendanceRecords.clear();
    this.rosterSchedules.clear();
    this.qrTokens.clear();
    return true;
  }

  // Attendance methods
  async getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined> {
    return this.attendanceRecords.get(id);
  }

  async getAttendanceByEmployee(employeeId: string, date?: string): Promise<AttendanceRecord[]> {
    return Array.from(this.attendanceRecords.values()).filter(record => 
      record.employeeId === employeeId && (!date || record.date === date)
    );
  }

  async getAllAttendance(date?: string): Promise<AttendanceRecord[]> {
    const records = Array.from(this.attendanceRecords.values());
    return date ? records.filter(record => record.date === date) : records;
  }

  async createAttendanceRecord(insertRecord: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const record: AttendanceRecord = {
      id: randomUUID(),
      ...insertRecord,
      jamTidur: insertRecord.jamTidur || null,
      fitToWork: insertRecord.fitToWork || null,
      status: insertRecord.status || "present",
      createdAt: new Date()
    };
    this.attendanceRecords.set(record.id, record);
    return record;
  }

  // Roster methods
  async getRosterSchedule(id: string): Promise<RosterSchedule | undefined> {
    return this.rosterSchedules.get(id);
  }

  async getRosterByDate(date: string): Promise<RosterSchedule[]> {
    console.log(`Filtering roster schedules for date: ${date}`);
    const filtered = Array.from(this.rosterSchedules.values()).filter(schedule => schedule.date === date);
    console.log(`Found ${filtered.length} schedules for date ${date}`);
    return filtered;
  }

  async getRosterByEmployee(employeeId: string): Promise<RosterSchedule[]> {
    return Array.from(this.rosterSchedules.values()).filter(schedule => schedule.employeeId === employeeId);
  }

  async createRosterSchedule(insertSchedule: InsertRosterSchedule): Promise<RosterSchedule> {
    const schedule: RosterSchedule = {
      id: randomUUID(),
      ...insertSchedule,
      jamTidur: insertSchedule.jamTidur ?? null,
      hariKerja: insertSchedule.hariKerja ?? null,
      fitToWork: insertSchedule.fitToWork || "Fit To Work",
      status: insertSchedule.status || "scheduled"
    };
    this.rosterSchedules.set(schedule.id, schedule);
    return schedule;
  }

  async updateRosterSchedule(id: string, updateData: Partial<InsertRosterSchedule>): Promise<RosterSchedule | undefined> {
    const existing = this.rosterSchedules.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.rosterSchedules.set(id, updated);
    return updated;
  }

  async deleteRosterSchedule(id: string): Promise<boolean> {
    return this.rosterSchedules.delete(id);
  }

  async deleteAllRosterSchedules(): Promise<void> {
    this.rosterSchedules.clear();
  }

  // Leave methods
  async getLeaveRequest(id: string): Promise<LeaveRequest | undefined> {
    return this.leaveRequests.get(id);
  }

  async getLeaveByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    return Array.from(this.leaveRequests.values()).filter(request => request.employeeId === employeeId);
  }

  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    return Array.from(this.leaveRequests.values());
  }

  async getLeaveRequests(): Promise<LeaveRequest[]> {
    return this.getAllLeaveRequests();
  }

  async createLeaveRequest(insertRequest: InsertLeaveRequest): Promise<LeaveRequest> {
    const request: LeaveRequest = {
      id: randomUUID(),
      ...insertRequest,
      reason: insertRequest.reason ?? null, // Ensure reason is string | null, not undefined
      attachmentPath: insertRequest.attachmentPath ?? null, // Ensure attachmentPath is string | null, not undefined
      actionAttachmentPath: insertRequest.actionAttachmentPath ?? null, // Fix actionAttachmentPath
      status: insertRequest.status || "pending",
      createdAt: new Date()
    };
    this.leaveRequests.set(request.id, request);
    return request;
  }

  async updateLeaveRequest(id: string, updateData: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined> {
    const existing = this.leaveRequests.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.leaveRequests.set(id, updated);
    return updated;
  }

  async deleteLeaveRequest(id: string): Promise<boolean> {
    return this.leaveRequests.delete(id);
  }

  // QR Token methods
  async getQrToken(employeeId: string): Promise<QrToken | undefined> {
    return Array.from(this.qrTokens.values()).find(token => 
      token.employeeId === employeeId && token.isActive
    );
  }

  async getQrTokensByEmployee(employeeId: string): Promise<QrToken[]> {
    return Array.from(this.qrTokens.values()).filter(token => 
      token.employeeId === employeeId
    );
  }

  async createQrToken(insertToken: InsertQrToken): Promise<QrToken> {
    // Deactivate existing tokens for this employee
    Array.from(this.qrTokens.values())
      .filter(token => token.employeeId === insertToken.employeeId)
      .forEach(token => {
        token.isActive = false;
        this.qrTokens.set(token.id, token);
      });

    const token: QrToken = {
      id: randomUUID(),
      ...insertToken,
      isActive: insertToken.isActive !== undefined ? insertToken.isActive : true,
      createdAt: new Date()
    };
    this.qrTokens.set(token.id, token);
    return token;
  }

  async validateQrToken(employeeId: string, token: string): Promise<boolean> {
    const qrToken = await this.getQrToken(employeeId);
    return qrToken ? qrToken.token === token && qrToken.isActive : false;
  }


  // Stub implementations for MemStorage (not used in production)
  async getLeaveReminder(leaveRequestId: string, reminderType: string): Promise<LeaveReminder | undefined> {
    return undefined;
  }

  async getLeaveReminders(): Promise<LeaveReminder[]> {
    return [];
  }

  async saveLeaveReminder(reminder: InsertLeaveReminder): Promise<LeaveReminder> {
    const leaveReminder: LeaveReminder = {
      ...reminder,
      createdAt: new Date()
    };
    return leaveReminder;
  }

  async getLeaveBalances(): Promise<LeaveBalance[]> {
    return [];
  }

  async getLeaveBalanceByEmployee(employeeId: string, year?: number): Promise<LeaveBalance | undefined> {
    return undefined;
  }

  async createLeaveBalance(balance: InsertLeaveBalance): Promise<LeaveBalance> {
    const leaveBalance: LeaveBalance = {
      id: randomUUID(),
      ...balance,
      status: balance.status ?? 'active',
      totalDays: balance.totalDays ?? 0,
      usedDays: balance.usedDays ?? 0,
      remainingDays: balance.remainingDays ?? 0,
      workingDaysCompleted: balance.workingDaysCompleted ?? 0,
      lastWorkDate: balance.lastWorkDate ?? null,
      lastLeaveDate: balance.lastLeaveDate ?? null,
      nextLeaveEligible: balance.nextLeaveEligible ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return leaveBalance;
  }

  async updateLeaveBalance(id: string, balance: Partial<InsertLeaveBalance>): Promise<LeaveBalance | undefined> {
    return undefined;
  }

  async calculateLeaveEligibility(employeeId: string): Promise<{ eligible: boolean; daysEarned: number; nextEligibleDate: string | null }> {
    return { eligible: false, daysEarned: 0, nextEligibleDate: null };
  }

  async getLeaveHistory(): Promise<LeaveHistory[]> {
    return [];
  }

  async getLeaveHistoryByEmployee(employeeId: string): Promise<LeaveHistory[]> {
    return [];
  }

  async createLeaveHistory(history: InsertLeaveHistory): Promise<LeaveHistory> {
    const leaveHistory: LeaveHistory = {
      id: randomUUID(),
      ...history,
      leaveRequestId: history.leaveRequestId ?? null,
      remarks: history.remarks ?? null,
      createdAt: new Date()
    };
    return leaveHistory;
  }

  async bulkUploadLeaveRoster(data: Array<{ nik: string; leaveType: string; startDate: string; endDate: string; totalDays: number }>): Promise<{ success: number; errors: string[] }> {
    return { success: 0, errors: ["MemStorage does not support bulk operations"] };
  }

  // Leave Roster Monitoring methods for MemStorage
  async getLeaveRosterMonitoring(id: string): Promise<LeaveRosterMonitoring | undefined> {
    return undefined;
  }

  async getLeaveRosterMonitoringByNik(nik: string): Promise<LeaveRosterMonitoring | undefined> {
    return undefined;
  }

  async getAllLeaveRosterMonitoring(): Promise<LeaveRosterMonitoring[]> {
    return [];
  }

  async createLeaveRosterMonitoring(monitoring: InsertLeaveRosterMonitoring): Promise<LeaveRosterMonitoring> {
    const leaveRosterMonitoring: LeaveRosterMonitoring = {
      id: randomUUID(),
      ...monitoring,
      nomorLambung: monitoring.nomorLambung ?? null,
      lastLeaveDate: monitoring.lastLeaveDate ?? null,
      nextLeaveDate: monitoring.nextLeaveDate ?? null,
      onSite: monitoring.onSite ?? null,
      status: monitoring.status || "Aktif",
      monitoringDays: monitoring.monitoringDays || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.leaveRosterMonitoring.set(leaveRosterMonitoring.id, leaveRosterMonitoring);
    return leaveRosterMonitoring;
  }

  async updateLeaveRosterMonitoring(id: string, monitoring: Partial<InsertLeaveRosterMonitoring>): Promise<LeaveRosterMonitoring | undefined> {
    return undefined;
  }

  async deleteLeaveRosterMonitoring(id: string): Promise<boolean> {
    return false;
  }

  async deleteAllLeaveRosterMonitoring(): Promise<void> {
    // No-op in memory storage - would clear leave roster monitoring data if implemented
  }

  async updateLeaveRosterStatus(): Promise<void> {
    // No-op in memory storage
  }

  // SIMPER Monitoring methods implementation
  async getSimperMonitoring(id: string): Promise<SimperMonitoring | undefined> {
    return this.simperMonitoring.get(id);
  }

  async getSimperMonitoringByNik(nik: string): Promise<SimperMonitoring | undefined> {
    return Array.from(this.simperMonitoring.values()).find(simper => simper.nik === nik);
  }

  async getAllSimperMonitoring(): Promise<SimperMonitoring[]> {
    return Array.from(this.simperMonitoring.values());
  }

  async createSimperMonitoring(simperData: InsertSimperMonitoring): Promise<SimperMonitoring> {
    const simper: SimperMonitoring = {
      id: randomUUID(),
      ...simperData,
      simperBibExpiredDate: simperData.simperBibExpiredDate ?? null,
      simperTiaExpiredDate: simperData.simperTiaExpiredDate ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.simperMonitoring.set(simper.id, simper);
    return simper;
  }

  async updateSimperMonitoring(id: string, simperData: Partial<InsertSimperMonitoring>): Promise<SimperMonitoring | undefined> {
    const existing = this.simperMonitoring.get(id);
    if (existing) {
      const updated: SimperMonitoring = {
        ...existing,
        ...simperData,
        updatedAt: new Date()
      };
      this.simperMonitoring.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async deleteSimperMonitoring(id: string): Promise<boolean> {
    return this.simperMonitoring.delete(id);
  }

  async deleteAllSimperMonitoring(): Promise<void> {
    this.simperMonitoring.clear();
  }

  async bulkUploadSimperData(data: Array<{ employeeName: string; nik: string; simperBibExpiredDate?: string; simperTiaExpiredDate?: string }>): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    for (const item of data) {
      try {
        if (!item.employeeName || !item.nik) {
          errors.push(`Data tidak lengkap untuk NIK: ${item.nik || 'kosong'}`);
          continue;
        }

        // Check if NIK already exists
        const existing = await this.getSimperMonitoringByNik(item.nik);
        if (existing) {
          // Update existing record
          await this.updateSimperMonitoring(existing.id, {
            employeeName: item.employeeName,
            simperBibExpiredDate: item.simperBibExpiredDate || null,
            simperTiaExpiredDate: item.simperTiaExpiredDate || null
          });
        } else {
          // Create new record
          await this.createSimperMonitoring({
            employeeName: item.employeeName,
            nik: item.nik,
            simperBibExpiredDate: item.simperBibExpiredDate || null,
            simperTiaExpiredDate: item.simperTiaExpiredDate || null
          });
        }
        success++;
      } catch (error) {
        errors.push(`Error untuk NIK ${item.nik}: ${error}`);
      }
    }

    return { success, errors };
  }

  // Meeting methods implementation for MemStorage
  async getMeeting(id: string): Promise<Meeting | undefined> {
    return this.meetings.get(id);
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return Array.from(this.meetings.values());
  }

  async getMeetingsByDate(date: string): Promise<Meeting[]> {
    return Array.from(this.meetings.values()).filter(meeting => meeting.date === date);
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    // Generate unique QR token for the meeting
    const qrToken = randomUUID().replace(/-/g, '').substring(0, 12);
    const meeting: Meeting = {
      id: randomUUID(),
      ...insertMeeting,
      status: insertMeeting.status || "scheduled",
      description: insertMeeting.description ?? null,
      qrToken,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.meetings.set(meeting.id, meeting);
    return meeting;
  }

  async updateMeeting(id: string, updateData: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const existing = this.meetings.get(id);
    if (!existing) return undefined;
    
    const updated = { 
      ...existing, 
      ...updateData, 
      updatedAt: new Date() 
    };
    this.meetings.set(id, updated);
    return updated;
  }

  async deleteMeeting(id: string): Promise<boolean> {
    return this.meetings.delete(id);
  }

  async getMeetingByQrToken(qrToken: string): Promise<Meeting | undefined> {
    return Array.from(this.meetings.values()).find(meeting => meeting.qrToken === qrToken);
  }

  // Meeting attendance methods implementation for MemStorage
  async getMeetingAttendance(meetingId: string): Promise<MeetingAttendance[]> {
    return Array.from(this.meetingAttendance.values()).filter(attendance => attendance.meetingId === meetingId);
  }

  async createMeetingAttendance(insertAttendance: InsertMeetingAttendance): Promise<MeetingAttendance> {
    const attendance: MeetingAttendance = {
      id: randomUUID(),
      ...insertAttendance,
      employeeId: insertAttendance.employeeId ?? null,
      deviceInfo: insertAttendance.deviceInfo ?? null,
      attendanceType: insertAttendance.attendanceType || "qr_scan",
      manualName: insertAttendance.manualName ?? null,
      manualPosition: insertAttendance.manualPosition ?? null,
      manualDepartment: insertAttendance.manualDepartment ?? null,
      createdAt: new Date()
    };
    this.meetingAttendance.set(attendance.id, attendance);
    return attendance;
  }

  async checkMeetingAttendance(meetingId: string, employeeId: string): Promise<MeetingAttendance | undefined> {
    return Array.from(this.meetingAttendance.values()).find(attendance => 
      attendance.meetingId === meetingId && attendance.employeeId === employeeId
    );
  }

  async deleteMeetingAttendance(attendanceId: string): Promise<boolean> {
    return this.meetingAttendance.delete(attendanceId);
  }
}

// DrizzleStorage implementation using PostgreSQL
export class DrizzleStorage implements IStorage {
  private db;

  constructor() {
    const sql = neon(process.env.DATABASE_URL!);
    this.db = drizzle(sql);
  }

  // User operations implementation (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Employee methods
  async getEmployee(id: string): Promise<Employee | undefined> {
    const result = await this.db.select().from(employees).where(eq(employees.id, id));
    return result[0];
  }

  async getAllEmployees(): Promise<Employee[]> {
    return await this.db.select().from(employees);
  }

  async getEmployees(): Promise<Employee[]> {
    return this.getAllEmployees();
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const result = await this.db.insert(employees).values(insertEmployee).returning();
    return result[0];
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const result = await this.db.update(employees).set(updateData).where(eq(employees.id, id)).returning();
    return result[0];
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await this.db.delete(employees).where(eq(employees.id, id));
    return true;
  }

  async deleteAllEmployees(): Promise<boolean> {
    // Delete all related data first to avoid foreign key constraints
    console.log('🗑️ Deleting all attendance records...');
    await this.db.delete(attendanceRecords);
    
    console.log('🗑️ Deleting all leave requests...');
    await this.db.delete(leaveRequests);
    
    console.log('🗑️ Deleting all leave roster monitoring...');
    await this.db.delete(leaveRosterMonitoring);
    
    console.log('🗑️ Deleting all QR tokens...');
    await this.db.delete(qrTokens);
    
    console.log('🗑️ Deleting all roster schedules...');
    await this.db.delete(rosterSchedules);
    
    console.log('🗑️ Deleting all employees...');
    await this.db.delete(employees);
    
    console.log('✅ All employee data and related records deleted successfully');
    return true;
  }

  // Attendance methods
  async getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined> {
    const result = await this.db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id));
    return result[0];
  }

  async getAttendanceByEmployee(employeeId: string, date?: string): Promise<AttendanceRecord[]> {
    if (date) {
      return await this.db.select().from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.date, date)));
    }
    return await this.db.select().from(attendanceRecords).where(eq(attendanceRecords.employeeId, employeeId));
  }

  async getAllAttendance(date?: string): Promise<AttendanceRecord[]> {
    if (date) {
      return await this.db.select().from(attendanceRecords).where(eq(attendanceRecords.date, date));
    }
    return await this.db.select().from(attendanceRecords);
  }

  async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const result = await this.db.insert(attendanceRecords).values(record).returning();
    return result[0];
  }

  // Roster methods
  async getRosterSchedule(id: string): Promise<RosterSchedule | undefined> {
    const result = await this.db.select().from(rosterSchedules).where(eq(rosterSchedules.id, id));
    return result[0];
  }

  async getRosterByDate(date: string): Promise<RosterSchedule[]> {
    return await this.db.select().from(rosterSchedules).where(eq(rosterSchedules.date, date));
  }

  async getRosterByEmployee(employeeId: string): Promise<RosterSchedule[]> {
    return await this.db.select().from(rosterSchedules).where(eq(rosterSchedules.employeeId, employeeId));
  }

  async createRosterSchedule(schedule: InsertRosterSchedule): Promise<RosterSchedule> {
    const result = await this.db.insert(rosterSchedules).values(schedule).returning();
    return result[0];
  }

  async updateRosterSchedule(id: string, updateData: Partial<InsertRosterSchedule>): Promise<RosterSchedule | undefined> {
    const result = await this.db.update(rosterSchedules).set(updateData).where(eq(rosterSchedules.id, id)).returning();
    return result[0];
  }

  async deleteRosterSchedule(id: string): Promise<boolean> {
    await this.db.delete(rosterSchedules).where(eq(rosterSchedules.id, id));
    return true;
  }

  async deleteAllRosterSchedules(): Promise<void> {
    await this.db.delete(rosterSchedules);
  }

  // Leave methods
  async getLeaveRequest(id: string): Promise<LeaveRequest | undefined> {
    const result = await this.db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return result[0];
  }

  async getLeaveByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    return await this.db.select().from(leaveRequests).where(eq(leaveRequests.employeeId, employeeId));
  }

  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    return await this.db.select().from(leaveRequests);
  }

  async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
    const result = await this.db.insert(leaveRequests).values(request).returning();
    return result[0];
  }

  async updateLeaveRequest(id: string, updateData: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined> {
    const result = await this.db.update(leaveRequests).set(updateData).where(eq(leaveRequests.id, id)).returning();
    return result[0];
  }

  async deleteLeaveRequest(id: string): Promise<boolean> {
    const result = await this.db.delete(leaveRequests).where(eq(leaveRequests.id, id)).returning();
    return result.length > 0;
  }

  // QR Token methods
  async getQrToken(employeeId: string): Promise<QrToken | undefined> {
    const result = await this.db.select().from(qrTokens)
      .where(and(eq(qrTokens.employeeId, employeeId), eq(qrTokens.isActive, true)));
    return result[0];
  }

  async getQrTokensByEmployee(employeeId: string): Promise<QrToken[]> {
    return await this.db.select().from(qrTokens).where(eq(qrTokens.employeeId, employeeId));
  }

  async createQrToken(insertToken: InsertQrToken): Promise<QrToken> {
    // Deactivate existing tokens for this employee
    await this.db.update(qrTokens)
      .set({ isActive: false })
      .where(eq(qrTokens.employeeId, insertToken.employeeId));

    const result = await this.db.insert(qrTokens).values(insertToken).returning();
    return result[0];
  }

  async validateQrToken(employeeId: string, token: string): Promise<boolean> {
    const qrToken = await this.getQrToken(employeeId);
    return qrToken ? qrToken.token === token && qrToken.isActive : false;
  }

  // Compatibility methods
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    return this.getAllLeaveRequests();
  }

  // Leave Reminder methods
  async getLeaveReminder(leaveRequestId: string, reminderType: string): Promise<LeaveReminder | undefined> {
    const reminderId = `${leaveRequestId}_${reminderType}`;
    const result = await this.db.select().from(leaveReminders).where(eq(leaveReminders.id, reminderId));
    return result[0];
  }

  async getLeaveReminders(): Promise<LeaveReminder[]> {
    return await this.db.select().from(leaveReminders);
  }

  async saveLeaveReminder(reminder: InsertLeaveReminder): Promise<LeaveReminder> {
    const result = await this.db.insert(leaveReminders).values(reminder).returning();
    return result[0];
  }

  // Leave Balance methods
  async getLeaveBalances(): Promise<LeaveBalance[]> {
    return await this.db.select().from(leaveBalances);
  }

  async getLeaveBalanceByEmployee(employeeId: string, year?: number): Promise<LeaveBalance | undefined> {
    const currentYear = year || new Date().getFullYear();
    const result = await this.db.select().from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, currentYear)));
    return result[0];
  }

  async createLeaveBalance(balance: InsertLeaveBalance): Promise<LeaveBalance> {
    const result = await this.db.insert(leaveBalances).values(balance).returning();
    return result[0];
  }

  async updateLeaveBalance(id: string, balance: Partial<InsertLeaveBalance>): Promise<LeaveBalance | undefined> {
    const result = await this.db.update(leaveBalances).set(balance).where(eq(leaveBalances.id, id)).returning();
    return result[0];
  }

  async calculateLeaveEligibility(employeeId: string): Promise<{ eligible: boolean; daysEarned: number; nextEligibleDate: string | null }> {
    // Implementasi perhitungan cuti berdasarkan kebijakan perusahaan
    // 70 hari kerja = 14 hari cuti, 35 hari kerja = 7 hari cuti
    
    const currentYear = new Date().getFullYear();
    const balance = await this.getLeaveBalanceByEmployee(employeeId, currentYear);
    
    if (!balance) {
      return { eligible: false, daysEarned: 0, nextEligibleDate: null };
    }

    const workingDays = balance.workingDaysCompleted;
    let daysEarned = 0;
    
    // Hitung cuti berdasarkan hari kerja
    if (workingDays >= 70) {
      daysEarned = Math.floor(workingDays / 70) * 14;
      const remainder = workingDays % 70;
      if (remainder >= 35) {
        daysEarned += 7;
      }
    } else if (workingDays >= 35) {
      daysEarned = 7;
    }

    const nextEligibleWorkDays = workingDays < 35 ? 35 : (Math.floor(workingDays / 35) + 1) * 35;
    const daysUntilEligible = nextEligibleWorkDays - workingDays;
    
    const nextEligibleDate = new Date();
    nextEligibleDate.setDate(nextEligibleDate.getDate() + daysUntilEligible);

    return {
      eligible: daysEarned > balance.usedDays,
      daysEarned,
      nextEligibleDate: daysUntilEligible > 0 ? nextEligibleDate.toISOString().split('T')[0] : null
    };
  }

  // Leave History methods
  async getLeaveHistory(): Promise<LeaveHistory[]> {
    return await this.db.select().from(leaveHistory);
  }

  async getLeaveHistoryByEmployee(employeeId: string): Promise<LeaveHistory[]> {
    return await this.db.select().from(leaveHistory).where(eq(leaveHistory.employeeId, employeeId));
  }

  async createLeaveHistory(history: InsertLeaveHistory): Promise<LeaveHistory> {
    const result = await this.db.insert(leaveHistory).values(history).returning();
    return result[0];
  }

  // Bulk upload methods
  async bulkUploadLeaveRoster(data: Array<{ nik: string; leaveType: string; startDate: string; endDate: string; totalDays: number }>): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let successCount = 0;

    try {
      // Batch fetch all employees at once to avoid N+1 queries
      const allEmployees = await this.getAllEmployees();
      const employeeMap = new Map(allEmployees.map(emp => [emp.id, emp]));

      // Batch fetch all existing leave balances
      const currentYear = new Date().getFullYear();
      const allBalances = await db.select().from(leaveBalances).where(eq(leaveBalances.year, currentYear));
      const balanceMap = new Map(allBalances.map(balance => [balance.employeeId, balance]));

      // Prepare data for bulk operations
      const validItems: Array<{
        item: typeof data[0];
        employee: any;
        rowIndex: number;
      }> = [];

      // Pre-validate all data
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        
        // Validasi employee exists
        const employee = employeeMap.get(item.nik);
        if (!employee) {
          errors.push(`Baris ${i + 1}: Karyawan dengan NIK ${item.nik} tidak ditemukan`);
          continue;
        }

        // Validasi format tanggal
        const startDate = new Date(item.startDate);
        const endDate = new Date(item.endDate);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          errors.push(`Baris ${i + 1}: Format tanggal tidak valid`);
          continue;
        }

        if (startDate > endDate) {
          errors.push(`Baris ${i + 1}: Tanggal mulai tidak boleh lebih besar dari tanggal selesai`);
          continue;
        }

        validItems.push({ item, employee, rowIndex: i + 1 });
      }

      // Process items in smaller batches for better performance
      const BATCH_SIZE = 50;
      const batches = [];
      for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        batches.push(validItems.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        // Create leave requests for this batch
        const leaveRequests = await Promise.all(
          batch.map(({ item, employee }) =>
            this.createLeaveRequest({
              employeeId: item.nik,
              employeeName: employee.name,
              phoneNumber: employee.phone,
              startDate: item.startDate,
              endDate: item.endDate,
              leaveType: item.leaveType,
              reason: 'Bulk upload roster cuti',
              status: 'approved'
            })
          )
        );

        // Process balances and histories for this batch
        const batchOperations: Array<Promise<any>> = [];

        for (let i = 0; i < batch.length; i++) {
          const { item } = batch[i];
          const leaveRequest = leaveRequests[i];

          let balance = balanceMap.get(item.nik);
          let balanceBeforeLeave = 14;
          let balanceAfterLeave = 14 - item.totalDays;

          if (!balance) {
            const newBalance = this.createLeaveBalance({
              employeeId: item.nik,
              year: currentYear,
              totalDays: 14,
              usedDays: item.totalDays,
              remainingDays: 14 - item.totalDays,
              workingDaysCompleted: 70,
              lastLeaveDate: item.endDate
            });
            batchOperations.push(newBalance);
          } else {
            balanceBeforeLeave = balance.remainingDays;
            balanceAfterLeave = balance.remainingDays - item.totalDays;
            
            const updateBalance = this.updateLeaveBalance(balance.id, {
              usedDays: balance.usedDays + item.totalDays,
              remainingDays: balance.remainingDays - item.totalDays,
              lastLeaveDate: item.endDate
            });
            batchOperations.push(updateBalance);
          }

          // Create leave history
          const historyCreation = this.createLeaveHistory({
            employeeId: item.nik,
            leaveRequestId: leaveRequest.id,
            leaveType: item.leaveType,
            startDate: item.startDate,
            endDate: item.endDate,
            totalDays: item.totalDays,
            balanceBeforeLeave,
            balanceAfterLeave,
            status: 'taken'
          });
          batchOperations.push(historyCreation);
        }

        // Execute batch operations
        await Promise.all(batchOperations);
      }

      successCount = validItems.length;

    } catch (error) {
      console.error('Error in bulk upload:', error);
      errors.push(`Error sistem: ${error instanceof Error ? error.message : 'Error tidak diketahui'}`);
    }

    return { success: successCount, errors };
  }


  // Leave Roster Monitoring methods implementation
  async getLeaveRosterMonitoring(id: string): Promise<LeaveRosterMonitoring | undefined> {
    const [result] = await this.db
      .select()
      .from(leaveRosterMonitoring)
      .where(eq(leaveRosterMonitoring.id, id));
    return result;
  }

  async getLeaveRosterMonitoringByNik(nik: string): Promise<LeaveRosterMonitoring | undefined> {
    const [result] = await this.db
      .select()
      .from(leaveRosterMonitoring)
      .where(eq(leaveRosterMonitoring.nik, nik));
    return result;
  }

  async getAllLeaveRosterMonitoring(): Promise<LeaveRosterMonitoring[]> {
    return await this.db
      .select()
      .from(leaveRosterMonitoring)
      .orderBy(drizzleSql`created_at DESC`);
  }

  async getLeaveRosterMonitoringByStatus(status: string): Promise<LeaveRosterMonitoring[]> {
    return await this.db
      .select()
      .from(leaveRosterMonitoring)
      .where(eq(leaveRosterMonitoring.status, status))
      .orderBy(drizzleSql`created_at DESC`);
  }

  async createLeaveRosterMonitoring(monitoring: InsertLeaveRosterMonitoring): Promise<LeaveRosterMonitoring> {
    const [result] = await this.db
      .insert(leaveRosterMonitoring)
      .values(monitoring)
      .returning();
    return result;
  }

  async updateLeaveRosterMonitoring(id: string, monitoring: Partial<InsertLeaveRosterMonitoring>): Promise<LeaveRosterMonitoring | undefined> {
    const [result] = await this.db
      .update(leaveRosterMonitoring)
      .set({ ...monitoring, updatedAt: drizzleSql`now()` })
      .where(eq(leaveRosterMonitoring.id, id))
      .returning();
    return result;
  }

  async deleteLeaveRosterMonitoring(id: string): Promise<boolean> {
    const result = await this.db
      .delete(leaveRosterMonitoring)
      .where(eq(leaveRosterMonitoring.id, id));
    return result.rowCount > 0;
  }

  async deleteAllLeaveRosterMonitoring(): Promise<void> {
    await this.db.delete(leaveRosterMonitoring);
  }

  async updateLeaveRosterStatus(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const allMonitoring = await this.getAllLeaveRosterMonitoring();

    for (const monitoring of allMonitoring) {
      let newStatus = monitoring.status;
      
      // RUMUS BARU: Terakhir Cuti - Today
      let monitoringDays = 0;
      if (monitoring.lastLeaveDate) {
        const lastLeaveDate = new Date(monitoring.lastLeaveDate);
        const todayDate = new Date(today);
        // Rumus baru: Terakhir Cuti - Today
        const diffTime = lastLeaveDate.getTime() - todayDate.getTime();
        monitoringDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        console.log(`[${monitoring.nik}] monitoringDays: ${monitoringDays} (${monitoringDays > 0 ? 'hari lagi' : monitoringDays < 0 ? 'sudah lewat' : 'hari ini'}), lastLeave=${monitoring.lastLeaveDate}`);
      }

      // Status berdasarkan rumus baru: Terakhir Cuti - Today
      console.log(`[${monitoring.nik}] Status check - monitoring days: ${monitoringDays}, current status: ${monitoring.status}`);
      
      // Aturan status baru:
      if (monitoringDays <= 10 && monitoringDays >= 0) {
        newStatus = "Menunggu Cuti";
        console.log(`[${monitoring.nik}] Set to Menunggu Cuti - ${monitoringDays} hari lagi menuju cuti`);
      } else if (monitoringDays > 10) {
        newStatus = "Aktif";
        console.log(`[${monitoring.nik}] Set to Aktif - masih ${monitoringDays} hari lagi`);
      } else if (monitoringDays < 0) {
        newStatus = "Cuti Selesai";
        console.log(`[${monitoring.nik}] Set to Cuti Selesai - sudah lewat ${Math.abs(monitoringDays)} hari`);
      }

      await this.updateLeaveRosterMonitoring(monitoring.id, {
        status: newStatus,
        monitoringDays
      });
    }
  }

  // Meeting methods implementation
  async getMeeting(id: string): Promise<Meeting | undefined> {
    const [result] = await this.db
      .select()
      .from(meetings)
      .where(eq(meetings.id, id));
    return result;
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return await this.db
      .select()
      .from(meetings)
      .orderBy(drizzleSql`created_at DESC`);
  }

  async getMeetingsByDate(date: string): Promise<Meeting[]> {
    return await this.db
      .select()
      .from(meetings)
      .where(eq(meetings.date, date))
      .orderBy(drizzleSql`start_time ASC`);
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    // Generate unique QR token for the meeting
    const qrToken = randomUUID().replace(/-/g, '').substring(0, 12);
    const meetingWithToken = { ...meeting, qrToken };
    
    const [result] = await this.db
      .insert(meetings)
      .values(meetingWithToken)
      .returning();
    return result;
  }

  async updateMeeting(id: string, meeting: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const [result] = await this.db
      .update(meetings)
      .set({ ...meeting, updatedAt: drizzleSql`now()` })
      .where(eq(meetings.id, id))
      .returning();
    return result;
  }

  async deleteMeeting(id: string): Promise<boolean> {
    const result = await this.db
      .delete(meetings)
      .where(eq(meetings.id, id));
    return result.rowCount > 0;
  }

  async getMeetingByQrToken(qrToken: string): Promise<Meeting | undefined> {
    const [result] = await this.db
      .select()
      .from(meetings)
      .where(eq(meetings.qrToken, qrToken));
    return result;
  }

  // Meeting attendance methods implementation
  async getMeetingAttendance(meetingId: string): Promise<MeetingAttendance[]> {
    return await this.db
      .select()
      .from(meetingAttendance)
      .where(eq(meetingAttendance.meetingId, meetingId))
      .orderBy(drizzleSql`created_at ASC`);
  }

  async createMeetingAttendance(attendance: InsertMeetingAttendance): Promise<MeetingAttendance> {
    const [result] = await this.db
      .insert(meetingAttendance)
      .values(attendance)
      .returning();
    return result;
  }

  async checkMeetingAttendance(meetingId: string, employeeId: string): Promise<MeetingAttendance | undefined> {
    const [result] = await this.db
      .select()
      .from(meetingAttendance)
      .where(and(
        eq(meetingAttendance.meetingId, meetingId),
        eq(meetingAttendance.employeeId, employeeId)
      ));
    return result;
  }

  async deleteMeetingAttendance(attendanceId: string): Promise<boolean> {
    const result = await this.db
      .delete(meetingAttendance)
      .where(eq(meetingAttendance.id, attendanceId));
    return result.rowCount > 0;
  }

  // SIMPER Monitoring methods implementation for DrizzleStorage
  async getSimperMonitoring(id: string): Promise<SimperMonitoring | undefined> {
    const [result] = await this.db
      .select()
      .from(simperMonitoring)
      .where(eq(simperMonitoring.id, id));
    return result;
  }

  async getSimperMonitoringByNik(nik: string): Promise<SimperMonitoring | undefined> {
    const [result] = await this.db
      .select()
      .from(simperMonitoring)
      .where(eq(simperMonitoring.nik, nik));
    return result;
  }

  async getAllSimperMonitoring(): Promise<SimperMonitoring[]> {
    return await this.db
      .select()
      .from(simperMonitoring)
      .orderBy(drizzleSql`created_at DESC`);
  }

  async createSimperMonitoring(simperData: InsertSimperMonitoring): Promise<SimperMonitoring> {
    const [result] = await this.db
      .insert(simperMonitoring)
      .values(simperData)
      .returning();
    return result;
  }

  async updateSimperMonitoring(id: string, simperData: Partial<InsertSimperMonitoring>): Promise<SimperMonitoring | undefined> {
    const [result] = await this.db
      .update(simperMonitoring)
      .set({
        ...simperData,
        updatedAt: new Date()
      })
      .where(eq(simperMonitoring.id, id))
      .returning();
    return result;
  }

  async deleteSimperMonitoring(id: string): Promise<boolean> {
    const result = await this.db
      .delete(simperMonitoring)
      .where(eq(simperMonitoring.id, id));
    return result.rowCount > 0;
  }

  async deleteAllSimperMonitoring(): Promise<void> {
    await this.db.delete(simperMonitoring);
  }

  async bulkUploadSimperData(data: Array<{ employeeName: string; nik: string; simperBibExpiredDate?: string; simperTiaExpiredDate?: string }>): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    console.log(`📤 Starting bulk upload of ${data.length} SIMPER records`);

    for (const [index, item] of data.entries()) {
      try {
        if (!item.employeeName || !item.nik) {
          const error = `Data tidak lengkap untuk baris ${index + 1} - Name: "${item.employeeName}", NIK: "${item.nik}"`;
          errors.push(error);
          console.log(`❌ ${error}`);
          continue;
        }

        // Trim and validate data
        const cleanName = item.employeeName.trim();
        const cleanNik = item.nik.trim();

        if (!cleanName || !cleanNik) {
          const error = `Data kosong setelah trim untuk baris ${index + 1}`;
          errors.push(error);
          console.log(`❌ ${error}`);
          continue;
        }

        // Check if NIK already exists
        const existing = await this.getSimperMonitoringByNik(cleanNik);
        
        const simperData = {
          employeeName: cleanName,
          simperBibExpiredDate: item.simperBibExpiredDate || null,
          simperTiaExpiredDate: item.simperTiaExpiredDate || null
        };

        if (existing) {
          // Update existing record
          console.log(`🔄 Updating existing SIMPER for ${cleanName} (${cleanNik})`);
          await this.updateSimperMonitoring(existing.id, simperData);
        } else {
          // Create new record
          console.log(`➕ Creating new SIMPER for ${cleanName} (${cleanNik})`);
          await this.createSimperMonitoring({
            ...simperData,
            nik: cleanNik
          });
        }
        
        success++;
        console.log(`✅ Processed ${cleanName} (${cleanNik}) - BIB: ${item.simperBibExpiredDate || 'Kosong'}, TIA: ${item.simperTiaExpiredDate || 'Kosong'}`);
        
      } catch (error) {
        const errorMsg = `Error untuk NIK ${item.nik} (baris ${index + 1}): ${error}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`📊 Bulk upload completed: ${success} success, ${errors.length} errors`);
    return { success, errors };
  }
}

// Use DrizzleStorage for PostgreSQL database
export const storage = new DrizzleStorage();
