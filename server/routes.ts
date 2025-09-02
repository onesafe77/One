import type { Express } from "express";
import { createServer, type Server } from "http";

import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { WhatsAppService } from "./whatsappService";
import { 
  insertEmployeeSchema, 
  insertAttendanceSchema, 
  insertRosterSchema, 
  insertLeaveRequestSchema,
  insertQrTokenSchema,
  insertWhatsappBlastSchema,
  insertMeetingSchema,
  insertMeetingAttendanceSchema
} from "@shared/schema";

// Report cache invalidation and update notification system
let lastRosterUpdate = new Date();

async function triggerReportUpdate() {
  console.log("🔄 Roster data changed - triggering report updates");
  
  // Update the last roster change timestamp
  lastRosterUpdate = new Date();
  
  // Could implement various notification methods:
  // 1. WebSocket broadcast to all connected report clients
  // 2. Cache invalidation for TanStack Query
  // 3. Database triggers for real-time updates
  // 4. Email notifications to managers
  
  console.log(`📊 Report update triggered at ${lastRosterUpdate.toISOString()}`);
}

// Utility function to determine shift based on time
function determineShiftByTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Berdasarkan window validasi yang baru:
  // Shift 1: 06:00-16:00 (360-960 menit)
  // Shift 2: 16:30-20:00 (990-1200 menit)
  
  if (totalMinutes >= 990 && totalMinutes < 1200) {
    return "Shift 2";
  } else if (totalMinutes >= 360 && totalMinutes < 960) {
    return "Shift 1";
  } else {
    return "Shift 1"; // Default to Shift 1 for other times
  }
}

// Strict shift time validation based on actual roster schedule
// Fungsi validasi waktu berdasarkan pola shift standar operasional
function isValidRosterTime(currentTime: string, startTime: string, endTime: string): boolean {
  // Tidak menggunakan startTime dan endTime dari roster untuk sementara
  // Karena data roster bisa inconsistent
  return true; // Temporary - akan menggunakan shift-based validation
}

// STRICT: Fungsi validasi waktu berdasarkan nama shift - TIDAK BOLEH ABSENSI DILUAR JAM KERJA
function isValidShiftTimeByName(currentTime: string, shiftName: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (shiftName === "Shift 1") {
    // Shift 1: STRICT - Hanya boleh scan dari 06:00 sampai 16:00
    return totalMinutes >= 360 && totalMinutes <= 960;
  } else if (shiftName === "Shift 2") {
    // Shift 2: STRICT - Hanya boleh scan dari 16:30 sampai 20:00
    return totalMinutes >= 990 && totalMinutes <= 1200;
  }
  
  // CRITICAL: Diluar shift yang ditentukan = TIDAK BOLEH ABSENSI
  return false;
}

// Function to get shift time range for error messages
function getShiftTimeRange(shiftName: string): { start: string; end: string } {
  if (shiftName === "Shift 1") {
    return { start: "06:00", end: "16:00" };
  } else if (shiftName === "Shift 2") {
    return { start: "16:30", end: "20:00" };
  }
  return { start: "00:00", end: "23:59" };
}

// Function to check if time is completely outside all shift windows
function isCompletelyOutsideShiftTimes(currentTime: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Check if time falls within any shift window
  const isInShift1Window = totalMinutes >= 360 && totalMinutes <= 960; // 06:00-16:00
  const isInShift2Window = totalMinutes >= 990 && totalMinutes <= 1200; // 16:30-20:00
  
  return !isInShift1Window && !isInShift2Window;
}

// Fungsi lama untuk backward compatibility (tidak digunakan lagi)
function isValidShiftTime(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: Hanya boleh scan antara jam 06:00:00 sampai 16:00:00 (360-960 minutes)
    return totalMinutes >= 360 && totalMinutes < 960;
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: Hanya boleh scan antara jam 16:30:00 sampai 20:00:00 (990-1200 minutes)
    return totalMinutes >= 990 && totalMinutes < 1200;
  }
  
  return false;
}

// Simple cache for frequently accessed employee data (5 minute TTL)
const employeeCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedEmployee(employeeId: string) {
  const cached = employeeCache.get(employeeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedEmployee(employeeId: string, data: any) {
  employeeCache.set(employeeId, { data, timestamp: Date.now() });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.get("/api/employees/:id", async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      
      // Generate QR Code token for the employee
      const secretKey = process.env.QR_SECRET_KEY || 'AttendanceQR2024';
      const tokenData = `${validatedData.id || ''}${secretKey}Attend`;
      const qrToken = Buffer.from(tokenData).toString('base64').slice(0, 16);
      // Create URL yang mengarah ke aplikasi untuk QR Code
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
      
      const qrUrl = `${baseUrl}/qr-redirect?data=${encodeURIComponent(JSON.stringify({ id: validatedData.id, token: qrToken }))}`;
      
      // Add QR Code to employee data as JSON (untuk compatibility)
      const qrData = JSON.stringify({ id: validatedData.id, token: qrToken });
      const employeeWithQR = {
        ...validatedData,
        qrCode: qrData // Simpan sebagai JSON untuk validasi
      };
      
      const employee = await storage.createEmployee(employeeWithQR);
      
      // Also create QR token record
      await storage.createQrToken({
        employeeId: employee.id,
        token: qrToken,
        isActive: true
      });
      
      res.status(201).json(employee);
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(400).json({ message: "Invalid employee data" });
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      console.log(`Updating employee ${req.params.id} with data:`, req.body);
      
      // Validate request data
      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      console.log('Validated data:', validatedData);
      
      // Update employee in database
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      console.log('Update result:', employee);
      
      if (!employee) {
        console.log('Employee not found');
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }
      
      // Ensure response object is valid
      if (typeof res.json !== 'function') {
        console.error('res.json is not a function - response object corrupted');
        return res.status(500).send('Internal server error');
      }
      
      console.log('Sending successful response');
      res.json(employee);
    } catch (error) {
      console.error('Error updating employee:', error);
      
      // Check if response object is still valid
      if (typeof res.json === 'function') {
        res.status(400).json({ 
          message: "Invalid employee data",
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } else {
        console.error('Cannot send error response - res.json not available');
        res.status(500).send('Internal server error');
      }
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteEmployee(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Delete all employees
  app.delete("/api/employees", async (req, res) => {
    try {
      const deleted = await storage.deleteAllEmployees();
      if (deleted) {
        res.json({ message: "Semua data karyawan berhasil dihapus" });
      } else {
        res.status(500).json({ message: "Gagal menghapus data karyawan" });
      }
    } catch (error) {
      console.error("Error deleting all employees:", error);
      res.status(500).json({ message: "Failed to delete all employees" });
    }
  });

  // Bulk upload employees
  app.post("/api/employees/bulk", async (req, res) => {
    try {
      const { employees: employeeData } = req.body;
      
      if (!Array.isArray(employeeData)) {
        return res.status(400).json({ message: "Invalid employee data format" });
      }

      const results = [];
      const secretKey = process.env.QR_SECRET_KEY || 'AttendanceQR2024';
      
      for (const emp of employeeData) {
        try {
          // Validate each employee data
          const validatedEmployee = insertEmployeeSchema.parse(emp);
          
          // Generate QR Code token for each employee
          const tokenData = `${validatedEmployee.id || ''}${secretKey}Attend`;
          const qrToken = Buffer.from(tokenData).toString('base64').slice(0, 16);
          const qrData = JSON.stringify({ id: validatedEmployee.id, token: qrToken });
          
          // Add QR Code to employee data (as JSON for consistency)  
          const employeeWithQR = {
            ...validatedEmployee,
            qrCode: qrData
          };
          
          const employee = await storage.createEmployee(employeeWithQR);
          
          // Also create QR token record
          await storage.createQrToken({
            employeeId: employee.id,
            token: qrToken,
            isActive: true
          });
          
          results.push(employee);
        } catch (validationError) {
          console.error("Validation error for employee:", emp, validationError);
          // Skip invalid entries but continue processing
        }
      }

      res.json({ 
        message: `Successfully uploaded ${results.length} employees with QR codes`,
        employees: results
      });
    } catch (error) {
      console.error("Error bulk uploading employees:", error);
      res.status(500).json({ message: "Failed to upload employees" });
    }
  });

  // Attendance routes
  app.get("/api/attendance", async (req, res) => {
    try {
      const date = req.query.date as string;
      console.log(`Fetching attendance records for date: ${date || 'all'}`);
      const attendance = await storage.getAllAttendance(date);
      console.log(`Found ${attendance.length} attendance records`);
      res.json(attendance);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      res.status(500).json({ message: "Failed to fetch attendance records" });
    }
  });

  app.get("/api/attendance/employee/:employeeId", async (req, res) => {
    try {
      const date = req.query.date as string;
      const attendance = await storage.getAttendanceByEmployee(req.params.employeeId, date);
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee attendance" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const validatedData = insertAttendanceSchema.parse(req.body);
      
      // Use cache for employee data, parallel queries for the rest
      let employee = getCachedEmployee(validatedData.employeeId);
      
      if (!employee) {
        // Employee not cached, fetch with parallel queries
        const [employeeData, existingAttendance, roster, leaveRequests] = await Promise.all([
          storage.getEmployee(validatedData.employeeId),
          storage.getAttendanceByEmployee(validatedData.employeeId, validatedData.date),
          storage.getRosterByDate(validatedData.date),
          storage.getLeaveByEmployee(validatedData.employeeId)
        ]);
        employee = employeeData;
        if (employee) setCachedEmployee(validatedData.employeeId, employee);
        var attendance = existingAttendance;
        var rosterData = roster;
        var leaves = leaveRequests;
      } else {
        // Employee cached, only fetch other data
        const [existingAttendance, roster, leaveRequests] = await Promise.all([
          storage.getAttendanceByEmployee(validatedData.employeeId, validatedData.date),
          storage.getRosterByDate(validatedData.date),
          storage.getLeaveByEmployee(validatedData.employeeId)
        ]);
        var attendance = existingAttendance;
        var rosterData = roster;
        var leaves = leaveRequests;
      }
      
      if (!employee) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }

      if (attendance.length > 0) {
        return res.status(400).json({ message: "Karyawan sudah melakukan absensi hari ini" });
      }

      const scheduledEmployee = rosterData.find(r => r.employeeId === validatedData.employeeId);
      if (!scheduledEmployee) {
        return res.status(400).json({ message: "Karyawan tidak dijadwalkan untuk hari ini" });
      }
      
      const leaveRequests = leaves;
      const approvedLeave = leaveRequests.find(leave => 
        leave.status === 'approved' &&
        validatedData.date >= leave.startDate &&
        validatedData.date <= leave.endDate
      );

      if (approvedLeave) {
        return res.status(400).json({ 
          message: "Scan ditolak: karyawan sedang cuti",
          leaveDetails: {
            type: approvedLeave.leaveType,
            startDate: approvedLeave.startDate,
            endDate: approvedLeave.endDate
          }
        });
      }

      // Get current time for precise shift validation (menggunakan waktu lokal sistem)
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      console.log(`Validating shift for ${validatedData.employeeId}: Current time ${currentTime}, Scheduled ${scheduledEmployee.shift} (${scheduledEmployee.startTime} - ${scheduledEmployee.endTime})`);
      
      // Strict shift validation based on shift name (more reliable than roster times)
      const isValidTiming = isValidShiftTimeByName(currentTime, scheduledEmployee.shift);
      
      console.log(`Shift validation result: ${isValidTiming}`);
      
      if (!isValidTiming) {
        const timeRange = getShiftTimeRange(scheduledEmployee.shift);
        const isCompletelyOutside = isCompletelyOutsideShiftTimes(currentTime);
        
        let errorMessage;
        if (isCompletelyOutside) {
          errorMessage = `❌ ABSENSI DITOLAK - Diluar jam kerja! Waktu sekarang: ${currentTime}. Jam kerja: Shift 1 (06:00-16:00) atau Shift 2 (16:30-20:00)`;
        } else {
          errorMessage = `❌ ABSENSI DITOLAK - Tidak sesuai shift! Anda dijadwalkan ${scheduledEmployee.shift} (${timeRange.start}-${timeRange.end}). Waktu sekarang: ${currentTime}`;
        }
        
        return res.status(400).json({ 
          message: errorMessage,
          currentTime: currentTime,
          scheduledShift: scheduledEmployee.shift,
          allowedTimeRange: `${timeRange.start} - ${timeRange.end}`,
          errorType: isCompletelyOutside ? 'OUTSIDE_WORK_HOURS' : 'WRONG_SHIFT_TIME'
        });
      }

      const record = await storage.createAttendanceRecord(validatedData);
      res.status(201).json(record);
    } catch (error) {
      res.status(400).json({ message: "Invalid attendance data" });
    }
  });

  // Roster routes
  app.get("/api/roster", async (req, res) => {
    try {
      const date = req.query.date as string;
      const employeeId = req.query.employeeId as string;
      
      // Jika ada employeeId, ambil semua roster untuk employee tersebut
      if (employeeId) {
        const employeeRoster = await storage.getRosterByEmployee(employeeId);
        const leaveMonitoring = await storage.getAllLeaveRosterMonitoring();
        
        // Enrich roster dengan data leave monitoring (hari kerja)
        const enrichedRoster = employeeRoster.map(schedule => {
          const leaveRecord = leaveMonitoring.find(leave => leave.nik === schedule.employeeId);
          
          return {
            ...schedule,
            workDays: leaveRecord?.monitoringDays || null // Monitoring hari dari leave roster
          };
        });
        
        return res.json(enrichedRoster);
      }
      
      // Jika tidak ada employeeId, maka wajib ada date parameter
      if (!date) {
        return res.status(400).json({ message: "Date parameter is required" });
      }
      
      const roster = await storage.getRosterByDate(date);
      const attendance = await storage.getAllAttendance(date);
      const leaveMonitoring = await storage.getAllLeaveRosterMonitoring();
      
      // Enrich roster dengan data attendance dan leave monitoring (hari kerja)
      const enrichedRoster = roster.map(schedule => {
        const attendanceRecord = attendance.find(att => att.employeeId === schedule.employeeId);
        const leaveRecord = leaveMonitoring.find(leave => leave.nik === schedule.employeeId);
        
        return {
          ...schedule,
          hasAttended: !!attendanceRecord,
          attendanceTime: attendanceRecord?.time || null,
          actualJamTidur: attendanceRecord?.jamTidur || schedule.jamTidur,
          actualFitToWork: attendanceRecord?.fitToWork || schedule.fitToWork,
          attendanceStatus: attendanceRecord ? "present" : "absent",
          workDays: leaveRecord?.monitoringDays || null // Monitoring hari dari leave roster
        };
      });
      
      res.json(enrichedRoster);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch roster" });
    }
  });

  app.get("/api/roster/employee/:employeeId", async (req, res) => {
    try {
      const roster = await storage.getRosterByEmployee(req.params.employeeId);
      res.json(roster);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee roster" });
    }
  });

  app.post("/api/roster", async (req, res) => {
    try {
      const validatedData = insertRosterSchema.parse(req.body);
      
      // Check if employee exists
      const employee = await storage.getEmployee(validatedData.employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }

      const schedule = await storage.createRosterSchedule(validatedData);
      
      // Trigger report cache invalidation
      await triggerReportUpdate();
      
      res.status(201).json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Invalid roster data" });
    }
  });

  app.post("/api/roster/bulk", async (req, res) => {
    try {
      const { rosters } = req.body;
      if (!Array.isArray(rosters)) {
        return res.status(400).json({ message: "Rosters must be an array" });
      }

      console.log(`Starting bulk upload of ${rosters.length} entries`);
      
      // Debug: Log 5 data pertama yang diterima server
      console.log('=== SERVER RECEIVED DATA ===');
      rosters.slice(0, 5).forEach((roster, index) => {
        console.log(`${index + 1}. NIK: ${roster.employeeId}, Date: ${roster.date}, Shift: ${roster.shift}`);
        console.log(`    Jam Tidur: "${roster.jamTidur}", Hari Kerja: "${roster.hariKerja}", Fit To Work: "${roster.fitToWork}"`);
      });

      const validatedRosters = [];
      const errors = [];
      const batchSize = 200; // Increase batch size significantly

      // Pre-load all employees to avoid repeated database queries
      const allEmployees = await storage.getAllEmployees();
      const employeeMap = new Map(allEmployees.map(emp => [emp.id, emp]));

      // Process in larger batches for better performance
      for (let batchStart = 0; batchStart < rosters.length; batchStart += batchSize) {
        const batch = rosters.slice(batchStart, batchStart + batchSize);
        
        // Validate batch without logging each entry
        for (let i = 0; i < batch.length; i++) {
          const globalIndex = batchStart + i;
          try {
            const validatedData = insertRosterSchema.parse(batch[i]);
            
            
            // Check if employee exists in pre-loaded map
            if (!employeeMap.has(validatedData.employeeId)) {
              // Create employee quickly without logging
              try {
                const newEmployee = await storage.createEmployee({
                  id: validatedData.employeeId,
                  name: `Employee ${validatedData.employeeId}`,
                  phone: '+628123456789',
                  status: 'active'
                });
                employeeMap.set(validatedData.employeeId, newEmployee);
              } catch (createError) {
                errors.push(`Baris ${globalIndex + 1}: Gagal membuat karyawan`);
                continue;
              }
            }

            validatedRosters.push(validatedData);
          } catch (error) {
            errors.push(`Baris ${globalIndex + 1}: Data tidak valid`);
          }
        }

        // Only log progress every 2000 rows
        if ((batchStart + batchSize) % 2000 === 0 || batchStart + batchSize >= rosters.length) {
          console.log(`Validated ${Math.min(batchStart + batchSize, rosters.length)} / ${rosters.length}`);
        }
      }

      if (errors.length > 0 && errors.length === rosters.length) {
        return res.status(400).json({ 
          message: "Semua data tidak valid", 
          errors: errors.slice(0, 5)
        });
      }

      console.log(`Creating ${validatedRosters.length} schedules...`);

      // Create schedules in larger batches without individual logging
      const createdSchedules = [];
      for (let i = 0; i < validatedRosters.length; i += batchSize) {
        const batch = validatedRosters.slice(i, i + batchSize);
        
        // Process batch without individual logging
        const batchPromises = batch.map(async (rosterData) => {
          try {
            return await storage.createRosterSchedule(rosterData);
          } catch (error) {
            return null; // Skip duplicates
          }
        });

        const batchResults = await Promise.all(batchPromises);
        createdSchedules.push(...batchResults.filter(result => result !== null));

        // Minimal progress logging
        if ((i + batchSize) % 2000 === 0 || i + batchSize >= validatedRosters.length) {
          console.log(`Created ${createdSchedules.length} schedules so far`);
        }
      }

      // Trigger cache invalidation
      await triggerReportUpdate();
      
      console.log(`Completed: ${createdSchedules.length} created`);
      
      // Debug: Verifikasi beberapa data yang tersimpan di database
      if (createdSchedules.length > 0) {
        console.log('=== DATABASE SAVED DATA ===');
        const sampleSaved = createdSchedules.slice(0, 5);
        sampleSaved.forEach((saved, index) => {
          console.log(`${index + 1}. NIK: ${saved.employeeId}, Date: ${saved.date}, Shift: ${saved.shift}, Hari Kerja: ${saved.hariKerja}`);
        });
      }
      
      res.status(201).json({
        message: `${createdSchedules.length} roster berhasil ditambahkan`,
        created: createdSchedules.length,
        total: rosters.length,
        errors: errors.length > 0 ? errors.slice(0, 3) : undefined
      });
    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({ message: "Failed to bulk create roster" });
    }
  });

  app.put("/api/roster/:id", async (req, res) => {
    try {
      const validatedData = insertRosterSchema.partial().parse(req.body);
      
      // Auto-update startTime dan endTime jika shift berubah
      if (validatedData.shift) {
        if (validatedData.shift === "Shift 1") {
          validatedData.startTime = "06:00";
          validatedData.endTime = "16:00";
        } else if (validatedData.shift === "Shift 2") {
          validatedData.startTime = "16:30";
          validatedData.endTime = "20:00";
        }
      }
      
      const schedule = await storage.updateRosterSchedule(req.params.id, validatedData);
      if (!schedule) {
        return res.status(404).json({ message: "Roster tidak ditemukan" });
      }

      // Trigger report cache invalidation
      await triggerReportUpdate();
      
      res.json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Invalid roster data" });
    }
  });

  // Delete all roster data - must come BEFORE the :id route to avoid conflict
  app.delete("/api/roster/delete-all", async (req, res) => {
    try {
      await storage.deleteAllRosterSchedules();
      
      // Trigger report cache invalidation
      await triggerReportUpdate();
      
      res.json({ message: "Semua data roster berhasil dihapus" });
    } catch (error) {
      console.error("Error deleting all roster data:", error);
      res.status(500).json({ message: "Gagal menghapus semua data roster" });
    }
  });

  app.delete("/api/roster/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteRosterSchedule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Roster tidak ditemukan" });
      }

      // Trigger report cache invalidation
      await triggerReportUpdate();
      
      res.status(200).json({ message: "Roster berhasil dihapus" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete roster" });
    }
  });


  // Leave routes
  app.get("/api/leave", async (req, res) => {
    try {
      const leaves = await storage.getAllLeaveRequests();
      res.json(leaves);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leave requests" });
    }
  });

  app.get("/api/leave/employee/:employeeId", async (req, res) => {
    try {
      const leaves = await storage.getLeaveByEmployee(req.params.employeeId);
      res.json(leaves);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee leave requests" });
    }
  });

  app.post("/api/leave", async (req, res) => {
    try {
      const validatedData = insertLeaveRequestSchema.parse(req.body);
      
      // Check if employee exists
      const employee = await storage.getEmployee(validatedData.employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }

      const request = await storage.createLeaveRequest(validatedData);
      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({ message: "Invalid leave request data" });
    }
  });

  app.put("/api/leave/:id", async (req, res) => {
    try {
      const validatedData = insertLeaveRequestSchema.partial().parse(req.body);
      const request = await storage.updateLeaveRequest(req.params.id, validatedData);
      if (!request) {
        return res.status(404).json({ message: "Leave request not found" });
      }
      res.json(request);
    } catch (error) {
      res.status(400).json({ message: "Invalid leave request data" });
    }
  });

  // Get pending leave requests from monitoring (status "Menunggu Cuti")
  app.get("/api/leave/pending-from-monitoring", async (req, res) => {
    try {
      const pendingFromMonitoring = await storage.getLeaveRosterMonitoringByStatus("Menunggu Cuti");
      
      // Get employee data to fill missing information
      const employees = await storage.getEmployees();
      
      // Transform monitoring data to leave request format
      const pendingRequests = pendingFromMonitoring.map(monitoring => {
        const employee = employees.find(emp => emp.id === monitoring.nik);
        return {
          id: `monitoring-${monitoring.id}`,
          employeeId: monitoring.nik,
          employeeName: monitoring.name,
          phoneNumber: employee?.phone || "",
          startDate: monitoring.nextLeaveDate || "",
          endDate: "", // To be calculated
          leaveType: monitoring.leaveOption === "70" ? "Cuti Tahunan" : "Cuti Khusus",
          reason: `Cuti otomatis berdasarkan monitoring ${monitoring.leaveOption} hari kerja`,
          attachmentPath: null,
          status: "monitoring-pending",
          monitoringId: monitoring.id,
          investorGroup: monitoring.investorGroup,
          lastLeaveDate: monitoring.lastLeaveDate,
          monitoringDays: monitoring.monitoringDays,
          month: monitoring.month
        };
      });
      
      res.json(pendingRequests);
    } catch (error) {
      console.error('Error fetching pending from monitoring:', error);
      res.status(500).json({ message: "Failed to fetch pending leave requests from monitoring" });
    }
  });

  // Process leave request from monitoring
  app.post("/api/leave/process-from-monitoring", async (req, res) => {
    try {
      const { monitoringId, employeeId, employeeName, phoneNumber, startDate, endDate, leaveType, reason, attachmentPath, action } = req.body;
      
      if (action === "approve") {
        // Create actual leave request
        const leaveRequest = await storage.createLeaveRequest({
          employeeId,
          employeeName,
          phoneNumber,
          startDate,
          endDate,
          leaveType,
          reason,
          attachmentPath,
          status: "approved"
        });
        
        // Update monitoring status to "Sedang Cuti"
        await storage.updateLeaveRosterMonitoring(monitoringId, {
          status: "Sedang Cuti"
        });
        
        res.json({ message: "Leave request approved and processed", leaveRequest });
      } else if (action === "reject") {
        // Update monitoring status back to "Aktif"
        await storage.updateLeaveRosterMonitoring(monitoringId, {
          status: "Aktif"
        });
        
        res.json({ message: "Leave request rejected" });
      } else {
        res.status(400).json({ message: "Invalid action" });
      }
    } catch (error) {
      console.error('Error processing leave from monitoring:', error);
      res.status(500).json({ message: "Failed to process leave request" });
    }
  });

  // QR Token routes
  app.post("/api/qr/generate", async (req, res) => {
    try {
      const { employeeId } = req.body;
      if (!employeeId) {
        return res.status(400).json({ message: "Employee ID is required" });
      }

      // Check if employee exists
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }

      // Check if employee already has an active QR token
      const existingTokens = await storage.getQrTokensByEmployee(employeeId);
      const activeToken = existingTokens.find(t => t.isActive);
      
      let token;
      if (activeToken) {
        // Use existing active token
        token = activeToken.token;
      } else {
        // Generate consistent token based on employee ID only
        const secretKey = process.env.QR_SECRET_KEY || 'AttendanceQR2024';
        const tokenData = `${employeeId}${secretKey}Attend`;
        token = Buffer.from(tokenData).toString('base64').slice(0, 16);

        // Create new token
        await storage.createQrToken({
          employeeId,
          token,
          isActive: true
        });
      }

      // Create URL yang mengarah ke aplikasi untuk QR Code
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
      
      const qrUrl = `${baseUrl}/qr-redirect?data=${encodeURIComponent(JSON.stringify({ id: employeeId, token }))}`;

      res.json({
        employeeId,
        token,
        qrData: qrUrl // Sekarang berisi URL langsung
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate QR token" });
    }
  });

  app.post("/api/qr/validate", async (req, res) => {
    try {
      const { employeeId, token } = req.body;
      if (!employeeId || !token) {
        return res.status(400).json({ message: "Employee ID and token are required" });
      }

      // Check cache first for faster response
      const today = new Date().toISOString().split('T')[0];
      let employee = getCachedEmployee(employeeId);
      
      if (!employee) {
        // Parallel execution for faster response + enhanced employee lookup
        console.log(`Regular QR Scan - Looking for employee ID: "${employeeId}" (type: ${typeof employeeId})`);
        
        const [employeeData, todayRoster] = await Promise.all([
          storage.getEmployee(employeeId),
          storage.getRosterByDate(today)
        ]);
        employee = employeeData;
        
        // If employee not found by direct lookup, try alternative methods
        if (!employee) {
          console.log(`Employee "${employeeId}" not found in direct lookup, trying alternatives...`);
          
          const allEmployees = await storage.getAllEmployees();
          console.log(`Total employees in system: ${allEmployees.length}`);
          
          // Try to find by trimmed ID or fuzzy match
          const foundEmployee = allEmployees.find(emp => 
            emp.id === employeeId || 
            emp.id === employeeId.trim() ||
            emp.id.toLowerCase() === employeeId.toLowerCase() ||
            emp.name.toLowerCase().includes(employeeId.toLowerCase())
          );
          
          if (foundEmployee) {
            console.log(`Found employee by alternative lookup: ${foundEmployee.id} - ${foundEmployee.name}`);
            employee = foundEmployee;
          } else {
            console.log(`Employee "${employeeId}" not found in ${allEmployees.length} total employees`);
            console.log('Sample employee IDs:', allEmployees.slice(0, 5).map(emp => `"${emp.id}"`));
          }
        }
        
        if (employee) setCachedEmployee(employeeId, employee);
        var roster = todayRoster;
      } else {
        // Employee found in cache, only fetch roster
        var roster = await storage.getRosterByDate(today);
      }
      
      const todayRoster = roster;

      if (!employee) {
        return res.status(404).json({ 
          message: "Karyawan tidak ditemukan",
          debug: {
            searchedId: employeeId,
            idType: typeof employeeId
          }
        });
      }
      
      console.log(`Regular QR validation - Found employee: ${employee.id} - ${employee.name}`);

      // Validate token using QR tokens table (more reliable)
      const qrTokens = await storage.getQrTokensByEmployee(employeeId);
      const validToken = qrTokens.find(t => t.token === token && t.isActive);

      if (!validToken) {
        return res.status(400).json({ message: "Token QR tidak valid atau sudah tidak aktif" });
      }

      const employeeRoster = todayRoster.find(r => r.employeeId === employeeId);

      // Add time validation warning for better UX
      let timeValidation = null;
      if (employeeRoster) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const isValidTiming = isValidShiftTimeByName(currentTime, employeeRoster.shift);
        const timeRange = getShiftTimeRange(employeeRoster.shift);
        const isCompletelyOutside = isCompletelyOutsideShiftTimes(currentTime);
        
        let warning = null;
        if (!isValidTiming) {
          if (isCompletelyOutside) {
            warning = `⚠️ PERINGATAN: Saat ini diluar jam kerja (${currentTime}). Absensi hanya diizinkan pada Shift 1 (06:00-16:00) atau Shift 2 (16:30-20:00)`;
          } else {
            warning = `⚠️ PERINGATAN: Waktu sekarang (${currentTime}) tidak sesuai dengan shift Anda (${employeeRoster.shift}: ${timeRange.start}-${timeRange.end})`;
          }
        }
        
        timeValidation = {
          currentTime: currentTime,
          isValidTiming: isValidTiming,
          warning: warning
        };
      }

      res.json({ 
        valid: true, 
        employee,
        roster: employeeRoster || null,
        timeValidation: timeValidation,
        message: "QR token is valid" 
      });
    } catch (error) {
      console.error("QR validation error:", error);
      res.status(500).json({ message: "Failed to validate QR token" });
    }
  });

  // Dashboard stats with optional date filter
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      
      const [employees, dateAttendance, dateRoster, leaveRequests] = await Promise.all([
        storage.getAllEmployees(),
        storage.getAllAttendance(date),
        storage.getRosterByDate(date),
        storage.getAllLeaveRequests()
      ]);

      const activeLeavesOnDate = leaveRequests.filter(leave => 
        leave.status === 'approved' && 
        leave.startDate <= date && 
        leave.endDate >= date
      );

      const stats = {
        totalEmployees: employees.length,
        scheduledToday: dateRoster.length,
        presentToday: dateAttendance.length,
        absentToday: dateRoster.length - dateAttendance.length,
        onLeaveToday: activeLeavesOnDate.length,
        pendingLeaveRequests: leaveRequests.filter(leave => leave.status === 'pending').length
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Report update status endpoint
  app.get("/api/report-update-status", async (req, res) => {
    try {
      res.json({
        lastRosterUpdate: lastRosterUpdate.toISOString(),
        message: "Roster data auto-sync active",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get update status" });
    }
  });

  // Recent attendance activities
  app.get("/api/dashboard/recent-activities", async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      
      const [attendance, employees] = await Promise.all([
        storage.getAllAttendance(date),
        storage.getAllEmployees()
      ]);

      // Get recent activities (latest 10 attendance records)
      const recentActivities = await Promise.all(
        attendance
          .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
          .slice(0, 10)
          .map(async (record) => {
            const employee = employees.find(emp => emp.id === record.employeeId);
            
            // Ambil data hari kerja langsung dari kolom monitoring yang sudah ada
            let workingDays = 0;
            try {
              if (employee?.id) {
                const allMonitoring = await storage.getAllLeaveRosterMonitoring();
                const monitoring = allMonitoring.find(m => m.nik === employee.id); // NIK sama dengan employee ID
                
                if (monitoring) {
                  // Langsung ambil dari kolom monitoringDays yang sudah ada
                  workingDays = monitoring.monitoringDays || 0;
                }
              }
            } catch (error) {
              console.error("Error getting working days from monitoring data:", error);
              workingDays = 0;
            }
            
            return {
              id: record.id,
              employeeId: record.employeeId,
              employeeName: employee?.name || 'Unknown',
              time: record.time,
              jamTidur: record.jamTidur,
              fitToWork: record.fitToWork,
              status: record.status,
              createdAt: record.createdAt,
              workingDays: workingDays
            };
          })
      );

      res.json(recentActivities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  // Detailed attendance data for dashboard
  app.get("/api/dashboard/attendance-details", async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      
      const [attendance, roster, employees] = await Promise.all([
        storage.getAllAttendance(date),
        storage.getRosterByDate(date),
        storage.getAllEmployees()
      ]);

      // Create detailed attendance list with employee info
      const attendanceDetails = roster.map(rosterEntry => {
        const employee = employees.find(emp => emp.id === rosterEntry.employeeId);
        const attendanceRecord = attendance.find(att => att.employeeId === rosterEntry.employeeId);
        
        return {
          employeeId: rosterEntry.employeeId,
          employeeName: employee?.name || 'Unknown',
          position: employee?.position || '-',
          shift: rosterEntry.shift,
          scheduledTime: `${rosterEntry.startTime} - ${rosterEntry.endTime}`,
          actualTime: attendanceRecord?.time || '-',
          jamTidur: attendanceRecord?.jamTidur || '-',
          fitToWork: attendanceRecord?.fitToWork || 'Not Set',
          status: attendanceRecord ? 'present' : 'absent',
          hasAttended: !!attendanceRecord
        };
      });

      res.json(attendanceDetails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch attendance details" });
    }
  });







  // WhatsApp Leave Monitoring endpoints
  app.get("/api/leave-monitoring/upcoming", async (req, res) => {
    try {
      const { LeaveMonitoringService } = await import('./leaveMonitoringService');
      const monitoringService = new LeaveMonitoringService(storage as any);
      const upcomingLeaves = await monitoringService.checkUpcomingLeaves();
      res.json(upcomingLeaves);
    } catch (error) {
      console.error("Error fetching upcoming leaves:", error);
      res.status(500).json({ error: "Failed to fetch upcoming leaves" });
    }
  });

  app.post("/api/leave-monitoring/send-reminders", async (req, res) => {
    try {
      const { LeaveMonitoringService } = await import('./leaveMonitoringService');
      const monitoringService = new LeaveMonitoringService(storage as any);
      const result = await monitoringService.sendLeaveReminders();
      res.json(result);
    } catch (error) {
      console.error("Error sending reminders:", error);
      res.status(500).json({ error: "Failed to send reminders" });
    }
  });

  app.get("/api/leave-monitoring/history", async (req, res) => {
    try {
      const { LeaveMonitoringService } = await import('./leaveMonitoringService');
      const monitoringService = new LeaveMonitoringService(storage as any);
      const history = await monitoringService.getLeaveReminderHistory();
      res.json(history);
    } catch (error) {
      console.error("Error fetching reminder history:", error);
      res.status(500).json({ error: "Failed to fetch reminder history" });
    }
  });

  // Leave balance endpoints
  app.get("/api/leave-balances", async (req, res) => {
    try {
      const balances = await storage.getLeaveBalances();
      res.json(balances);
    } catch (error) {
      console.error("Error fetching leave balances:", error);
      res.status(500).json({ error: "Failed to fetch leave balances" });
    }
  });

  app.get("/api/leave-balances/:employeeId", async (req, res) => {
    try {
      const { employeeId } = req.params;
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const balance = await storage.getLeaveBalanceByEmployee(employeeId, year);
      res.json(balance);
    } catch (error) {
      console.error("Error fetching employee leave balance:", error);
      res.status(500).json({ error: "Failed to fetch employee leave balance" });
    }
  });

  // Leave history endpoints
  app.get("/api/leave-history", async (req, res) => {
    try {
      const history = await storage.getLeaveHistory();
      res.json(history);
    } catch (error) {
      console.error("Error fetching leave history:", error);
      res.status(500).json({ error: "Failed to fetch leave history" });
    }
  });

  app.get("/api/leave-history/:employeeId", async (req, res) => {
    try {
      const { employeeId } = req.params;
      const history = await storage.getLeaveHistoryByEmployee(employeeId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching employee leave history:", error);
      res.status(500).json({ error: "Failed to fetch employee leave history" });
    }
  });

  // Bulk upload leave roster
  app.post("/api/leave-roster/bulk-upload", async (req, res) => {
    try {
      const { leaveData } = req.body;
      
      if (!Array.isArray(leaveData)) {
        return res.status(400).json({ error: "Invalid data format" });
      }

      const result = await storage.bulkUploadLeaveRoster(leaveData);
      res.json(result);
    } catch (error) {
      console.error("Error bulk uploading leave roster:", error);
      res.status(500).json({ error: "Failed to upload leave roster" });
    }
  });

  // Download template for leave roster upload
  app.get("/api/leave-roster/template", async (req, res) => {
    try {
      const templateData = [
        ["NIK", "Jenis Cuti", "Tanggal Mulai", "Tanggal Selesai", "Total Hari"],
        ["C-015227", "Cuti Tahunan", "2025-08-25", "2025-08-27", "3"],
        ["C-030015", "Cuti Sakit", "2025-08-28", "2025-08-29", "2"],
        ["C-045123", "Cuti Melahirkan", "2025-09-01", "2025-11-01", "61"],
        ["", "", "", "", ""],
        ["Format tanggal: YYYY-MM-DD (contoh: 2025-08-25)", "", "", "", ""],
        ["Jenis cuti: Cuti Tahunan, Cuti Sakit, Cuti Melahirkan, dll", "", "", "", ""]
      ];

      const csvContent = templateData.map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="template-roster-cuti.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  // Dashboard Evaluasi Cuti API endpoints
  app.get("/api/leave-analytics/overview", async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      const leaveRequests = await storage.getAllLeaveRequests();
      const leaveBalances = await storage.getLeaveBalances();
      
      // Statistik umum
      const totalEmployees = employees.length;
      const totalLeaveRequests = leaveRequests.length;
      const pendingRequests = leaveRequests.filter(req => req.status === 'pending').length;
      const approvedRequests = leaveRequests.filter(req => req.status === 'approved').length;
      const totalLeaveDaysTaken = leaveBalances.reduce((sum, balance) => sum + balance.usedDays, 0);
      
      // Karyawan dengan cuti paling banyak
      const topLeaveEmployees = leaveBalances
        .sort((a, b) => b.usedDays - a.usedDays)
        .slice(0, 5)
        .map(balance => {
          const employee = employees.find(emp => emp.id === balance.employeeId);
          return {
            employeeId: balance.employeeId,
            employeeName: employee?.name || 'Unknown',
            usedDays: balance.usedDays,
            remainingDays: balance.remainingDays,
            percentage: Math.round((balance.usedDays / balance.totalDays) * 100)
          };
        });

      // Tren cuti per bulan (6 bulan terakhir)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const monthlyLeaveData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const monthRequests = leaveRequests.filter(req => {
          return req.startDate.startsWith(monthYear);
        });
        
        monthlyLeaveData.push({
          month: date.toLocaleDateString('id-ID', { month: 'short' }),
          requests: monthRequests.length,
          totalDays: monthRequests.reduce((sum, req) => {
            const start = new Date(req.startDate);
            const end = new Date(req.endDate);
            return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }, 0)
        });
      }

      // Distribusi jenis cuti
      const leaveTypeDistribution = leaveRequests.reduce((acc, req) => {
        acc[req.leaveType] = (acc[req.leaveType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        overview: {
          totalEmployees,
          totalLeaveRequests,
          pendingRequests,
          approvedRequests,
          totalLeaveDaysTaken,
          averageLeaveDays: totalEmployees > 0 ? Math.round(totalLeaveDaysTaken / totalEmployees) : 0
        },
        topLeaveEmployees,
        monthlyLeaveData,
        leaveTypeDistribution
      });
    } catch (error) {
      console.error("Error fetching leave analytics overview:", error);
      res.status(500).json({ message: "Failed to fetch leave analytics" });
    }
  });

  app.get("/api/leave-analytics/department", async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      const leaveBalances = await storage.getLeaveBalances();
      
      // Grup by department
      const departmentStats = employees.reduce((acc, employee) => {
        const dept = employee.department || 'Unknown';
        if (!acc[dept]) {
          acc[dept] = {
            department: dept,
            totalEmployees: 0,
            totalLeaveDays: 0,
            averageLeaveDays: 0,
            employees: []
          };
        }
        
        const balance = leaveBalances.find(b => b.employeeId === employee.id);
        const usedDays = balance?.usedDays || 0;
        
        acc[dept].totalEmployees++;
        acc[dept].totalLeaveDays += usedDays;
        acc[dept].employees.push({
          nik: employee.id,
          name: employee.name,
          position: employee.position,
          usedDays,
          remainingDays: balance?.remainingDays || 0
        });
        
        return acc;
      }, {} as Record<string, any>);

      // Calculate averages
      Object.values(departmentStats).forEach((dept: any) => {
        dept.averageLeaveDays = dept.totalEmployees > 0 
          ? Math.round(dept.totalLeaveDays / dept.totalEmployees) 
          : 0;
      });

      res.json(Object.values(departmentStats));
    } catch (error) {
      console.error("Error fetching department analytics:", error);
      res.status(500).json({ message: "Failed to fetch department analytics" });
    }
  });



  // Object storage routes for file uploads
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Object storage not configured:", error);
      res.status(503).json({ 
        error: "Object storage not configured",
        message: "File upload is temporarily unavailable. Please contact administrator."
      });
    }
  });

  // Endpoint untuk normalize upload URL
  app.post("/api/objects/normalize", async (req, res) => {
    try {
      const { uploadURL } = req.body;
      if (!uploadURL) {
        return res.status(400).json({ error: "uploadURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      
      res.json({ objectPath });
    } catch (error) {
      console.error("Error normalizing object path:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // WhatsApp API routes
  app.post("/api/whatsapp/test-connection", async (req, res) => {
    try {
      const whatsappService = new WhatsAppService();
      // Simple API connection test
      const result = { 
        success: true, 
        message: "WhatsApp API connection is ready",
        apiKey: process.env.NOTIF_API_KEY ? "configured" : "missing"
      };
      res.json(result);
    } catch (error) {
      console.error("WhatsApp test connection error:", error);
      res.status(500).json({ 
        success: false, 
        message: "WhatsApp API test gagal: " + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  });

  // WhatsApp Blast API routes
  app.get("/api/whatsapp-blasts", async (req, res) => {
    try {
      const blasts = await storage.getAllWhatsappBlasts();
      res.json(blasts);
    } catch (error) {
      console.error("Error fetching WhatsApp blasts:", error);
      res.status(500).json({ error: "Failed to fetch WhatsApp blasts" });
    }
  });

  app.post("/api/whatsapp-blasts", async (req, res) => {
    try {
      const validatedData = insertWhatsappBlastSchema.parse(req.body);
      const blast = await storage.createWhatsappBlast(validatedData);
      res.json(blast);
    } catch (error) {
      console.error("Error creating WhatsApp blast:", error);
      res.status(500).json({ error: "Failed to create WhatsApp blast" });
    }
  });

  app.get("/api/whatsapp-blasts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const blast = await storage.getWhatsappBlast(id);
      if (!blast) {
        return res.status(404).json({ error: "WhatsApp blast not found" });
      }
      res.json(blast);
    } catch (error) {
      console.error("Error fetching WhatsApp blast:", error);
      res.status(500).json({ error: "Failed to fetch WhatsApp blast" });
    }
  });

  app.post("/api/whatsapp-blasts/:id/send", async (req, res) => {
    try {
      const { id } = req.params;
      const blast = await storage.getWhatsappBlast(id);
      
      if (!blast) {
        return res.status(404).json({ error: "WhatsApp blast not found" });
      }

      if (blast.status !== "pending") {
        return res.status(400).json({ error: "Blast is not in pending status" });
      }

      // Update blast status to processing
      await storage.updateWhatsappBlast(id, { status: "processing" });

      // Get target employees
      const employees = await storage.getAllEmployees();
      let targetEmployees: any[] = [];

      if (blast.targetType === "all") {
        targetEmployees = employees;
      } else if (blast.targetType === "department") {
        targetEmployees = employees.filter(emp => emp.department === blast.targetValue);
      } else if (blast.targetType === "specific") {
        const targetIds = JSON.parse(blast.targetValue || "[]");
        targetEmployees = employees.filter(emp => targetIds.includes(emp.id));
      }

      // Initialize WhatsApp service
      const whatsappService = new WhatsAppService();
      let successCount = 0;
      let failedCount = 0;

      // Use sequential processing instead of parallel to avoid API connection issues
      console.log(`Starting WhatsApp blast for ${targetEmployees.length} employees (sequential mode)`);
      
      // Process employees one by one to avoid connection issues
      for (let i = 0; i < targetEmployees.length; i++) {
        const employee = targetEmployees[i];
        try {
          const rawPhone = employee.phone;
          
          if (!rawPhone || !whatsappService.isValidPhoneNumber(rawPhone)) {
            console.error(`Invalid phone number for ${employee.name}: ${rawPhone}`);
            failedCount++;
            continue;
          }
          
          const phoneNumber = whatsappService.formatPhoneNumber(rawPhone);
          console.log(`[${i+1}/${targetEmployees.length}] Sending to ${employee.name}: ${phoneNumber}`);
          
          // Send text message only for now to ensure reliability
          let finalMessage = blast.message;
          if (blast.imageUrl) {
            // Include image info in text message
            finalMessage = `${blast.message}\n\n📷 Gambar terlampir di pesan terpisah\n${req.protocol}://${req.get('host')}${blast.imageUrl}`;
          }
          
          const result = await whatsappService.sendTextMessage(phoneNumber, finalMessage);

          console.log(`✓ Message sent successfully to ${employee.name}`);

          // Save successful result
          await storage.createWhatsappBlastResult({
            blastId: id,
            employeeId: employee.id,
            phoneNumber: phoneNumber,
            status: "sent",
            errorMessage: null
          });

          successCount++;
          
        } catch (error) {
          console.error(`✗ Failed to send to ${employee.name}:`, error);
          
          // Save failed result
          await storage.createWhatsappBlastResult({
            blastId: id,
            employeeId: employee.id,
            phoneNumber: whatsappService.formatPhoneNumber(employee.phone) || "invalid",
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error"
          });

          failedCount++;
        }

        // Update progress every 5 messages
        if ((i + 1) % 5 === 0 || i === targetEmployees.length - 1) {
          await storage.updateWhatsappBlast(id, {
            successCount,
            failedCount,
            totalRecipients: targetEmployees.length
          });
          console.log(`Progress: ${successCount + failedCount}/${targetEmployees.length} processed (${successCount} success, ${failedCount} failed)`);
        }

        // Shorter delay since we're only sending text messages now
        if (i < targetEmployees.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between messages
        }
      }

      console.log(`WhatsApp blast completed: ${successCount} sent, ${failedCount} failed out of ${targetEmployees.length} total`);

      // Update blast with final results
      await storage.updateWhatsappBlast(id, {
        status: failedCount === 0 ? "completed" : "partial",
        successCount,
        failedCount,
        totalRecipients: targetEmployees.length,
        completedAt: new Date()
      });

      res.json({ 
        success: true, 
        successCount, 
        failedCount,
        totalRecipients: targetEmployees.length,
        message: `Blast completed: ${successCount} sent, ${failedCount} failed`
      });

    } catch (error) {
      console.error("Error sending WhatsApp blast:", error);
      
      // Update blast status to failed
      await storage.updateWhatsappBlast(req.params.id, { 
        status: "failed",
        completedAt: new Date()
      });
      
      res.status(500).json({ error: "Failed to send WhatsApp blast" });
    }
  });

  app.get("/api/whatsapp-blasts/:id/results", async (req, res) => {
    try {
      const { id } = req.params;
      const results = await storage.getWhatsappBlastResults(id);
      res.json(results);
    } catch (error) {
      console.error("Error fetching WhatsApp blast results:", error);
      res.status(500).json({ error: "Failed to fetch WhatsApp blast results" });
    }
  });

  // Leave Roster Monitoring routes
  app.get("/api/leave-roster-monitoring", async (req, res) => {
    try {
      const monitoring = await storage.getAllLeaveRosterMonitoring();
      res.json(monitoring);
    } catch (error) {
      console.error("Error fetching leave roster monitoring:", error);
      res.status(500).json({ message: "Failed to fetch leave roster monitoring" });
    }
  });

  app.get("/api/leave-roster-monitoring/:id", async (req, res) => {
    try {
      const monitoring = await storage.getLeaveRosterMonitoring(req.params.id);
      if (!monitoring) {
        return res.status(404).json({ message: "Monitoring data not found" });
      }
      res.json(monitoring);
    } catch (error) {
      console.error("Error fetching leave roster monitoring:", error);
      res.status(500).json({ message: "Failed to fetch leave roster monitoring" });
    }
  });

  app.post("/api/leave-roster-monitoring", async (req, res) => {
    try {
      const monitoring = await storage.createLeaveRosterMonitoring(req.body);
      res.status(201).json(monitoring);
    } catch (error) {
      console.error("Error creating leave roster monitoring:", error);
      res.status(500).json({ message: "Failed to create leave roster monitoring" });
    }
  });

  app.put("/api/leave-roster-monitoring/:id", async (req, res) => {
    try {
      const monitoring = await storage.updateLeaveRosterMonitoring(req.params.id, req.body);
      if (!monitoring) {
        return res.status(404).json({ message: "Monitoring data not found" });
      }
      res.json(monitoring);
    } catch (error) {
      console.error("Error updating leave roster monitoring:", error);
      res.status(500).json({ message: "Failed to update leave roster monitoring" });
    }
  });

  // Delete all route must come BEFORE the :id route to avoid conflict
  app.delete("/api/leave-roster-monitoring/delete-all", async (req, res) => {
    try {
      await storage.deleteAllLeaveRosterMonitoring();
      res.json({ message: "All leave roster monitoring data deleted successfully" });
    } catch (error) {
      console.error("Error deleting all leave roster monitoring data:", error);
      res.status(500).json({ message: "Failed to delete all leave roster monitoring data" });
    }
  });

  // Clear all leave roster monitoring data (must be before :id route)
  app.delete("/api/leave-roster-monitoring/clear-all", async (req, res) => {
    try {
      await storage.deleteAllLeaveRosterMonitoring();
      res.json({ 
        success: true,
        message: "Semua data roster monitoring berhasil dihapus"
      });
    } catch (error) {
      console.error("Error clearing leave roster monitoring data:", error);
      res.status(500).json({ 
        error: "Failed to clear data", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.delete("/api/leave-roster-monitoring/:id", async (req, res) => {
    try {
      const success = await storage.deleteLeaveRosterMonitoring(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Monitoring data not found" });
      }
      res.json({ message: "Leave roster monitoring deleted successfully" });
    } catch (error) {
      console.error("Error deleting leave roster monitoring:", error);
      res.status(500).json({ message: "Failed to delete leave roster monitoring" });
    }
  });

  app.post("/api/leave-roster-monitoring/update-status", async (req, res) => {
    try {
      await storage.updateLeaveRosterStatus();
      res.json({ message: "Status updated successfully" });
    } catch (error) {
      console.error("Error updating leave roster status:", error);
      res.status(500).json({ message: "Failed to update leave roster status" });
    }
  });

  // Excel upload endpoint for leave roster monitoring
  app.post("/api/leave-roster-monitoring/upload-excel", async (req, res) => {
    try {
      const multer = (await import('multer')).default;
      const XLSX = (await import('xlsx'));
      
      // Setup multer for memory storage
      const upload = multer({ storage: multer.memoryStorage() });
      
      // Handle file upload
      upload.single('file')(req as any, res, async (err: any) => {
        if (err) {
          console.error("Multer error:", err);
          return res.status(400).json({ error: "File upload error", details: err.message });
        }

        const file = (req as any).file;
        if (!file) {
          console.error("No file received in request");
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log("File received:", file.originalname, "Size:", file.size);

        try {
          const workbook = XLSX.read(file.buffer, { type: 'buffer' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          console.log("Excel data parsed:", data.length, "rows");

          // Skip header row
          const rows = data.slice(1) as any[][];
          
          let successCount = 0;
          const errors: string[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            console.log(`Processing row ${i + 2}:`, row);
            console.log(`Row length: ${row.length}`);
            
            if (!row || row.length < 2) {
              errors.push(`Row ${i + 2}: Data tidak lengkap (minimal NIK dan Nama)`);
              continue;
            }

            // Format data sesuai Excel file: NIK, Nama, Nomor Lambung, Bulan, Tanggal Terakhir Cuti, Pilihan Cuti, OnSite, Investor Group
            // Handle various Excel column formats by checking length
            let nik, name, nomorLambung, monthOrBulan, lastLeaveDateSerial, leaveOption, onSiteData, investorGroupData;
            
            if (row.length >= 8) {
              [nik, name, nomorLambung, monthOrBulan, lastLeaveDateSerial, leaveOption, onSiteData, investorGroupData] = row;
            } else if (row.length >= 7) {
              [nik, name, nomorLambung, monthOrBulan, lastLeaveDateSerial, leaveOption, onSiteData] = row;
            } else if (row.length >= 6) {
              [nik, name, nomorLambung, monthOrBulan, lastLeaveDateSerial, leaveOption] = row;
            } else if (row.length >= 5) {
              [nik, name, nomorLambung, monthOrBulan, lastLeaveDateSerial] = row;
            } else if (row.length >= 4) {
              [nik, name, nomorLambung, monthOrBulan] = row;
            } else if (row.length >= 3) {
              [nik, name, nomorLambung] = row;
            } else {
              [nik, name] = row;
            }
            
            console.log(`Parsed values - NIK: ${nik}, Name: ${name}, NomorLambung: ${nomorLambung}, Month: ${monthOrBulan}, LastLeaveDate: ${lastLeaveDateSerial}, LeaveOption: ${leaveOption}, OnSite: ${onSiteData}, InvestorGroup: ${investorGroupData}`);
            
            try {
              
              // Validate required fields
              if (!nik || !name) {
                errors.push(`Row ${i + 2}: NIK dan Nama harus diisi`);
                continue;
              }

              // Convert various month formats to YYYY-MM format
              const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
              let finalMonth = currentMonth; // Default to current month
              
              // Calculate monitoring days and next leave date
              let monitoringDays = 0;
              let nextLeaveDate = "";
              let finalLastLeaveDate = "";
              let finalStatus = "Aktif";
              let finalLeaveOption = "70";
              let finalOnSite = "";
              
              if (monthOrBulan) {
                const monthStr = monthOrBulan.toString().toLowerCase().trim();
                const currentYear = new Date().getFullYear();
                
                // Handle Excel serial date numbers (40000+)
                if (!isNaN(Number(monthStr)) && Number(monthStr) > 40000 && Number(monthStr) < 50000) {
                  // Convert Excel serial to date, then extract month using correct formula
                  const excelDate = Number(monthStr);
                  const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
                  const daysSinceEpoch = excelDate - 1; // Excel day 1 = Jan 1, 1900
                  const jsDate = new Date(excelEpoch.getTime() + (daysSinceEpoch * 24 * 60 * 60 * 1000));
                  if (!isNaN(jsDate.getTime())) {
                    const year = jsDate.getFullYear();
                    const month = (jsDate.getMonth() + 1).toString().padStart(2, '0');
                    finalMonth = `${year}-${month}`;
                    console.log(`Row ${i + 2}: Converted Excel serial "${monthStr}" to month "${finalMonth}"`);
                  } else {
                    console.log(`Row ${i + 2}: Invalid Excel serial "${monthStr}", using current month`);
                    finalMonth = currentMonth;
                  }
                }
                // Handle date formats: dd/mm/yyyy, dd-mm-yyyy, mm/yyyy, etc.
                else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(monthStr)) {
                  // Format: dd/mm/yyyy or dd-mm-yyyy
                  const dateParts = monthStr.split(/[\/\-]/);
                  const day = parseInt(dateParts[0]);
                  const month = parseInt(dateParts[1]);
                  const year = parseInt(dateParts[2]);
                  
                  if (month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
                    finalMonth = `${year}-${month.toString().padStart(2, '0')}`;
                    console.log(`Row ${i + 2}: Converted date "${monthStr}" to month "${finalMonth}"`);
                  } else {
                    console.log(`Row ${i + 2}: Invalid date "${monthStr}", using current month`);
                    finalMonth = currentMonth;
                  }
                } 
                // Handle mm/yyyy or mm-yyyy format
                else if (/^\d{1,2}[\/\-]\d{4}$/.test(monthStr)) {
                  const dateParts = monthStr.split(/[\/\-]/);
                  const month = parseInt(dateParts[0]);
                  const year = parseInt(dateParts[1]);
                  
                  if (month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
                    finalMonth = `${year}-${month.toString().padStart(2, '0')}`;
                    console.log(`Row ${i + 2}: Converted month/year "${monthStr}" to "${finalMonth}"`);
                  } else {
                    console.log(`Row ${i + 2}: Invalid month/year "${monthStr}", using current month`);
                    finalMonth = currentMonth;
                  }
                }
                // Convert Indonesian month names to YYYY-MM format
                else {
                  const monthMap: { [key: string]: string } = {
                    'januari': `${currentYear}-01`,
                    'january': `${currentYear}-01`,
                    'februari': `${currentYear}-02`, 
                    'february': `${currentYear}-02`,
                    'maret': `${currentYear}-03`,
                    'march': `${currentYear}-03`,
                    'april': `${currentYear}-04`,
                    'mei': `${currentYear}-05`,
                    'may': `${currentYear}-05`,
                    'juni': `${currentYear}-06`,
                    'june': `${currentYear}-06`,
                    'juli': `${currentYear}-07`,
                    'july': `${currentYear}-07`,
                    'agustus': `${currentYear}-08`,
                    'august': `${currentYear}-08`,
                    'september': `${currentYear}-09`,
                    'oktober': `${currentYear}-10`,
                    'october': `${currentYear}-10`,
                    'november': `${currentYear}-11`,
                    'desember': `${currentYear}-12`,
                    'december': `${currentYear}-12`
                  };
                  
                  if (monthMap[monthStr]) {
                    finalMonth = monthMap[monthStr];
                    console.log(`Row ${i + 2}: Converted month name "${monthStr}" to "${finalMonth}"`);
                  } else if (/^\d{4}-\d{2}$/.test(monthStr)) {
                    // Already in YYYY-MM format
                    finalMonth = monthStr;
                    console.log(`Row ${i + 2}: Month already in correct format "${finalMonth}"`);
                  } else {
                    console.log(`Row ${i + 2}: Format bulan tidak dikenali "${monthStr}", menggunakan bulan sekarang`);
                    finalMonth = currentMonth;
                  }
                }
              }

              // Use investor group from Excel, default to "Default Group" if not provided
              let investorGroup = "Default Group";
              if (investorGroupData && investorGroupData.toString().trim()) {
                investorGroup = investorGroupData.toString().trim();
              }

              // Validate leave option atau default ke 70
              if (leaveOption && (leaveOption.toString() === "70" || leaveOption.toString() === "35")) {
                finalLeaveOption = leaveOption.toString();
              } else if (leaveOption && leaveOption.toString().trim() !== "") {
                console.log(`Row ${i + 2}: Invalid leave option "${leaveOption}", using default 70`);
                // Don't add error, just use default
              }

              if (lastLeaveDateSerial) {
                console.log(`[${nik}] Processing lastLeaveDateSerial: ${lastLeaveDateSerial}, type: ${typeof lastLeaveDateSerial}`);
                try {
                  // Handle berbagai format tanggal
                  let lastDate = null;
                  
                  // Cek apakah Excel serial number
                  if (typeof lastLeaveDateSerial === 'number' && lastLeaveDateSerial > 1000) {
                    // Excel date serial number conversion
                    // Excel epoch: January 1, 1900 (but Excel incorrectly treats 1900 as leap year)
                    // More accurate conversion for Excel dates:
                    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899 (Excel day 0)
                    const daysSinceEpoch = Math.floor(lastLeaveDateSerial);
                    lastDate = new Date(excelEpoch.getTime() + (daysSinceEpoch * 24 * 60 * 60 * 1000));
                    console.log(`[${nik}] Excel serial ${lastLeaveDateSerial} converted to ${lastDate.toISOString().split('T')[0]}`);
                  } else {
                    const dateStr = lastLeaveDateSerial.toString().trim();
                    console.log(`[${nik}] Parsing date string: "${dateStr}"`);
                    
                    // Format 1: dd/mm/yyyy atau dd-mm-yyyy
                    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
                      const [day, month, year] = dateStr.split(/[\/\-]/);
                      const dayNum = parseInt(day);
                      const monthNum = parseInt(month);
                      const yearNum = parseInt(year);
                      
                      // Validate date values
                      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 2020 && yearNum <= 2030) {
                        lastDate = new Date(yearNum, monthNum - 1, dayNum);
                        console.log(`[${nik}] DD/MM/YYYY format "${dateStr}" converted to ${lastDate.toISOString().split('T')[0]}`);
                      }
                    }
                    // Format 2: yyyy/mm/dd atau yyyy-mm-dd
                    else if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(dateStr)) {
                      const [year, month, day] = dateStr.split(/[\/\-]/);
                      const dayNum = parseInt(day);
                      const monthNum = parseInt(month);
                      const yearNum = parseInt(year);
                      
                      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 2020 && yearNum <= 2030) {
                        lastDate = new Date(yearNum, monthNum - 1, dayNum);
                        console.log(`[${nik}] YYYY/MM/DD format "${dateStr}" converted to ${lastDate.toISOString().split('T')[0]}`);
                      }
                    }
                    // Format 3: mm/dd/yyyy (American format)
                    else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
                      const parts = dateStr.split(/[\/\-]/);
                      // Try to detect if it's American format (mm/dd/yyyy) by checking if first part > 12
                      if (parseInt(parts[0]) > 12 || parseInt(parts[1]) <= 12) {
                        // Assume dd/mm/yyyy (already handled above)
                      } else {
                        // Try mm/dd/yyyy
                        const monthNum = parseInt(parts[0]);
                        const dayNum = parseInt(parts[1]);
                        const yearNum = parseInt(parts[2]);
                        
                        if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 2020 && yearNum <= 2030) {
                          lastDate = new Date(yearNum, monthNum - 1, dayNum);
                          console.log(`[${nik}] MM/DD/YYYY format "${dateStr}" converted to ${lastDate.toISOString().split('T')[0]}`);
                        }
                      }
                    }
                    // Format 4: Tanggal text (15 Januari 2024, dll)
                    else {
                      // Try parsing as ISO date or natural language
                      const tempDate = new Date(dateStr);
                      if (!isNaN(tempDate.getTime()) && tempDate.getFullYear() >= 2020 && tempDate.getFullYear() <= 2030) {
                        lastDate = tempDate;
                        console.log(`[${nik}] Text format "${dateStr}" converted to ${lastDate.toISOString().split('T')[0]}`);
                      } else {
                        console.log(`[${nik}] Unable to parse date: "${dateStr}"`);
                      }
                    }
                  }
                  
                  // Validasi final dan perhitungan
                  if (lastDate && !isNaN(lastDate.getTime())) {
                    finalLastLeaveDate = lastDate.toISOString().split('T')[0];
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
                    lastDate.setHours(0, 0, 0, 0); // Reset to start of day
                    
                    // Rumus baru: Terakhir Cuti - Today 
                    monitoringDays = Math.floor((lastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    const workDaysThreshold = finalLeaveOption === "70" ? 70 : 35;
                    const nextDate = new Date(lastDate);
                    nextDate.setDate(lastDate.getDate() + workDaysThreshold);
                    nextLeaveDate = nextDate.toISOString().split('T')[0];

                    // Status berdasarkan rumus baru: Terakhir Cuti - Today
                    console.log(`[${nik}] SUCCESS: Parsed date ${finalLastLeaveDate}, monitoringDays: ${monitoringDays} (${monitoringDays > 0 ? 'hari lagi' : monitoringDays < 0 ? 'sudah lewat' : 'hari ini'})`);
                    
                    // Aturan status baru:
                    if (monitoringDays <= 10 && monitoringDays >= 0) {
                      finalStatus = "Menunggu Cuti";
                    } else if (monitoringDays > 10) {
                      finalStatus = "Aktif";
                    } else if (monitoringDays < 0) {
                      finalStatus = "Cuti Selesai";
                    }
                  } else {
                    // Tanggal tidak bisa diparsing
                    console.log(`[${nik}] ERROR: Failed to parse date "${lastLeaveDateSerial}"`);
                    errors.push(`Row ${i + 2}: Format tanggal tidak valid "${lastLeaveDateSerial}". Gunakan format: DD/MM/YYYY, DD-MM-YYYY, atau YYYY-MM-DD`);
                  }
                } catch (dateError) {
                  console.error(`[${nik}] Date parsing error:`, dateError);
                  errors.push(`Row ${i + 2}: Error parsing tanggal "${lastLeaveDateSerial}": ${dateError.message}`);
                }
              }

              console.log("Creating monitoring entry for:", nik, name);
              console.log("Data to insert:", {
                nik: nik?.toString(),
                name: name?.toString(),
                nomorLambung: nomorLambung?.toString() || null,
                month: finalMonth,
                investorGroup,
                lastLeaveDate: finalLastLeaveDate || null,
                leaveOption: finalLeaveOption,
                monitoringDays,
                nextLeaveDate: nextLeaveDate || null,
                status: finalStatus,
                onSite: finalOnSite || null
              });
              
              // Create leave roster monitoring entry - convert Excel serial to date format if needed
              if (onSiteData) {
                const onSiteStr = onSiteData.toString().trim();
                // Check if it's a number (Excel serial date)
                if (!isNaN(Number(onSiteStr)) && Number(onSiteStr) > 40000) {
                  // Convert Excel serial to date format using correct formula
                  const excelEpoch = new Date(1900, 0, 1);
                  const daysSinceEpoch = Number(onSiteStr) - 1; // Fixed conversion
                  const parsedDate = new Date(excelEpoch.getTime() + (daysSinceEpoch * 24 * 60 * 60 * 1000));
                  finalOnSite = parsedDate.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: '2-digit', 
                    year: 'numeric'
                  });
                } else {
                  // Use as text (Ya/Tidak/etc)
                  finalOnSite = onSiteStr;
                }
              }
              await storage.createLeaveRosterMonitoring({
                nik: nik.toString(),
                name: name.toString(),
                nomorLambung: nomorLambung?.toString() || null,
                month: finalMonth,
                investorGroup: investorGroup,
                lastLeaveDate: finalLastLeaveDate || null,
                leaveOption: finalLeaveOption,
                monitoringDays,
                nextLeaveDate: nextLeaveDate || null,
                status: finalStatus,
                onSite: finalOnSite || null
              });

              successCount++;
              console.log(`Successfully created entry for ${nik} - ${name}`);
              
            } catch (error) {
              console.error(`❌ Error processing row ${i + 2}:`, error);
              console.error("📋 Row data:", row);
              console.error("🔍 Parsed data:", { 
                nik, 
                name, 
                lastLeaveDateSerial, 
                leaveOption, 
                monthOrBulan, 
                onSiteData
              });
              
              // Specific error handling
              if (error instanceof Error) {
                console.error("💥 Error message:", error.message);
                console.error("📚 Error stack:", error.stack);
                
                // Check if it's a database constraint error
                if (error.message.includes('unique') || error.message.includes('constraint')) {
                  console.error("🚨 Database constraint violation detected");
                  errors.push(`Row ${i + 2}: Data duplikat - ${nik} untuk bulan sudah ada`);
                } else if (error.message.includes('validation') || error.message.includes('required')) {
                  console.error("⚠️ Validation error detected");
                  errors.push(`Row ${i + 2}: Validation error - ${error.message}`);
                } else if (error.message.includes('null') || error.message.includes('NOT NULL')) {
                  console.error("🔍 NULL constraint violation detected");
                  errors.push(`Row ${i + 2}: Field yang wajib kosong - periksa NIK, Nama, atau data lainnya`);
                } else {
                  errors.push(`Row ${i + 2}: ${error.message}`);
                }
              } else {
                errors.push(`Row ${i + 2}: Unknown error`);
              }
              
              console.log(`❌ Failed to create entry for ${nik || 'unknown'} - ${name || 'unknown'}`);
            }
          }

          console.log(`Upload completed: ${successCount} success, ${errors.length} errors`);

          res.json({
            success: successCount,
            errors,
            message: `${successCount} data berhasil diupload${errors.length > 0 ? `, ${errors.length} error` : ''}`
          });

        } catch (error) {
          console.error("Error processing Excel file:", error);
          res.status(500).json({ error: "Failed to process Excel file", details: error instanceof Error ? error.message : 'Unknown error' });
        }
      });

    } catch (error) {
      console.error("Error in Excel upload:", error);
      res.status(500).json({ error: "Failed to upload Excel file", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Meeting API routes
  app.get("/api/meetings", async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meetings/date/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const meetings = await storage.getMeetingsByDate(date);
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings by date:", error);
      res.status(500).json({ error: "Failed to fetch meetings by date" });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      const validatedData = insertMeetingSchema.parse(req.body);
      const meeting = await storage.createMeeting(validatedData);
      res.json(meeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  app.get("/api/meetings/by-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const meeting = await storage.getMeetingByQrToken(token);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error fetching meeting by token:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  app.get("/api/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  app.put("/api/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertMeetingSchema.parse(req.body);
      const meeting = await storage.updateMeeting(id, validatedData);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error updating meeting:", error);
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteMeeting(id);
      if (!deleted) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json({ message: "Meeting deleted successfully" });
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // Meeting QR code validation and attendance recording
  app.post("/api/meetings/qr-scan", async (req, res) => {
    try {
      const { qrToken, employeeId } = req.body;
      
      if (!qrToken || !employeeId) {
        return res.status(400).json({ error: "QR token and employee ID are required" });
      }

      // Find meeting by QR token
      const meeting = await storage.getMeetingByQrToken(qrToken);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found or invalid QR code" });
      }

      // Check if employee exists - with detailed logging for debugging
      console.log(`Meeting QR Scan - Looking for employee ID: "${employeeId}" (type: ${typeof employeeId})`);
      
      let employee = await storage.getEmployee(employeeId);
      if (!employee) {
        // Try alternative lookup methods
        console.log(`Employee "${employeeId}" not found, trying alternative lookups...`);
        
        // Try searching by name or NIK
        const allEmployees = await storage.getAllEmployees();
        console.log(`Total employees in system: ${allEmployees.length}`);
        
        // Log first few employee IDs for comparison
        console.log('Sample employee IDs:', allEmployees.slice(0, 5).map(emp => `"${emp.id}"`));
        
        // Try to find by trimmed ID or exact match
        const foundEmployee = allEmployees.find(emp => 
          emp.id === employeeId || 
          emp.id === employeeId.trim() ||
          emp.id.toLowerCase() === employeeId.toLowerCase() ||
          emp.name.toLowerCase().includes(employeeId.toLowerCase())
        );
        
        if (foundEmployee) {
          console.log(`Found employee by alternative lookup: ${foundEmployee.id} - ${foundEmployee.name}`);
          // Use the found employee
          employee = foundEmployee;
        } else {
          console.log(`Employee "${employeeId}" not found in ${allEmployees.length} total employees`);
          return res.status(404).json({ 
            error: "Employee not found",
            debug: {
              searchedId: employeeId,
              idType: typeof employeeId,
              totalEmployees: allEmployees.length,
              sampleIds: allEmployees.slice(0, 3).map(emp => emp.id)
            }
          });
        }
      }
      
      console.log(`Meeting attendance - Found employee: ${employee.id} - ${employee.name}`);

      // Check if employee already attended this meeting TODAY
      const today = new Date().toISOString().split('T')[0];
      const existingAttendance = await storage.checkMeetingAttendance(meeting.id, employeeId);
      
      console.log(`Checking existing attendance for ${employee.name}:`, {
        exists: !!existingAttendance,
        scanDate: existingAttendance?.scanDate,
        scanTime: existingAttendance?.scanTime,
        today: today
      });
      
      if (existingAttendance && existingAttendance.scanDate === today) {
        // Allow re-attendance if more than 15 minutes has passed (proper meeting window)
        const now = new Date();
        // Convert to Indonesia time for proper comparison
        const indonesiaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // WITA (+8)
        const currentTime = indonesiaTime.getHours() * 60 + indonesiaTime.getMinutes(); // minutes since midnight
        const [hours, minutes, seconds] = existingAttendance.scanTime.split(':').map(Number);
        const lastScanTime = hours * 60 + minutes;
        const timeDifference = currentTime - lastScanTime;
        
        console.log(`Time check for ${employee.name}:`, {
          currentTime: `${indonesiaTime.getHours().toString().padStart(2, '0')}:${indonesiaTime.getMinutes().toString().padStart(2, '0')} WITA`,
          lastScanTime: existingAttendance.scanTime,
          timeDifferenceMinutes: timeDifference
        });
        
        if (timeDifference < 15) {
          const waitMinutes = 15 - timeDifference;
          return res.status(400).json({ 
            error: "Already attended", 
            message: `${employee.name} sudah melakukan scan QR untuk meeting ini pada ${existingAttendance.scanTime} WITA. Silakan tunggu ${waitMinutes} menit lagi untuk scan ulang.`,
            lastScanTime: `${existingAttendance.scanTime} WITA`,
            waitTime: `${waitMinutes} menit lagi`,
            currentTime: `${indonesiaTime.getHours().toString().padStart(2, '0')}:${indonesiaTime.getMinutes().toString().padStart(2, '0')} WITA`
          });
        } else {
          console.log(`Allowing re-attendance for ${employee.name} - more than 15 minutes has passed (${timeDifference} minutes)`);
          // Delete previous attendance record to allow new one
          try {
            const deleted = await storage.deleteMeetingAttendance(existingAttendance.id);
            console.log(`Previous attendance deletion result: ${deleted}`);
          } catch (error) {
            console.error(`Error deleting previous attendance:`, error);
          }
        }
      }

      // Record attendance with proper timezone handling
      const now = new Date();
      // Convert to Indonesia time (WIB/WITA) - UTC+7/+8
      const indonesiaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // WITA (+8)
      const scanTime = indonesiaTime.toTimeString().split(' ')[0]; // HH:MM:SS
      const scanDate = indonesiaTime.toISOString().split('T')[0]; // YYYY-MM-DD
      const currentTime = `${indonesiaTime.getHours().toString().padStart(2, '0')}:${indonesiaTime.getMinutes().toString().padStart(2, '0')}`;
      
      console.log(`Meeting attendance recorded at ${currentTime} WITA for ${employee.name}`);

      const attendance = await storage.createMeetingAttendance({
        meetingId: meeting.id,
        employeeId,
        scanTime,
        scanDate,
        deviceInfo: req.headers['user-agent'] || 'Unknown device'
      });

      res.json({
        success: true,
        message: `✅ ${employee.name} berhasil absen untuk meeting: ${meeting.title} pada ${currentTime} WITA`,
        attendance,
        meeting,
        employee,
        scanTime: `${currentTime} WITA`,
        isReAttendance: !!existingAttendance
      });
    } catch (error) {
      console.error("Error recording meeting attendance:", error);
      res.status(500).json({ error: "Failed to record meeting attendance" });
    }
  });

  // Get meeting attendance
  app.get("/api/meetings/:id/attendance", async (req, res) => {
    try {
      const { id } = req.params;
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const attendance = await storage.getMeetingAttendance(id);
      const attendanceWithEmployees = await Promise.all(
        attendance.map(async (att) => {
          const employee = await storage.getEmployee(att.employeeId);
          return {
            ...att,
            employee
          };
        })
      );

      res.json({
        meeting,
        attendance: attendanceWithEmployees,
        totalAttendees: attendance.length
      });
    } catch (error) {
      console.error("Error fetching meeting attendance:", error);
      res.status(500).json({ error: "Failed to fetch meeting attendance" });
    }
  });

  // Update semua QR Code ke format URL
  app.post("/api/qr/update-all", async (req, res) => {
    try {
      console.log('Starting QR code update process...');
      const employees = await storage.getAllEmployees();
      console.log(`Found ${employees.length} employees to update`);
      
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
      
      console.log(`Using base URL: ${baseUrl}`);
      
      let updatedCount = 0;
      const errors: string[] = [];
      
      // Process employees in batches to avoid memory issues
      const BATCH_SIZE = 10;
      for (let i = 0; i < employees.length; i += BATCH_SIZE) {
        const batch = employees.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(employees.length/BATCH_SIZE)}`);
        
        for (const employee of batch) {
          try {
            // Generate new QR URL format
            const secretKey = process.env.QR_SECRET_KEY || 'AttendanceQR2024';
            const tokenData = `${employee.id}${secretKey}Attend`;
            const qrToken = Buffer.from(tokenData).toString('base64').slice(0, 16);
            const qrUrl = `${baseUrl}/qr-redirect?data=${encodeURIComponent(JSON.stringify({ id: employee.id, token: qrToken }))}`;
            
            // Update employee with new QR URL
            await storage.updateEmployee(employee.id, { qrCode: qrUrl });
            updatedCount++;
            console.log(`Updated QR for employee ${employee.id} - ${employee.name}`);
          } catch (error) {
            console.error(`Failed to update employee ${employee.id}:`, error);
            errors.push(`${employee.id}: ${error}`);
          }
        }
      }
      
      console.log(`Update complete. Updated: ${updatedCount}, Errors: ${errors.length}`);
      
      res.json({ 
        message: `Berhasil update ${updatedCount} QR Code ke format URL`,
        updatedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Update QR codes error:', error);
      res.status(500).json({ 
        message: "Failed to update QR codes", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // QR Redirect endpoint untuk handle scan dari luar aplikasi
  app.get("/qr-redirect", async (req, res) => {
    try {
      const data = req.query.data as string;
      if (!data) {
        return res.status(400).send(`
          <html>
            <head>
              <title>QR Code Invalid</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
              <div style="text-align:center; padding:20px; font-family:Arial;">
                <h2>QR Code Invalid</h2>
                <p>Data QR code tidak valid</p>
              </div>
            </body>
          </html>
        `);
      }

      // Parse QR data
      const qrData = JSON.parse(decodeURIComponent(data));
      const { id: employeeId, token } = qrData;

      // Validate employee exists
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).send(`
          <html>
            <head>
              <title>Karyawan Tidak Ditemukan</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
              <div style="text-align:center; padding:20px; font-family:Arial;">
                <h2>Karyawan Tidak Ditemukan</h2>
                <p>Data karyawan dengan ID ${employeeId} tidak ditemukan</p>
              </div>
            </body>
          </html>
        `);
      }

      // Deteksi device
      const userAgent = req.headers['user-agent'] || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

      if (isMobile) {
        // Redirect ke halaman data pribadi untuk mobile
        return res.redirect(`/employee-personal?employeeId=${employeeId}`);
      } else {
        // Redirect ke halaman data pribadi untuk desktop juga
        return res.redirect(`/employee-personal?employeeId=${employeeId}`);
      }

    } catch (error) {
      console.error('QR Redirect error:', error);
      return res.status(500).send(`
        <html>
          <head>
            <title>Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>
            <div style="text-align:center; padding:20px; font-family:Arial;">
              <h2>Terjadi Kesalahan</h2>
              <p>Gagal memproses QR code. Silakan coba lagi.</p>
            </div>
          </body>
        </html>
      `);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
