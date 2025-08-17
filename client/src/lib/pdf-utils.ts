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
  
  // Filter attendance by shift
  const shiftAttendance = data.attendance.filter(record => {
    const recordShift = determineShiftByTime(record.time);
    return recordShift === shiftName;
  });
  
  // Get scheduled employees for this shift
  const scheduledEmployees = data.roster?.filter(r => r.shift === shiftName && r.date === data.startDate) || [];
  
  // Separate employees by status
  const fitToWorkEmployees: Array<{record?: any, employee: any}> = [];
  const notFitToWorkEmployees: Array<{record?: any, employee: any}> = [];
  
  // Process attended employees
  shiftAttendance.forEach(record => {
    const employee = data.employees.find(emp => emp.id === record.employeeId);
    if (!employee) return;
    
    if (record.status === 'present') {
      fitToWorkEmployees.push({record, employee});
    } else {
      notFitToWorkEmployees.push({record, employee});
    }
  });
  
  // Add scheduled but absent employees to not fit to work
  scheduledEmployees.forEach(scheduleRecord => {
    const hasAttended = shiftAttendance.some(attendance => 
      attendance.employeeId === scheduleRecord.employeeId
    );
    
    if (!hasAttended) {
      const employee = data.employees.find(emp => emp.id === scheduleRecord.employeeId);
      if (employee) {
        notFitToWorkEmployees.push({employee});
      }
    }
  });
  
  // Render Fit To Work section
  yPosition = renderStatusSection(doc, 'FIT TO WORK', fitToWorkEmployees, shiftName, yPosition, margin, pageWidth);
  
  // Add space between sections
  yPosition += 15;
  
  // Render Not Fit To Work section
  yPosition = renderStatusSection(doc, 'NOT FIT TO WORK', notFitToWorkEmployees, shiftName, yPosition, margin, pageWidth);
  
  // Add shift summary
  yPosition += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  const attendedCount = shiftAttendance.filter(r => r.status === 'present').length;
  const scheduledCount = scheduledEmployees.length;
  const absentCount = scheduledCount - attendedCount;
  
  const summaryText = `Ringkasan ${shiftName}: Dijadwalkan: ${scheduledCount} | Hadir: ${attendedCount} | Tidak Hadir: ${absentCount}`;
  doc.text(summaryText, margin, yPosition);
  
  return yPosition + 10;
}

function renderStatusSection(
  doc: jsPDF,
  statusTitle: string,
  employees: Array<{record?: any, employee: any}>,
  shiftName: string,
  startY: number,
  margin: number,
  pageWidth: number
): number {
  let yPosition = startY;
  
  // Status section title with count
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${statusTitle} (${employees.length} orang)`, margin, yPosition);
  yPosition += 12;
  
  // Table headers
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['Jam Masuk', 'Nama', 'NIK', 'Shift', 'Nomor Lambung', 'Fit/To Work Status'];
  const columnWidths = [35, 60, 45, 30, 40, 45];
  let xPosition = margin;
  
  headers.forEach((header, index) => {
    doc.text(header, xPosition, yPosition);
    xPosition += columnWidths[index];
  });
  
  // Draw header line
  doc.line(margin, yPosition + 3, pageWidth - margin, yPosition + 3);
  yPosition += 12;
  doc.setFont('helvetica', 'normal');
  
  // Render employees
  employees.forEach(({record, employee}) => {
    xPosition = margin;
    
    const status = record ? (record.status === 'present' ? 'Fit To Work' : 'Not Fit To Work') : 'Not Fit To Work';
    const time = record ? record.time : '-';
    
    const rowData = [
      time,
      employee.name,
      employee.id,
      shiftName,
      employee.nomorLambung || '-',
      status
    ];
    
    rowData.forEach((data, index) => {
      doc.text(data, xPosition, yPosition);
      xPosition += columnWidths[index];
    });
    
    yPosition += 10;
    
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 40) {
      doc.addPage();
      yPosition = 30;
    }
  });
  
  return yPosition;
}

function formatDateForPDF(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('id-ID');
}
