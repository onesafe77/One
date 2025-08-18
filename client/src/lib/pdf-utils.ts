import jsPDF from 'jspdf';
import type { AttendanceRecord, Employee, RosterSchedule } from '@shared/schema';
import { determineShiftByTime } from './shift-utils';

interface ReportInfo {
  perusahaan: string;
  namaPengawas: string;
  hari: string;
  tanggal: string;
  waktu: string;
  shift: string;
  tempat: string;
  diperiksaOleh: string;
  tandaTangan: File | null;
}

export interface ReportData {
  employees: Employee[];
  attendance: AttendanceRecord[];
  roster?: RosterSchedule[];
  startDate: string;
  endDate: string;
  reportType: 'attendance' | 'summary' | 'leave';
  shiftFilter?: string;
  reportInfo?: ReportInfo;
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function generateAttendancePDF(data: ReportData): Promise<void> {
  try {
    const doc = new jsPDF('landscape'); // Use landscape orientation for more columns
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    
    let yPosition = 20;
    
    // Company Header
    if (data.reportInfo?.perusahaan) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(data.reportInfo.perusahaan, margin, yPosition);
      yPosition += 20;
    }
    
    // Title with shift filter info
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    let title = 'FORMULIR PEMANTAUAN PERIODE KERJA KONTRAKTOR HAULING';
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
    
    // Form Information in a more structured layout
    if (data.reportInfo) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Draw a border around the information section
      const infoBoxY = yPosition;
      const infoBoxHeight = 80;
      doc.rect(margin, infoBoxY, pageWidth - 2 * margin, infoBoxHeight);
      
      // Left column information
      const leftX = margin + 10;
      const rightX = pageWidth - 140;
      const labelWidth = 50;
      let leftY = yPosition + 15;
      
      // Left column with aligned layout
      doc.text('Perusahaan', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      doc.text(data.reportInfo.perusahaan || '-', leftX + labelWidth + 10, leftY);
      leftY += 12;
      
      doc.text('Nama Pengawas', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      doc.text(data.reportInfo.namaPengawas || '-', leftX + labelWidth + 10, leftY);
      leftY += 12;
      
      doc.text('Hari/Tanggal/Waktu', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      const dateTimeInfo = `${data.reportInfo.hari}, ${data.reportInfo.tanggal} / ${data.reportInfo.waktu}`;
      doc.text(dateTimeInfo || '-', leftX + labelWidth + 10, leftY);
      leftY += 12;
      
      doc.text('Shift', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      doc.text(data.reportInfo.shift || '-', leftX + labelWidth + 10, leftY);
      leftY += 12;
      
      doc.text('Tempat', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      doc.text(data.reportInfo.tempat || '-', leftX + labelWidth + 10, leftY);
      
      // Right column - Signature area with border
      const sigBoxX = rightX;
      const sigBoxY = infoBoxY + 10;
      const sigBoxWidth = 100;
      const sigBoxHeight = 60;
      
      doc.rect(sigBoxX, sigBoxY, sigBoxWidth, sigBoxHeight);
      doc.text('Diperiksa Oleh,', sigBoxX + 5, sigBoxY + 10);
      
      // Add signature image if provided
      if (data.reportInfo.tandaTangan) {
        try {
          const base64Data = await fileToBase64(data.reportInfo.tandaTangan);
          doc.addImage(base64Data, 'JPEG', sigBoxX + 5, sigBoxY + 15, 50, 25);
        } catch (error) {
          console.warn('Failed to add signature:', error);
          doc.text('(Tanda Tangan)', sigBoxX + 20, sigBoxY + 30);
        }
      }
      
      // Signature line and name
      doc.line(sigBoxX + 5, sigBoxY + 45, sigBoxX + 85, sigBoxY + 45);
      doc.setFontSize(8);
      doc.text(data.reportInfo.diperiksaOleh || 'Pengawas Pool', sigBoxX + 5, sigBoxY + 52);
      doc.setFontSize(10);
      
      yPosition = infoBoxY + infoBoxHeight + 20;
    }
    
    // Date
    doc.setFontSize(12);
    const reportDate = data.startDate === data.endDate 
      ? `Tanggal: ${formatDateForPDF(data.startDate)}`
      : `Periode: ${formatDateForPDF(data.startDate)} - ${formatDateForPDF(data.endDate)}`;
    doc.text(reportDate, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
    
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
    
    // Summary at bottom
    if (yPosition < pageHeight - 80) {
      yPosition += 20;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      
      // Get summary data for the specific shift
      const targetShift = data.shiftFilter === 'all' ? 'Shift 2' : data.shiftFilter;
      const shiftScheduled = data.roster?.filter(r => r.shift === targetShift && r.date === data.startDate) || [];
      const attendanceOnDate = data.attendance.filter(a => a.date === data.startDate);
      const shiftAttended = shiftScheduled.filter(r => 
        attendanceOnDate.some(a => a.employeeId === r.employeeId)
      ).length;
      const shiftAbsent = shiftScheduled.length - shiftAttended;
      
      const summaryText = `Ringkasan ${targetShift}: Dijadwalkan: ${shiftScheduled.length} | Hadir: ${shiftAttended} | Tidak Hadir: ${shiftAbsent}`;
      doc.text(summaryText, margin, yPosition);
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
  
  // Table headers with better spacing and alignment
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const headers = ['Jam Masuk', 'Nama', 'NIK', 'Shift', 'Position', 'Nomor Lambung', 'Jam Tidur', 'Fit To Work', 'Status'];
  const columnWidths = [30, 50, 30, 18, 40, 40, 25, 30, 25];
  let xPosition = margin;
  
  // Draw complete table border first
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const tableHeight = (scheduledEmployees.length + 1) * 12; // +1 for header
  
  // Table background for better readability
  doc.setFillColor(255, 255, 255); // White background
  doc.rect(margin, yPosition - 8, tableWidth, tableHeight, 'F');
  
  // Draw table border
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition - 8, tableWidth, tableHeight);
  
  // Draw table header background
  doc.setFillColor(220, 220, 220); // Darker gray for header
  doc.rect(margin, yPosition - 8, tableWidth, 12, 'F');
  doc.setTextColor(0, 0, 0); // Black text
  
  // Draw vertical grid lines for header
  let currentX = margin;
  headers.forEach((header, index) => {
    // Center align header text
    const textWidth = doc.getTextWidth(header);
    const centerX = currentX + (columnWidths[index] - textWidth) / 2;
    doc.text(header, centerX, yPosition);
    
    currentX += columnWidths[index];
    // Draw vertical line after each column
    doc.line(currentX, yPosition - 8, currentX, yPosition - 8 + tableHeight);
  });
  
  yPosition += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
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
      const jamTidur = attendanceRecord.jamTidur || '-';
      const fitToWorkStatus = attendanceRecord.fitToWork || 'Not Fit To Work';
      const attendanceStatus = attendanceRecord.status === 'present' ? 'Hadir' : 'Tidak Hadir';
      
      const rowData = [
        attendanceRecord.time,
        employee.name,
        employee.id, // NIK
        shiftName, // Use scheduled shift, not detected shift
        employee.position || '-',
        employee.nomorLambung || '-',
        jamTidur,
        fitToWorkStatus,
        attendanceStatus
      ];
      
      // Alternate row background for better readability
      if ((scheduledEmployees.indexOf(scheduleRecord) + 1) % 2 === 0) {
        doc.setFillColor(248, 248, 248); // Very light gray for even rows
        doc.rect(margin, yPosition - 6, tableWidth, 12, 'F');
      }
      
      rowData.forEach((data, index) => {
        // Center align text in each cell (except name which is left-aligned)
        if (index === 1) { // Name column - left align
          doc.text(data, xPosition + 2, yPosition);
        } else {
          const textWidth = doc.getTextWidth(data);
          const centerX = xPosition + (columnWidths[index] - textWidth) / 2;
          doc.text(data, centerX, yPosition);
        }
        xPosition += columnWidths[index];
      });
      
      // Draw horizontal line below each row
      doc.line(margin, yPosition + 6, margin + tableWidth, yPosition + 6);
    } else {
      // Employee didn't attend - show as absent
      const rowData = [
        '-', // No check-in time
        employee.name,
        employee.id, // NIK
        shiftName, // Current shift being processed
        employee.position || '-',
        employee.nomorLambung || '-',
        '-', // No jam tidur since absent
        'Fit To Work', // Default fit to work from schedule
        'Tidak Hadir' // Status
      ];
      
      // Alternate row background for better readability
      if ((scheduledEmployees.indexOf(scheduleRecord) + 1) % 2 === 0) {
        doc.setFillColor(248, 248, 248); // Very light gray for even rows
        doc.rect(margin, yPosition - 6, tableWidth, 12, 'F');
      }
      
      rowData.forEach((data, index) => {
        // Center align text in each cell (except name which is left-aligned)
        if (index === 1) { // Name column - left align
          doc.text(data, xPosition + 2, yPosition);
        } else {
          const textWidth = doc.getTextWidth(data);
          const centerX = xPosition + (columnWidths[index] - textWidth) / 2;
          doc.text(data, centerX, yPosition);
        }
        xPosition += columnWidths[index];
      });
      
      // Draw horizontal line below each row
      doc.line(margin, yPosition + 6, margin + tableWidth, yPosition + 6);
    }
    
    
    yPosition += 14;
    
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 40) {
      doc.addPage();
      yPosition = 30;
    }
  });
  
  // Add shift summary
  yPosition += 20;
  doc.setFontSize(9);
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
