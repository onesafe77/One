import jsPDF from 'jspdf';
import type { AttendanceRecord, Employee, RosterSchedule } from '@shared/schema';
import { determineShiftByTime } from './shift-utils';
import companyLogo from '@assets/image_1756993494840.png';

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
  leaveMonitoring?: any[]; // Leave monitoring data for work days
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
    const margin = 25; // Top margin 2.5cm
    const bottomMargin = 20; // Bottom margin 2cm
    
    let yPosition = 20;
    
    // Company Header with Logo
    try {
      // Add company logo
      doc.addImage(companyLogo, 'PNG', margin, yPosition - 5, 30, 15); // Logo with 30x15 size
      
      // Company name next to logo
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      // Company name removed
    } catch (error) {
      console.warn('Could not add logo to PDF:', error);
      // Fallback to text only
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      // Company name removed
    }
    yPosition += 25;
    
    // Main Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = 'FORMULIR PEMANTAUAN PERIODE KERJA KONTRAKTOR HAULING';
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    
    // Horizontal line under title
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;
    
    // Form Information in a more structured layout
    if (data.reportInfo) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Draw a border around the information section
      const infoBoxY = yPosition;
      const infoBoxHeight = 75; // Reduced height for compact layout
      doc.rect(margin, infoBoxY, pageWidth - 2 * margin, infoBoxHeight);
      
      // Left column information
      const leftX = margin + 8;
      const rightX = pageWidth - 140;
      const labelWidth = 60; // Increased for better alignment
      let leftY = yPosition + 15;
      
      // Left column with properly aligned layout
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      doc.text('Perusahaan', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      // Company name removed
      leftY += 10;
      
      doc.text('Nama Pengawas', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      doc.text(data.reportInfo.namaPengawas || '-', leftX + labelWidth + 5, leftY);
      leftY += 10;
      
      doc.text('Hari/Tanggal/Waktu', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      const dateTimeInfo = `${data.reportInfo.hari || ''}, ${data.reportInfo.tanggal || ''} / ${data.reportInfo.waktu || ''}`;
      doc.text(dateTimeInfo, leftX + labelWidth + 5, leftY);
      leftY += 10;
      
      doc.text('Shift', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      doc.text(data.reportInfo.shift || '-', leftX + labelWidth + 5, leftY);
      leftY += 10;
      
      doc.text('Tempat', leftX, leftY);
      doc.text(':', leftX + labelWidth, leftY);
      doc.text(data.reportInfo.tempat || '-', leftX + labelWidth + 5, leftY);
      leftY += 10;
      
      // Add Catatan if provided
      if (data.reportInfo?.catatan && data.reportInfo.catatan.trim()) {
        doc.text('Catatan', leftX, leftY);
        doc.text(':', leftX + labelWidth, leftY);
        doc.text(data.reportInfo.catatan, leftX + labelWidth + 5, leftY);
      }
      
      // Right column - Compact signature area
      const sigBoxX = rightX;
      const sigBoxY = infoBoxY + 10;
      const sigBoxWidth = 100;
      const sigBoxHeight = 55;
      
      doc.rect(sigBoxX, sigBoxY, sigBoxWidth, sigBoxHeight);
      
      // Center-aligned signature content
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const signatureText = 'Diperiksa Oleh,';
      const signatureTextWidth = doc.getTextWidth(signatureText);
      doc.text(signatureText, sigBoxX + (sigBoxWidth - signatureTextWidth) / 2, sigBoxY + 10);
      
      // Add signature image if provided
      if (data.reportInfo.tandaTangan) {
        try {
          const base64Data = await fileToBase64(data.reportInfo.tandaTangan);
          doc.addImage(base64Data, 'JPEG', sigBoxX + 20, sigBoxY + 15, 60, 25);
        } catch (error) {
          console.warn('Failed to add signature:', error);
        }
      }
      
      // Signature line
      doc.line(sigBoxX + 15, sigBoxY + 42, sigBoxX + 85, sigBoxY + 42);
      
      // Name - center aligned
      doc.setFontSize(8);
      const nameText = data.reportInfo.diperiksaOleh || 'Syahrani';
      const nameWidth = doc.getTextWidth(nameText);
      doc.text(nameText, sigBoxX + (sigBoxWidth - nameWidth) / 2, sigBoxY + 50);
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
  const bottomMargin = 20; // Define bottomMargin within function scope
  let yPosition = startY;
  
  // Horizontal line before table section
  doc.setLineWidth(0.3);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;
  
  // Shift title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(shiftName.toUpperCase(), margin, yPosition);
  yPosition += 15; // Increased padding between shift title and table
  
  // Get scheduled employees for this shift first (from roster)
  const scheduledEmployees = data.roster?.filter(r => r.shift === shiftName && r.date === data.startDate) || [];
  
  // Remove debug logging for cleaner output
  
  // Include ALL attendance records for this shift section
  let attendanceForThisShift;
  
  if (shiftName.toUpperCase() === 'SHIFT 1') {
    // For Shift 1 section: Include ALL attendance records
    attendanceForThisShift = data.attendance.filter(att => att.date === data.startDate);
  } else {
    // For Shift 2 section: Don't duplicate
    attendanceForThisShift = [];
  }
  
  // Add all attendance records as roster entries for this shift
  console.log(`📋 Processing ${attendanceForThisShift.length} attendance records for ${shiftName}`);
  
  attendanceForThisShift.forEach(att => {
    const employee = data.employees.find(emp => emp.id === att.employeeId);
    
    console.log(`👤 Processing attendance for ${att.employeeId}, employee found: ${!!employee}`);
    if (employee) {
      console.log(`✅ Employee found: ${employee.name} (${employee.id})`);
    } else {
      console.log(`❌ Employee NOT found in data.employees for ${att.employeeId}`);
      console.log(`Available employees sample:`, data.employees.slice(0, 3).map(e => ({id: e.id, name: e.name})));
    }
    
    if (employee) {
      // Check if employee already exists in scheduledEmployees
      const existingIndex = scheduledEmployees.findIndex(emp => emp.employeeId === att.employeeId);
      
      if (existingIndex >= 0) {
        // Update existing roster entry with attendance data
        console.log(`🔄 Updating existing roster entry for ${employee.name}`);
        scheduledEmployees[existingIndex] = {
          ...scheduledEmployees[existingIndex],
          jamTidur: att.jamTidur || '',
          fitToWork: att.fitToWork || 'Fit To Work'
        };
      } else {
        // Add new roster entry for attendance - get hariKerja from any roster for this employee
        const anyRosterRecord = data.roster?.find(r => r.employeeId === att.employeeId);
        console.log(`➕ Adding new roster entry for ${employee.name}`);
        
        scheduledEmployees.push({
          id: `temp-${att.employeeId}`,
          employeeId: att.employeeId,
          date: data.startDate,
          shift: shiftName,
          startTime: shiftName.toUpperCase() === 'SHIFT 1' ? '05:00' : '16:00',
          endTime: shiftName.toUpperCase() === 'SHIFT 1' ? '15:30' : '20:00',
          jamTidur: att.jamTidur || '',
          fitToWork: att.fitToWork || 'Fit To Work',
          hariKerja: anyRosterRecord?.hariKerja || '', // Use hariKerja from any roster record for this employee
          status: 'present',
          employee: employee
        } as any);
      }
    } else {
      // Skip if employee not found
    }
  });
  
  // Table headers with optimized proportional widths for better alignment
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['Nama', 'NIK', 'Shift', 'Hari Kerja', 'Jam Masuk', 'Nomor Lambung', 'Jam Tidur', 'Fit To Work', 'Status'];
  const columnWidths = [90, 60, 40, 50, 60, 90, 45, 70, 50]; // More balanced column widths
  
  // Calculate table dimensions and check if it fits
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const availableWidth = pageWidth - (2 * margin);
  let scaleFactor = 1;
  
  // Auto-scale if table too wide for page
  if (tableWidth > availableWidth) {
    scaleFactor = availableWidth / tableWidth;
    for (let i = 0; i < columnWidths.length; i++) {
      columnWidths[i] = Math.floor(columnWidths[i] * scaleFactor);
    }
  }
  
  const finalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const rowHeight = 12; // Compact but readable row height
  const headerHeight = 14; // Proportional header height
  
  // Clean horizontal line above table header
  doc.setLineWidth(0.3);
  doc.line(margin, yPosition - 3, margin + finalTableWidth, yPosition - 3);
  
  // Header background with proper height
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, yPosition - 2, finalTableWidth, headerHeight, 'F');
  
  // We will show ALL scheduled employees for this shift (both attended and not attended)
  const totalScheduledEmployees = scheduledEmployees.length;
  
  // Main table border - based on ALL scheduled employees, not just attended ones
  doc.setLineWidth(0.3);
  doc.rect(margin, yPosition - 2, finalTableWidth, (totalScheduledEmployees + 1) * rowHeight + 2);
  
  // Vertical grid lines for entire table - cleaner appearance
  let currentX = margin;
  for (let i = 0; i <= headers.length; i++) {
    doc.setLineWidth(0.3);
    doc.line(currentX, yPosition - 2, currentX, yPosition - 2 + (totalScheduledEmployees + 1) * rowHeight + 2);
    if (i < headers.length) {
      currentX += columnWidths[i];
    }
  }
  
  // Header text - properly aligned with compact spacing
  currentX = margin;
  headers.forEach((header, index) => {
    if (index === 0 || index === 1 || index === 5) {
      // Left-aligned headers for Name, NIK, and Nomor Lambung
      doc.text(header, currentX + 4, yPosition + 8.5); // Centered in 14px header
    } else {
      // Center-aligned headers for other columns
      const textWidth = doc.getTextWidth(header);
      const centerX = currentX + (columnWidths[index] - textWidth) / 2;
      doc.text(header, centerX, yPosition + 8.5); // Centered in 14px header
    }
    currentX += columnWidths[index];
  });
  
  // Clean horizontal line after header
  doc.setLineWidth(0.3);
  doc.line(margin, yPosition - 2 + headerHeight, margin + finalTableWidth, yPosition - 2 + headerHeight);
  
  yPosition += headerHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8); // Optimized font size for compact rows
  
  // CRITICAL: Check if we need a new page BEFORE starting to render any rows
  const estimatedTableHeight = (scheduledEmployees.length + 1) * rowHeight + 20; // +1 for header, +20 for padding
  if (yPosition + estimatedTableHeight > doc.internal.pageSize.height - bottomMargin) {
    doc.addPage();
    
    // Add company logo to new page
    try {
      doc.addImage(companyLogo, 'PNG', margin, 15, 30, 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      // Company name removed
    } catch (error) {
      console.warn('Could not add logo to new page:', error);
    }
    
    // Reset position and redraw shift title and table header
    yPosition = margin + 35;
    
    // Shift Title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(shiftName.toUpperCase(), margin, yPosition);
    yPosition += 15;
    
    // Redraw table header
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition - 3, margin + finalTableWidth, yPosition - 3);
    
    doc.setFillColor(220, 220, 220);
    doc.rect(margin, yPosition - 2, finalTableWidth, headerHeight, 'F');
    
    // Vertical grid lines
    let currentX = margin;
    for (let i = 0; i <= headers.length; i++) {
      doc.line(currentX, yPosition - 2, currentX, yPosition - 2 + (scheduledEmployees.length + 1) * rowHeight + 2);
      if (i < headers.length) {
        currentX += columnWidths[i];
      }
    }
    
    // Header text - consistent alignment with first page
    doc.setFontSize(9);
    currentX = margin;
    headers.forEach((header, index) => {
      if (index === 0 || index === 1 || index === 5) {
        // Left-aligned headers for Name, NIK, and Nomor Lambung
        doc.text(header, currentX + 4, yPosition + 8.5);
      } else {
        // Center-aligned headers for other columns
        const textWidth = doc.getTextWidth(header);
        const centerX = currentX + (columnWidths[index] - textWidth) / 2;
        doc.text(header, centerX, yPosition + 8.5);
      }
      currentX += columnWidths[index];
    });
    
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition - 2 + headerHeight, margin + finalTableWidth, yPosition - 2 + headerHeight);
    
    yPosition += headerHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8); // Match main table font size
    
  }

  // Process ALL scheduled employees (both attended and not attended)
  scheduledEmployees.forEach((rosterRecord, rowIndex) => {
    // Find attendance record for this employee (if exists)
    const attendanceRecord = data.attendance.find(att => att.employeeId === rosterRecord.employeeId);
    const employee = data.employees.find(emp => emp.id === rosterRecord.employeeId);
    
    if (!employee) return;
    
    // Get work days from roster data
    const workDaysText = rosterRecord.hariKerja || '-';
    
    // Prepare row data - show ALL scheduled employees with their attendance status
    const jamTidur = attendanceRecord?.jamTidur || '-';
    const fitToWorkStatus = attendanceRecord?.fitToWork || 'Not Fit To Work';
    const attendanceStatus = attendanceRecord ? 'Hadir' : 'Tidak Hadir';
    const attendanceTime = attendanceRecord?.time || '-';
    
    const rowData = [
      employee.name || '-',
      employee.id || '-',
      shiftName || '-',
      workDaysText, // Hari Kerja dari roster
      attendanceTime, // Jam Masuk
      // Format nomor lambung untuk karyawan asli SPARE yang sudah update
      employee.isSpareOrigin && employee.nomorLambung !== "SPARE" ? 
       `SPARE ${employee.nomorLambung}` : (employee.nomorLambung || '-'),
      jamTidur,
      fitToWorkStatus,
      attendanceStatus
    ];
    
    // No alternating background for consistent row appearance
    // All rows will have the same visual height
    
    // Draw row data with proper alignment
    let currentX = margin;
    rowData.forEach((cellData, columnIndex) => {
      const cellText = String(cellData);
      
      if (columnIndex === 0) {
        // Name column - left aligned with consistent padding
        doc.text(cellText, currentX + 4, yPosition + 7.5); // Perfect center in 12px row
      } else if (columnIndex === 1) {
        // NIK column - left aligned 
        doc.text(cellText, currentX + 4, yPosition + 7.5);
      } else if (columnIndex === 5) {
        // Nomor Lambung column - left aligned for better readability
        doc.text(cellText, currentX + 4, yPosition + 7.5);
      } else {
        // Other columns - perfectly center aligned
        const textWidth = doc.getTextWidth(cellText);
        const centerX = currentX + (columnWidths[columnIndex] - textWidth) / 2;
        doc.text(cellText, centerX, yPosition + 7.5); // Perfect center in 12px row
      }
      currentX += columnWidths[columnIndex];
    });
    
    // Clean horizontal line after each row
    doc.setLineWidth(0.2);
    doc.setDrawColor(200, 200, 200); // Very subtle gray line
    doc.line(margin, yPosition + rowHeight, margin + finalTableWidth, yPosition + rowHeight);
    doc.setDrawColor(0, 0, 0); // Reset to black
    
    yPosition += rowHeight;
  });
  
  // Clean bottom border for table
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  doc.line(margin, yPosition + 3, margin + finalTableWidth, yPosition + 3);
  yPosition += 15;
  
  // Professional shift summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  const attendedCount = scheduledEmployees.filter(scheduleRecord => {
    return data.attendance.some(attendance => attendance.employeeId === scheduleRecord.employeeId);
  }).length;
  const scheduledCount = scheduledEmployees.length;
  const absentCount = scheduledCount - attendedCount;
  
  const summaryText = `Ringkasan ${shiftName}: Dijadwalkan: ${scheduledCount} | Hadir: ${attendedCount} | Tidak Hadir: ${absentCount}`;
  doc.text(summaryText, margin, yPosition);
  
  return yPosition + 25;
}


function formatDateForPDF(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('id-ID');
}
