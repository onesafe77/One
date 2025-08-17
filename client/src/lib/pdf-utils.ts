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
}

export function generateAttendancePDF(data: ReportData): void {
  const doc = new jsPDF('landscape'); // Use landscape orientation for more columns
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  
  // Title
  doc.setFontSize(16);
  doc.text('LAPORAN ABSENSI HARIAN', pageWidth / 2, 25, { align: 'center' });
  
  // Date
  doc.setFontSize(12);
  const reportDate = data.startDate === data.endDate 
    ? `Tanggal: ${formatDateForPDF(data.startDate)}`
    : `Periode: ${formatDateForPDF(data.startDate)} - ${formatDateForPDF(data.endDate)}`;
  doc.text(reportDate, pageWidth / 2, 35, { align: 'center' });
  
  let yPosition = 55;
  
  // Generate shift sections
  yPosition = generateShiftSection(doc, data, 'Shift 1', yPosition, margin, pageWidth);
  
  // Add new page or sufficient space for Shift 2
  if (yPosition > pageHeight - 100) {
    doc.addPage();
    yPosition = 30;
  } else {
    yPosition += 30; // Add space between sections
  }
  
  yPosition = generateShiftSection(doc, data, 'Shift 2', yPosition, margin, pageWidth);
  
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
  
  // Table headers
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['No', 'Nama', 'NIK/No Simper', 'Unit', 'Jam Masuk', 'Status'];
  const columnWidths = [15, 60, 45, 40, 35, 30];
  let xPosition = margin;
  
  headers.forEach((header, index) => {
    doc.text(header, xPosition, yPosition);
    xPosition += columnWidths[index];
  });
  
  // Draw header line
  doc.line(margin, yPosition + 3, pageWidth - margin, yPosition + 3);
  yPosition += 12;
  doc.setFont('helvetica', 'normal');
  
  // Filter attendance by shift
  const shiftAttendance = data.attendance.filter(record => {
    const recordShift = determineShiftByTime(record.time);
    return recordShift === shiftName;
  });
  
  // Get scheduled employees for this shift
  const scheduledEmployees = data.roster?.filter(r => r.shift === shiftName && r.date === data.startDate) || [];
  
  let rowNumber = 1;
  
  // Process attended employees first
  shiftAttendance.forEach(record => {
    const employee = data.employees.find(emp => emp.id === record.employeeId);
    if (!employee) return;
    
    xPosition = margin;
    
    // Row data
    const rowData = [
      rowNumber.toString(),
      employee.name,
      employee.id, // Using employee ID as NIK/No Simper
      employee.shift || 'Unit 1', // Using shift as unit, or default
      record.time,
      record.status === 'present' ? 'Hadir' : 'Tidak Hadir'
    ];
    
    rowData.forEach((data, index) => {
      doc.text(data, xPosition, yPosition);
      xPosition += columnWidths[index];
    });
    
    yPosition += 10;
    rowNumber++;
    
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 40) {
      doc.addPage();
      yPosition = 30;
    }
  });
  
  // Add scheduled but absent employees
  scheduledEmployees.forEach(scheduleRecord => {
    // Check if employee already attended
    const hasAttended = shiftAttendance.some(attendance => 
      attendance.employeeId === scheduleRecord.employeeId
    );
    
    if (!hasAttended) {
      const employee = data.employees.find(emp => emp.id === scheduleRecord.employeeId);
      if (!employee) return;
      
      xPosition = margin;
      
      // Row data for absent employee
      const rowData = [
        rowNumber.toString(),
        employee.name,
        employee.id,
        employee.shift || 'Unit 1',
        '-',
        'Tidak Hadir'
      ];
      
      rowData.forEach((data, index) => {
        doc.text(data, xPosition, yPosition);
        xPosition += columnWidths[index];
      });
      
      yPosition += 10;
      rowNumber++;
      
      // Check if we need a new page
      if (yPosition > doc.internal.pageSize.height - 40) {
        doc.addPage();
        yPosition = 30;
      }
    }
  });
  
  // Summary for this shift
  yPosition += 10;
  doc.setFont('helvetica', 'bold');
  const presentCount = shiftAttendance.filter(r => r.status === 'present').length;
  const scheduledCount = scheduledEmployees.length;
  const absentCount = scheduledCount - presentCount;
  
  doc.text(`Ringkasan ${shiftName}:`, margin, yPosition);
  yPosition += 10;
  doc.setFont('helvetica', 'normal');
  doc.text(`Dijadwalkan: ${scheduledCount} | Hadir: ${presentCount} | Tidak Hadir: ${absentCount}`, margin, yPosition);
  
  return yPosition + 15;
}

function formatDateForPDF(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('id-ID');
}
