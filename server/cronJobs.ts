import * as cron from 'node-cron';
import { storage } from './storage';
import { LeaveMonitoringService } from './leaveMonitoringService';

export function initializeCronJobs() {
  const monitoringService = new LeaveMonitoringService(storage as any);

  // Run every day at 9:00 AM to check for leave reminders
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily leave reminder check...');
    try {
      const result = await monitoringService.sendLeaveReminders();
      console.log(`Leave reminders completed: ${result.sent} sent, ${result.failed} failed`);
    } catch (error) {
      console.error('Error in daily leave reminder job:', error);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  // Optional: Run every Monday at 8:00 AM for weekly summary
  cron.schedule('0 8 * * 1', async () => {
    console.log('Running weekly leave monitoring summary...');
    try {
      const upcomingLeaves = await monitoringService.checkUpcomingLeaves();
      console.log(`Weekly summary: ${upcomingLeaves.length} upcoming leave reminders to send`);
    } catch (error) {
      console.error('Error in weekly summary job:', error);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log('Cron jobs initialized for leave monitoring');
}