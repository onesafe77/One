import jsPDF from 'jspdf';
import type { AttendanceRecord, Employee, RosterSchedule } from '@shared/schema';
import { determineShiftByTime } from './shift-utils';

export interface ReportData {
  employees: Employee[];
  attendance: AttendanceRecord[];
  roster?: RosterSchedule[];
  startDate: string;
  endDate: string;
  reportType: 'attendance' | 'summary' | 'leave';
  shiftFilter?: string;
}

export function generateAttendancePDF(data: ReportData): void {
  try {
    const doc = new jsPDF('landscape'); // Use landscape orientation for more columns
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    
    // Title with shift filter info
    doc.setFontSize(16);
    let title = 'LAPORAN ABSENSI HARIAN';
    if (data.shiftFilter === 'Shift 1') {
      title = 'LAPORAN ABSENSI HARIAN - SHIFT 1';
    } else if (data.shiftFilter === 'Shift 2') {
      title = 'LAPORAN ABSENSI HARIAN - SHIFT 2';
    }
    doc.text(title, pageWidth / 2, 25, { align: 'center' });
    
    // Date
    doc.setFontSize(12);
    const reportDate = data.startDate === data.endDate 
      ? `Tanggal: ${formatDateForPDF(data.startDate)}`
      : `Periode: ${formatDateForPDF(data.startDate)} - ${formatDateForPDF(data.endDate)}`;
    doc.text(reportDate, pageWidth / 2, 35, { align: 'center' });
    
    let yPosition = 55;
    
    // Generate shift sections based on filter
    if (data.shiftFilter === 'all' || data.shiftFilter === 'Shift 1') {
      yPosition = generateShiftSection(doc, data, 'Shift 1', yPosition, margin, pageWidth);
    }
    
    // Add Shift 2 if needed
    if (data.shiftFilter === 'all' || data.shiftFilter === 'Shift 2') {
      // Only add space/page if we already rendered Shift 1
      if (data.shiftFilter === 'all') {
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 30;
        } else {
          yPosition += 30; // Add space between sections
        }
      }
      
      yPosition = generateShiftSection(doc, data, 'Shift 2', yPosition, margin, pageWidth);
    }
    
    // Footer
    const now = new Date();
    const footerText = `Laporan dibuat pada: ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID')}`;
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 15, { align: 'center' });
    
    // Download
    const filename = `Laporan_Absensi_${data.startDate.replace(/-/g, '')}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Gagal membuat PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

function generateShiftSection(
  doc: jsPDF, 
  data: ReportData, 
  shiftName: string, 
  startY: number, 
  margin: number, 
  pageWidth: number
): number {
  let yPosition = startY;
  
  // Shift title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(shiftName.toUpperCase(), margin, yPosition);
  yPosition += 15;
  
  // Table headers with Position, Department and Status columns (updated for new employee structure)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['Jam Masuk', 'Nama', 'NIK', 'Shift', 'Position', 'Jam Tidur', 'Fit To Work', 'Status'];
  const columnWidths = [28, 45, 30, 20, 30, 25, 30, 25];
  let xPosition = margin;
  
  headers.forEach((header, index) => {
    doc.text(header, xPosition, yPosition);
    xPosition += columnWidths[index];
  });
  
  // Draw header line
  doc.line(margin, yPosition + 3, pageWidth - margin, yPosition + 3);
  yPosition += 12;
  doc.setFont('helvetica', 'normal');
  
  // Get scheduled employees for this shift
  const scheduledEmployees = data.roster?.filter(r => r.shift === shiftName && r.date === data.startDate) || [];
  
  // Process scheduled employees and check if they attended
  scheduledEmployees.forEach(scheduleRecord => {
    const employee = data.employees.find(emp => emp.id === scheduleRecord.employeeId);
    if (!employee) return;
    
    // Find attendance record for this employee
    const attendanceRecord = data.attendance.find(record => record.employeeId === employee.id);
    
    xPosition = margin;
    
    if (attendanceRecord) {
      // Employee attended - use attendance data
      const jamTidur = attendanceRecord.jamTidur ? `${attendanceRecord.jamTidur} jam` : '-';
      const fitToWorkStatus = attendanceRecord.fitToWork || 'Not Fit To Work';
      const attendanceStatus = attendanceRecord.status === 'present' ? 'Hadir' : 'Tidak Hadir';
      
      const rowData = [
        attendanceRecord.time,
        employee.name,
        employee.id, // NIK
        shiftName, // Use scheduled shift, not detected shift
        employee.position || '-',
        jamTidur,
        fitToWorkStatus,
        attendanceStatus
      ];
      
      rowData.forEach((data, index) => {
        doc.text(data, xPosition, yPosition);
        xPosition += columnWidths[index];
      });
    } else {
      // Employee didn't attend - show as absent
      const rowData = [
        '-', // No check-in time
        employee.name,
        employee.id, // NIK
        shiftName, // Current shift being processed
        employee.position || '-',
        '-', // No jam tidur since absent
        'Fit To Work', // Default fit to work from schedule
        'Tidak Hadir' // Status
      ];
      
      rowData.forEach((data, index) => {
        doc.text(data, xPosition, yPosition);
        xPosition += columnWidths[index];
      });
    }
    
    
    yPosition += 10;
    
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 40) {
      doc.addPage();
      yPosition = 30;
    }
  });
  
  // Add shift summary
  yPosition += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  const attendedCount = scheduledEmployees.filter(scheduleRecord => {
    return data.attendance.some(attendance => attendance.employeeId === scheduleRecord.employeeId);
  }).length;
  const scheduledCount = scheduledEmployees.length;
  const absentCount = scheduledCount - attendedCount;
  
  const summaryText = `Ringkasan ${shiftName}: Dijadwalkan: ${scheduledCount} | Hadir: ${attendedCount} | Tidak Hadir: ${absentCount}`;
  doc.text(summaryText, margin, yPosition);
  
  return yPosition + 10;
}


function formatDateForPDF(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('id-ID');
}
