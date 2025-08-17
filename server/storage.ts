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
  type InsertQrToken
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Employee methods
  getEmployee(id: string): Promise<Employee | undefined>;
  getAllEmployees(): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;

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
  
  // Leave methods
  getLeaveRequest(id: string): Promise<LeaveRequest | undefined>;
  getLeaveByEmployee(employeeId: string): Promise<LeaveRequest[]>;
  getAllLeaveRequests(): Promise<LeaveRequest[]>;
  createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequest(id: string, request: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined>;
  
  // QR Token methods
  getQrToken(employeeId: string): Promise<QrToken | undefined>;
  getQrTokensByEmployee(employeeId: string): Promise<QrToken[]>;
  createQrToken(token: InsertQrToken): Promise<QrToken>;
  validateQrToken(employeeId: string, token: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private employees: Map<string, Employee>;
  private attendanceRecords: Map<string, AttendanceRecord>;
  private rosterSchedules: Map<string, RosterSchedule>;
  private leaveRequests: Map<string, LeaveRequest>;
  private qrTokens: Map<string, QrToken>;

  constructor() {
    this.employees = new Map();
    this.attendanceRecords = new Map();
    this.rosterSchedules = new Map();
    this.leaveRequests = new Map();
    this.qrTokens = new Map();
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample employees
    const sampleEmployees: Employee[] = [
      { id: 'C-00001', name: 'Budi Santoso', nomorLambung: 'GECL 9001', phone: '+6281234567890', shift: 'Shift 1', status: 'active', createdAt: new Date() },
      { id: 'C-00002', name: 'Siti Aisyah', nomorLambung: 'GECL 9002', phone: '+6281234567891', shift: 'Shift 2', status: 'active', createdAt: new Date() },
      { id: 'C-00003', name: 'Ahmad Fauzi', nomorLambung: 'GECL 9003', phone: '+6281234567892', shift: 'Shift 1', status: 'active', createdAt: new Date() },
      { id: 'C-00004', name: 'Dewi Lestari', nomorLambung: 'GECL 9004', phone: '+6281234567893', shift: 'Shift 1', status: 'active', createdAt: new Date() },
      { id: 'C-00005', name: 'Rudi Hermawan', nomorLambung: 'GECL 9005', phone: '+6281234567894', shift: 'Shift 2', status: 'active', createdAt: new Date() },
    ];

    sampleEmployees.forEach(emp => this.employees.set(emp.id, emp));

    // Sample roster for today
    const today = new Date().toISOString().split('T')[0];
    const sampleRoster: RosterSchedule[] = [
      { id: randomUUID(), employeeId: 'C-00001', date: today, shift: 'Shift 1', startTime: '08:00', endTime: '16:00', jamTidur: '6', status: 'scheduled' },
      { id: randomUUID(), employeeId: 'C-00002', date: today, shift: 'Shift 2', startTime: '14:00', endTime: '22:00', jamTidur: '5', status: 'scheduled' },
      { id: randomUUID(), employeeId: 'C-00004', date: today, shift: 'Shift 1', startTime: '08:00', endTime: '16:00', jamTidur: '6', status: 'scheduled' },
      { id: randomUUID(), employeeId: 'C-00005', date: today, shift: 'Shift 2', startTime: '14:00', endTime: '22:00', jamTidur: '5', status: 'scheduled' },
    ];

    sampleRoster.forEach(roster => this.rosterSchedules.set(roster.id, roster));

    // Sample attendance
    const sampleAttendance: AttendanceRecord[] = [
      { id: randomUUID(), employeeId: 'C-00001', date: today, time: '08:15', status: 'present', createdAt: new Date() },
    ];

    sampleAttendance.forEach(att => this.attendanceRecords.set(att.id, att));

    // Sample leave requests
    const sampleLeave: LeaveRequest[] = [
      { 
        id: randomUUID(), 
        employeeId: 'C-00003', 
        startDate: '2024-12-15', 
        endDate: '2024-12-17', 
        leaveType: 'annual', 
        reason: 'Liburan keluarga', 
        status: 'pending',
        createdAt: new Date()
      },
    ];

    sampleLeave.forEach(leave => this.leaveRequests.set(leave.id, leave));
  }

  // Employee methods
  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async getAllEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
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
  
  private generateNextNomorLambung(): string {
    const existingEmployees = Array.from(this.employees.values());
    const existingNumbers = existingEmployees
      .map(emp => {
        const match = emp.nomorLambung?.match(/^GECL (\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 9000;
    const nextNumber = maxNumber + 1;
    return `GECL ${nextNumber}`;
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    // Generate NIK automatically if not provided or if using old format
    const id = insertEmployee.id || this.generateNextNIK();
    
    // Generate Nomor Lambung automatically if not provided
    const nomorLambung = insertEmployee.nomorLambung || this.generateNextNomorLambung();
    
    const employee: Employee = { 
      ...insertEmployee,
      id,
      nomorLambung,
      status: insertEmployee.status || "active",
      createdAt: new Date() 
    };
    this.employees.set(employee.id, employee);
    return employee;
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const existing = this.employees.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.employees.set(id, updated);
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    return this.employees.delete(id);
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
    return Array.from(this.rosterSchedules.values()).filter(schedule => schedule.date === date);
  }

  async getRosterByEmployee(employeeId: string): Promise<RosterSchedule[]> {
    return Array.from(this.rosterSchedules.values()).filter(schedule => schedule.employeeId === employeeId);
  }

  async createRosterSchedule(insertSchedule: InsertRosterSchedule): Promise<RosterSchedule> {
    const schedule: RosterSchedule = {
      id: randomUUID(),
      ...insertSchedule,
      jamTidur: insertSchedule.jamTidur || null,
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

  async createLeaveRequest(insertRequest: InsertLeaveRequest): Promise<LeaveRequest> {
    const request: LeaveRequest = {
      id: randomUUID(),
      ...insertRequest,
      reason: insertRequest.reason || null, // Ensure reason is string | null, not undefined
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
}

export const storage = new MemStorage();
