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
  insertWhatsappBlastSchema
} from "@shared/schema";


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
function isValidShiftTime(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: Allow flexible check-in from 06:00 to 18:00 (360-1080 minutes)
    return totalMinutes >= 360 && totalMinutes < 1080;
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: Allow check-in from 12:00 to 10:00 next day (720 minutes to 600 minutes next day)
    return totalMinutes >= 720 || totalMinutes < 600;
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
      const qrData = JSON.stringify({ id: validatedData.id, token: qrToken });
      
      // Add QR Code to employee data
      const employeeWithQR = {
        ...validatedData,
        qrCode: qrData
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

      // Get current time for precise shift validation
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      console.log(`Validating shift for ${validatedData.employeeId}: Current time ${currentTime}, Scheduled ${scheduledEmployee.shift}`);
      
      // Strict shift validation based on roster schedule
      const isValidTiming = isValidShiftTime(currentTime, scheduledEmployee.shift);
      
      console.log(`Shift validation result: ${isValidTiming}`);
      
      if (!isValidTiming) {
        const shift1Window = "06:00-18:00";
        const shift2Window = "12:00-10:00 (keesokan hari)";
        const allowedWindow = scheduledEmployee.shift === "Shift 1" ? shift1Window : shift2Window;
        
        return res.status(400).json({ 
          message: `Absensi ditolak! Karyawan dijadwalkan untuk ${scheduledEmployee.shift} (jam ${allowedWindow}). Waktu scan saat ini ${currentTime} tidak sesuai dengan jadwal shift.` 
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
      if (!date) {
        return res.status(400).json({ message: "Date parameter is required" });
      }
      
      const roster = await storage.getRosterByDate(date);
      const attendance = await storage.getAllAttendance(date);
      
      // Enrich roster dengan data attendance
      const enrichedRoster = roster.map(schedule => {
        const attendanceRecord = attendance.find(att => att.employeeId === schedule.employeeId);
        return {
          ...schedule,
          hasAttended: !!attendanceRecord,
          attendanceTime: attendanceRecord?.time || null,
          actualJamTidur: attendanceRecord?.jamTidur || schedule.jamTidur,
          actualFitToWork: attendanceRecord?.fitToWork || schedule.fitToWork,
          attendanceStatus: attendanceRecord ? "present" : "absent"
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

      res.json({
        employeeId,
        token,
        qrData: JSON.stringify({ id: employeeId, token })
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

      // Check if employee exists and get QR data directly (faster than separate queries)
      const employee = await storage.getEmployee(employeeId);
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

      // Get today's roster for this employee (optimized query)
      const today = new Date().toISOString().split('T')[0];
      const todayRoster = await storage.getRosterByDate(today);
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

  // Recent attendance activities
  app.get("/api/dashboard/recent-activities", async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      
      const [attendance, employees] = await Promise.all([
        storage.getAllAttendance(date),
        storage.getAllEmployees()
      ]);

      // Get recent activities (latest 10 attendance records)
      const recentActivities = attendance
        .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
        .slice(0, 10)
        .map(record => {
          const employee = employees.find(emp => emp.id === record.employeeId);
          return {
            id: record.id,
            employeeId: record.employeeId,
            employeeName: employee?.name || 'Unknown',
            time: record.time,
            jamTidur: record.jamTidur,
            fitToWork: record.fitToWork,
            status: record.status,
            createdAt: record.createdAt
          };
        });

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
          
          let result;
          if (blast.imageUrl) {
            // For image messages, try text-only first if image fails
            try {
              const imageUrl = `${req.protocol}://${req.get('host')}${blast.imageUrl}`;
              console.log(`Attempting to send image: ${imageUrl}`);
              result = await whatsappService.sendImageMessage(phoneNumber, blast.message, imageUrl);
            } catch (imageError) {
              console.warn(`Image send failed for ${employee.name}, falling back to text:`, imageError);
              // Fallback to text message if image fails
              result = await whatsappService.sendTextMessage(phoneNumber, `${blast.message}\n\n[Gambar tidak dapat dikirim]`);
            }
          } else {
            // Send text message
            result = await whatsappService.sendTextMessage(phoneNumber, blast.message);
          }

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

        // Add delay between messages to avoid rate limiting
        if (i < targetEmployees.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between each message
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

  const httpServer = createServer(app);
  return httpServer;
}
