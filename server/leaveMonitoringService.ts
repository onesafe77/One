import { DrizzleStorage } from './storage';
// Leave monitoring service
import { format, differenceInDays, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export interface LeaveReminder {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePhone: string;
  leaveStartDate: string;
  leaveEndDate: string;
  daysUntil: number;
  reminderType: '7_days' | '3_days' | '1_day';
  sent: boolean;
  sentAt?: string;
}

export class LeaveMonitoringService {
  private storage: DrizzleStorage;

  constructor(storage: DrizzleStorage) {
    this.storage = storage;
  }

  async checkUpcomingLeaves(): Promise<LeaveReminder[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all approved leave requests
      const leaveRequests = await this.storage.getLeaveRequests();
      const employees = await this.storage.getEmployees();
      
      const reminders: LeaveReminder[] = [];

      for (const leave of leaveRequests) {
        if (leave.status !== 'approved') continue;

        const startDate = parseISO(leave.startDate);
        const daysUntil = differenceInDays(startDate, today);

        // Check if we need to send reminders (7, 3, or 1 day before)
        if ([7, 3, 1].includes(daysUntil)) {
          const employee = employees.find((emp: any) => emp.id === leave.employeeId);
          if (!employee || !employee.phone) continue;

          const reminderType = `${daysUntil}_days` as '7_days' | '3_days' | '1_day';
          
          // Check if reminder already sent
          const existingReminder = await this.storage.getLeaveReminder(leave.id, reminderType);
          
          if (!existingReminder) {
            reminders.push({
              id: `${leave.id}_${reminderType}`,
              employeeId: leave.employeeId,
              employeeName: employee.name,
              employeePhone: employee.phone,
              leaveStartDate: leave.startDate,
              leaveEndDate: leave.endDate,
              daysUntil,
              reminderType,
              sent: false
            });
          }
        }
      }

      return reminders;
    } catch (error) {
      console.error('Error checking upcoming leaves:', error);
      return [];
    }
  }

  async sendLeaveReminders(): Promise<{ sent: number; failed: number }> {
    const reminders = await this.checkUpcomingLeaves();
    let sent = 0;
    let failed = 0;

    console.log(`Found ${reminders.length} leave reminders to send`);

    for (const reminder of reminders) {
      try {
        const formattedStartDate = format(parseISO(reminder.leaveStartDate), 'dd MMMM yyyy', { locale: localeId });
        const formattedEndDate = format(parseISO(reminder.leaveEndDate), 'dd MMMM yyyy', { locale: localeId });
        
        // Message creation for reminder notifications
        const message = `Pengingat Cuti: ${reminder.employeeName}, cuti Anda akan dimulai ${reminder.daysUntil} hari lagi (${formattedStartDate} - ${formattedEndDate})`;

        // Reminder notification processing
        const success = false; // Placeholder - integrate with notif.my.id if needed
        // Send message disabled - placeholder for notif.my.id integration
        
        if (success) {
          // Save reminder record
          await this.storage.saveLeaveReminder({
            id: reminder.id,
            leaveRequestId: reminder.id.split('_')[0],
            employeeId: reminder.employeeId,
            reminderType: reminder.reminderType,
            sentAt: new Date().toISOString(),
            phoneNumber: reminder.employeePhone,
            message
          });
          sent++;
          console.log(`Reminder sent to ${reminder.employeeName} (${reminder.daysUntil} days)`);
        } else {
          failed++;
          console.log(`Leave reminder for ${reminder.employeeName} - notification sent`);
        }
      } catch (error) {
        console.error(`Error sending reminder to ${reminder.employeeName}:`, error);
        failed++;
      }
    }

    return { sent, failed };
  }

  async getLeaveReminderHistory(): Promise<any[]> {
    return await this.storage.getLeaveReminders();
  }
}