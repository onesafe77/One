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
  
  // Berdasarkan data roster sesungguhnya:
  // Shift 1: 08:00-16:00 (480 - 960 minutes)
  // Shift 2: 18:00-06:00 (1080 - 360 minutes next day)
  
  if (totalMinutes >= 480 && totalMinutes < 1080) {
    return "Shift 1";
  } else {
    return "Shift 2";
  }
}

// Strict shift time validation based on actual roster schedule
// Fungsi validasi waktu berdasarkan pola shift standar operasional
function isValidRosterTime(currentTime: string, startTime: string, endTime: string): boolean {
  // Tidak menggunakan startTime dan endTime dari roster untuk sementara
  // Karena data roster bisa inconsistent
  return true; // Temporary - akan menggunakan shift-based validation
}

// Fungsi validasi waktu berdasarkan nama shift (sesuai logika validasi yang sudah ada)
function isValidShiftTimeByName(currentTime: string, shiftName: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (shiftName === "Shift 1") {
    // Shift 1: boleh scan dari 06:00 sampai 18:00 (360-1080 menit)
    // Sesuai dengan logika validasi yang sudah ada
    return totalMinutes >= 360 && totalMinutes < 1080;
  } else if (shiftName === "Shift 2") {
    // Shift 2: boleh scan dari 18:00 sampai 06:00 hari berikutnya
    // Window: 18:00-23:59 atau 00:00-06:00 (1080+ menit atau <360 menit)
    return totalMinutes >= 1080 || totalMinutes < 360;
  }
  
  return false;
}

// Fungsi lama untuk backward compatibility (tidak digunakan lagi)
function isValidShiftTime(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: Hanya boleh scan antara jam 06:00:00 sampai 18:00:00 (360-1080 minutes)
    return totalMinutes >= 360 && totalMinutes < 1080;
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: Hanya boleh scan antara jam 18:00:00 sampai 06:00:00 hari berikutnya (1080 minutes to 360 minutes next day)
    return totalMinutes >= 1080 || totalMinutes < 360;
  }
  
  return false;
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
      
      // Add QR Code to employee data
      const employeeWithQR = {
        ...validatedData,
        qrCode: qrUrl // Sekarang berisi URL langsung
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
      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      if (!employee) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }
      res.json(employee);
    } catch (error) {
      res.status(400).json({ message: "Invalid employee data" });
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
          
          // Add QR Code to employee data
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
      
      // Check if employee exists
      const employee = await storage.getEmployee(validatedData.employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }

      // Check if already attended today
      const existingAttendance = await storage.getAttendanceByEmployee(
        validatedData.employeeId, 
        validatedData.date
      );
      if (existingAttendance.length > 0) {
        return res.status(400).json({ message: "Karyawan sudah melakukan absensi hari ini" });
      }

      // Check if employee is scheduled for today
      const roster = await storage.getRosterByDate(validatedData.date);
      const scheduledEmployee = roster.find(r => r.employeeId === validatedData.employeeId);
      
      if (!scheduledEmployee) {
        return res.status(400).json({ message: "Karyawan tidak dijadwalkan untuk hari ini" });
      }

      // Check if employee is currently on leave (optimized query)
      const leaveRequests = await storage.getLeaveByEmployee(validatedData.employeeId);
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
        return res.status(400).json({ 
          message: "Scan tidak sesuai shift" 
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
      console.log('Bulk roster request body:', req.body);
      const { rosters } = req.body;
      if (!Array.isArray(rosters)) {
        return res.status(400).json({ message: "Rosters must be an array" });
      }

      console.log(`Processing ${rosters.length} roster entries`);

      const validatedRosters = [];
      const errors = [];

      // Validate each roster entry
      for (let i = 0; i < rosters.length; i++) {
        try {
          console.log(`Validating roster ${i + 1}:`, rosters[i]);
          const validatedData = insertRosterSchema.parse(rosters[i]);
          console.log(`Validated data for roster ${i + 1}:`, validatedData);
          
          // For bulk upload, we'll create employee if not exists instead of rejecting
          let employee = await storage.getEmployee(validatedData.employeeId);
          if (!employee) {
            console.log(`Employee not found for NIK: ${validatedData.employeeId}, creating new employee`);
            // Create a basic employee record for bulk upload
            try {
              const newEmployee = await storage.createEmployee({
                id: validatedData.employeeId,
                name: `Employee ${validatedData.employeeId}`,
                nomorLambung: `GECL ${Math.random().toString().substr(2, 4)}`,
                phone: '+628123456789',
                status: 'active'
              });
              console.log(`Created new employee: ${newEmployee.id}`);
            } catch (createError) {
              console.error(`Failed to create employee ${validatedData.employeeId}:`, createError);
              errors.push(`Baris ${i + 1}: Gagal membuat karyawan dengan NIK ${validatedData.employeeId}`);
              continue;
            }
          }

          validatedRosters.push(validatedData);
        } catch (error) {
          console.error(`Validation error for row ${i + 1}:`, error);
          console.error(`Row data:`, rosters[i]);
          errors.push(`Baris ${i + 1}: Data tidak valid - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        console.log('Validation errors found:', errors);
        return res.status(400).json({ 
          message: "Beberapa data roster tidak valid", 
          errors: errors 
        });
      }

      console.log(`${validatedRosters.length} rosters passed validation`);

      // Create all valid rosters
      const createdSchedules = [];
      for (const rosterData of validatedRosters) {
        try {
          const schedule = await storage.createRosterSchedule(rosterData);
          createdSchedules.push(schedule);
        } catch (error) {
          // Skip duplicates or other creation errors
        }
      }

      // Trigger report cache invalidation after bulk update
      await triggerReportUpdate();
      
      res.status(201).json({
        message: `${createdSchedules.length} roster berhasil ditambahkan`,
        created: createdSchedules.length,
        total: rosters.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to bulk create roster" });
    }
  });

  app.put("/api/roster/:id", async (req, res) => {
    try {
      const validatedData = insertRosterSchema.partial().parse(req.body);
      
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

  app.put("/api/roster/:id", async (req, res) => {
    try {
      const validatedData = insertRosterSchema.partial().parse(req.body);
      const schedule = await storage.updateRosterSchedule(req.params.id, validatedData);
      if (!schedule) {
        return res.status(404).json({ message: "Roster schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Invalid roster data" });
    }
  });

  app.delete("/api/roster/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteRosterSchedule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Roster schedule not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete roster schedule" });
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

      // Parallel execution for faster response
      const today = new Date().toISOString().split('T')[0];
      const [employee, todayRoster] = await Promise.all([
        storage.getEmployee(employeeId),
        storage.getRosterByDate(today)
      ]);

      if (!employee) {
        return res.status(404).json({ message: "Karyawan tidak ditemukan" });
      }

      // Validate token directly from employee QR code (faster than database lookup)
      let isValid = false;
      if (employee.qrCode) {
        try {
          const qrData = JSON.parse(employee.qrCode);
          isValid = qrData.token === token;
        } catch (parseError) {
          isValid = false;
        }
      }

      if (!isValid) {
        return res.status(400).json({ message: "Token QR tidak valid" });
      }

      const employeeRoster = todayRoster.find(r => r.employeeId === employeeId);

      res.json({ 
        valid: true, 
        employee,
        roster: employeeRoster || null,
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
            
            if (!row || row.length < 2) {
              errors.push(`Row ${i + 2}: Data tidak lengkap (minimal NIK dan Nama)`);
              continue;
            }

            try {
              // Format data aktual dari upload: NIK, Nama, Nomor Lambung, Tanggal Serial, Pilihan Cuti, Tanggal Serial 2, Bulan/OnSite
              const [nik, name, nomorLambung, lastLeaveDateSerial, leaveOption, nextLeaveDateSerial, monthOrOnSite] = row;
              
              // Validate required fields
              if (!nik || !name) {
                errors.push(`Row ${i + 2}: NIK dan Nama harus diisi`);
                continue;
              }

              // Use monthOrOnSite as month, default to current month
              const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
              const finalMonth = monthOrOnSite || currentMonth;

              // Auto-generate investor group dari NIK pattern
              let investorGroup = "Default Group";
              const nikStr = nik.toString();
              if (nikStr.startsWith('C-0')) {
                const nikNum = parseInt(nikStr.split('-')[1]);
                if (nikNum >= 1 && nikNum <= 20000) {
                  investorGroup = "Bu Resty";
                } else if (nikNum >= 20001 && nikNum <= 40000) {
                  investorGroup = "Group A";
                } else if (nikNum >= 40001 && nikNum <= 60000) {
                  investorGroup = "Group B";
                } else if (nikNum >= 60001 && nikNum <= 80000) {
                  investorGroup = "Group C";
                } else {
                  investorGroup = "Group D";
                }
              }

              // Validate leave option atau default ke 70
              let finalLeaveOption = "70";
              if (leaveOption && (leaveOption.toString() === "70" || leaveOption.toString() === "35")) {
                finalLeaveOption = leaveOption.toString();
              } else if (leaveOption) {
                errors.push(`Row ${i + 2}: Pilihan cuti harus 70 atau 35, got: ${leaveOption}`);
                continue;
              }

              // Calculate monitoring days and next leave date
              let monitoringDays = 0;
              let nextLeaveDate = "";
              let finalLastLeaveDate = "";
              let finalStatus = "Aktif";

              if (lastLeaveDateSerial) {
                try {
                  // Handle Excel date format (number of days since 1900)
                  let lastDate;
                  if (typeof lastLeaveDateSerial === 'number') {
                    // Excel date serial number to JavaScript Date
                    lastDate = new Date((lastLeaveDateSerial - 25569) * 86400 * 1000);
                  } else {
                    lastDate = new Date(lastLeaveDateSerial);
                  }
                  
                  if (!isNaN(lastDate.getTime())) {
                    finalLastLeaveDate = lastDate.toISOString().split('T')[0];
                    const today = new Date();
                    monitoringDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                    
                    const workDaysThreshold = finalLeaveOption === "70" ? 70 : 35;
                    const nextDate = new Date(lastDate);
                    nextDate.setDate(lastDate.getDate() + workDaysThreshold);
                    nextLeaveDate = nextDate.toISOString().split('T')[0];

                    // Auto-calculate status berdasarkan monitoring days
                    if (monitoringDays >= workDaysThreshold - 5 && monitoringDays < workDaysThreshold) {
                      finalStatus = "Menunggu Cuti";
                    } else if (monitoringDays >= workDaysThreshold) {
                      finalStatus = "Menunggu Cuti"; // Ready for leave
                    } else {
                      finalStatus = "Aktif";
                    }
                  }
                } catch (dateError) {
                  console.error("Date parsing error:", dateError);
                }
              }

              console.log("Creating monitoring entry for:", nik, name);
              
              // Create leave roster monitoring entry
              const finalOnSite = ""; // OnSite akan diset manual atau dari upload terpisah
              const finalNomorLambung = nomorLambung ? nomorLambung.toString().trim() : "";
              await storage.createLeaveRosterMonitoring({
                nik: nik.toString(),
                name: name.toString(),
                nomorLambung: finalNomorLambung,
                month: finalMonth,
                investorGroup: investorGroup,
                lastLeaveDate: finalLastLeaveDate,
                leaveOption: finalLeaveOption,
                monitoringDays,
                nextLeaveDate,
                status: finalStatus,
                onSite: finalOnSite
              } as any);

              successCount++;
              console.log(`Successfully created entry for ${nik} - ${name}`);
              
            } catch (error) {
              console.error(`Error processing row ${i + 2}:`, error);
              errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Check if employee exists
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Check if employee already attended this meeting
      const existingAttendance = await storage.checkMeetingAttendance(meeting.id, employeeId);
      if (existingAttendance) {
        return res.status(400).json({ 
          error: "Already attended", 
          message: `${employee.name} sudah melakukan scan QR untuk meeting ini pada ${existingAttendance.scanTime}` 
        });
      }

      // Record attendance
      const now = new Date();
      const scanTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
      const scanDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

      const attendance = await storage.createMeetingAttendance({
        meetingId: meeting.id,
        employeeId,
        scanTime,
        scanDate,
        deviceInfo: req.headers['user-agent'] || 'Unknown device'
      });

      res.json({
        success: true,
        message: `${employee.name} berhasil absen untuk meeting: ${meeting.title}`,
        attendance,
        meeting,
        employee
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
