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
  catatan: string;
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
      const infoBoxHeight = 100; // Increased height for catatan
      doc.rect(margin, infoBoxY, pageWidth - 2 * margin, infoBoxHeight);
      
      // Left column information
      const leftX = margin + 10;
      const rightX = pageWidth - 160; // More space for signature box
      const labelWidth = 55;
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
      leftY += 12;
      
      // Add Catatan if provided
      if (data.reportInfo?.catatan && data.reportInfo.catatan.trim()) {
        doc.text('Catatan', leftX, leftY);
        doc.text(':', leftX + labelWidth, leftY);
        doc.text(data.reportInfo.catatan, leftX + labelWidth + 10, leftY);
      }
      
      // Right column - Signature area with border
      const sigBoxX = rightX;
      const sigBoxY = infoBoxY + 15;
      const sigBoxWidth = 120;
      const sigBoxHeight = 70;
      
      doc.rect(sigBoxX, sigBoxY, sigBoxWidth, sigBoxHeight);
      doc.text('Diperiksa Oleh,', sigBoxX + 10, sigBoxY + 12);
      
      // Add signature image if provided
      if (data.reportInfo.tandaTangan) {
        try {
          const base64Data = await fileToBase64(data.reportInfo.tandaTangan);
          // Centered signature image
          doc.addImage(base64Data, 'JPEG', sigBoxX + 10, sigBoxY + 18, 60, 30);
        } catch (error) {
          console.warn('Failed to add signature:', error);
          doc.text('(Tanda Tangan)', sigBoxX + 35, sigBoxY + 35);
        }
      }
      
      // Signature line and name - better centered
      doc.line(sigBoxX + 10, sigBoxY + 55, sigBoxX + 110, sigBoxY + 55);
      doc.setFontSize(8);
      const nameText = data.reportInfo.diperiksaOleh || 'Syahrani';
      const nameWidth = doc.getTextWidth(nameText);
      const nameX = sigBoxX + (sigBoxWidth - nameWidth) / 2;
      doc.text(nameText, nameX, sigBoxY + 63);
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
    
    // Summary and notes at bottom
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
  
  // Get scheduled employees for this shift first
  const scheduledEmployees = data.roster?.filter(r => r.shift === shiftName && r.date === data.startDate) || [];
  
  // Table headers with proper alignment
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const headers = ['Jam Masuk', 'Nama', 'NIK', 'Shift', 'Position', 'Nomor Lambung', 'Jam Tidur', 'Fit To Work', 'Status'];
  const columnWidths = [26, 46, 26, 18, 36, 36, 24, 26, 30]; // Adjusted for better proportions
  
  // Calculate table dimensions
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const rowHeight = 10;
  const tableHeight = (scheduledEmployees.length + 1) * rowHeight; // +1 for header
  
  // Draw main table border
  doc.setLineWidth(0.8);
  doc.rect(margin, yPosition - 6, tableWidth, tableHeight);
  
  // Draw header background
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 6, tableWidth, rowHeight, 'F');
  
  // Draw vertical grid lines for all columns
  let currentX = margin;
  for (let i = 0; i <= headers.length; i++) {
    doc.line(currentX, yPosition - 6, currentX, yPosition - 6 + tableHeight);
    if (i < headers.length) {
      currentX += columnWidths[i];
    }
  }
  
  // Draw horizontal header line
  doc.line(margin, yPosition - 6 + rowHeight, margin + tableWidth, yPosition - 6 + rowHeight);
  
  // Add header text (centered)
  currentX = margin;
  headers.forEach((header, index) => {
    const textWidth = doc.getTextWidth(header);
    const centerX = currentX + (columnWidths[index] - textWidth) / 2;
    doc.text(header, centerX, yPosition - 1);
    currentX += columnWidths[index];
  });
  
  yPosition += rowHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7); // Slightly smaller for data rows
  
  // Process scheduled employees and check if they attended
  scheduledEmployees.forEach((scheduleRecord, rowIndex) => {
    const employee = data.employees.find(emp => emp.id === scheduleRecord.employeeId);
    if (!employee) return;
    
    // Find attendance record for this employee
    const attendanceRecord = data.attendance.find(record => record.employeeId === employee.id);
    
    // Prepare row data
    let rowData;
    if (attendanceRecord) {
      // Employee attended - use attendance data
      const jamTidur = attendanceRecord.jamTidur || '-';
      const fitToWorkStatus = attendanceRecord.fitToWork || 'Not Fit To Work';
      const attendanceStatus = attendanceRecord.status === 'present' ? 'Hadir' : 'Tidak Hadir';
      
      rowData = [
        attendanceRecord.time || '-',
        employee.name || '-',
        employee.id || '-',
        shiftName || '-',
        employee.position || '-',
        employee.nomorLambung || '-',
        jamTidur,
        fitToWorkStatus,
        attendanceStatus
      ];
    } else {
      // Employee didn't attend - show as absent
      rowData = [
        '-',
        employee.name || '-',
        employee.id || '-',
        shiftName || '-',
        employee.position || '-',
        employee.nomorLambung || '-',
        '-',
        'Fit To Work',
        'Tidak Hadir'
      ];
    }
    
    // Alternate row background
    if (rowIndex % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPosition - 4, tableWidth, rowHeight, 'F');
    }
    
    // Draw row data with proper alignment
    let currentX = margin;
    rowData.forEach((cellData, columnIndex) => {
      const cellText = String(cellData);
      
      if (columnIndex === 1) {
        // Name column - left aligned with padding
        doc.text(cellText, currentX + 2, yPosition + 2);
      } else {
        // All other columns - center aligned
        const textWidth = doc.getTextWidth(cellText);
        const centerX = currentX + (columnWidths[columnIndex] - textWidth) / 2;
        doc.text(cellText, Math.max(currentX + 1, centerX), yPosition + 2);
      }
      currentX += columnWidths[columnIndex];
    });
    
    // Draw horizontal line after each row
    doc.line(margin, yPosition + rowHeight - 4, margin + tableWidth, yPosition + rowHeight - 4);
    
    yPosition += rowHeight;
    
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
