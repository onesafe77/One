import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertEmployeeSchema, 
  insertAttendanceSchema, 
  insertRosterSchema, 
  insertLeaveRequestSchema,
  insertQrTokenSchema 
} from "@shared/schema";

// Utility function to determine shift based on time
function determineShiftByTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Shift 1: 06:00:00 - 18:00:00 (360 - 1080 minutes)
  // Shift 2: 18:00:00 - 06:00:00 (1080 - 360 minutes next day)
  
  if (totalMinutes >= 360 && totalMinutes < 1080) {
    return "Shift 1";
  } else {
    return "Shift 2";
  }
}

// Allow flexible check-in timing with transition periods
function isWithinShiftTransitionPeriod(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: 06:00-18:00, allow check-in from 05:30 to 18:30 (flexible window)
    return totalMinutes >= 330 && totalMinutes <= 1110; // 5:30 AM to 6:30 PM
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: 18:00-06:00, allow check-in from 17:30 to 06:30 (next day)
    return totalMinutes >= 1050 || totalMinutes <= 390; // 5:30 PM to 6:30 AM
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

      // Get current time to determine appropriate shift for validation
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const detectedShift = determineShiftByTime(currentTime);
      
      // More flexible shift validation: allow check-in if:
      // 1. Employee is scheduled for the detected shift, OR
      // 2. It's within shift transition period (allow some flexibility)
      const isValidShiftTiming = 
        scheduledEmployee.shift === detectedShift || 
        isWithinShiftTransitionPeriod(currentTime, scheduledEmployee.shift);
      
      if (!isValidShiftTiming) {
        return res.status(400).json({ 
          message: `Karyawan dijadwalkan untuk ${scheduledEmployee.shift}. Waktu check-in saat ini (${currentTime}) tidak sesuai dengan jadwal shift yang ditentukan.` 
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

  const httpServer = createServer(app);
  return httpServer;
}
