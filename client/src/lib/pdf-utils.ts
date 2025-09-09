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
  orientation?: 'landscape' | 'portrait'; // Professional orientation option
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
    // Professional orientation handling dengan layout yang berbeda
    const orientation = data.orientation || 'landscape';
    
    if (orientation === 'portrait') {
      // Gunakan layout khusus A4 portrait sesuai spesifikasi user
      await generateA4PortraitPDF(data);
      return;
    }
    
    // Untuk landscape, gunakan layout yang sudah ada
    const doc = new jsPDF('landscape'); 
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 25; // Professional margin sesuai ReportLab standard (25pt)
    const bottomMargin = 35; // Extra space untuk custom footer professional
    
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
    
    // Main Title (following ReportLab 14pt font standard)
    doc.setFontSize(14); // Professional 14pt title as per ReportLab example
    doc.setFont('helvetica', 'bold');
    const title = 'FORMULIR PEMANTAUAN PERIODE KERJA KONTRAKTOR HAULING';
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    
    // Horizontal line under title
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;
    
    // Professional form information layout (ReportLab style)
    if (data.reportInfo) {
      doc.setFontSize(10); // 10pt sub-header as per ReportLab standard
      doc.setFont('helvetica', 'normal');
      
      // Information box dengan styling professional
      const infoBoxY = yPosition;
      const infoBoxHeight = 80; // Enhanced height untuk layout yang lebih baik
      doc.setLineWidth(0.8); // Border thickness sesuai ReportLab
      doc.rect(margin, infoBoxY, pageWidth - 2 * margin, infoBoxHeight);
      
      // Left column information
      const leftX = margin + 8;
      const rightX = pageWidth - 140;
      const labelWidth = 60; // Increased for better alignment
      let leftY = yPosition + 15;
      
      // Left column dengan font hierarchy professional
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8); // 8pt untuk content detail sesuai ReportLab standard
      
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
      
      // Professional signature content styling
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8); // Consistent 8pt untuk content
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
      
      // Name dengan consistent font size
      doc.setFontSize(8); // Consistent 8pt
      const nameText = data.reportInfo.diperiksaOleh || 'Syahrani';
      const nameWidth = doc.getTextWidth(nameText);
      doc.text(nameText, sigBoxX + (sigBoxWidth - nameWidth) / 2, sigBoxY + 50);
      
      yPosition = infoBoxY + infoBoxHeight + 10; // Reduced spacing
    }
    
    // Professional date styling
    doc.setFontSize(10); // 10pt untuk sub-header sesuai ReportLab
    const reportDate = data.startDate === data.endDate 
      ? `Tanggal: ${formatDateForPDF(data.startDate)}`
      : `Periode: ${formatDateForPDF(data.startDate)} - ${formatDateForPDF(data.endDate)}`;
    doc.text(reportDate, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12; // Professional spacing
    
    // Generate shift sections based on filter
    if (data.shiftFilter === 'all' || data.shiftFilter === 'Shift 1') {
      yPosition = generateShiftSection(doc, data, 'Shift 1', yPosition, margin, pageWidth);
    }
    
    // Add Shift 2 if needed - only if there's actually Shift 2 data
    const shift2Data = data.roster?.filter(r => r.shift === 'Shift 2' && r.date === data.startDate) || [];
    if ((data.shiftFilter === 'all' || data.shiftFilter === 'Shift 2') && shift2Data.length > 0) {
      // Only add space/page if we already rendered Shift 1
      if (data.shiftFilter === 'all') {
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 30;
        } else {
          yPosition += 20; // Reduced space between sections
        }
      }
      
      yPosition = generateShiftSection(doc, data, 'Shift 2', yPosition, margin, pageWidth);
    }
    
    // Ensure enough space for footer and summary (need at least 60px total)
    const footerHeight = 60; // Space needed for summary + footer
    const availableSpace = pageHeight - yPosition - footerHeight;
    
    // Professional footer dengan page numbers dan timestamp
    addProfessionalFooter(doc, pageWidth, pageHeight, margin, 1); // Single page for main report
    
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
  const bottomMargin = 30; // Space for professional footer
  let yPosition = startY;
  
  // Shift title - subjudul tebal
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(shiftName.toUpperCase(), margin, yPosition);
  yPosition += 8; // Compact spacing
  
  // Get scheduled employees for this shift first (from roster)
  const scheduledEmployees = data.roster?.filter(r => r.shift === shiftName && r.date === data.startDate) || [];
  
  // For SHIFT 1: show all attendance, For SHIFT 2: show only if there's actual Shift 2 roster data
  let attendanceForThisShift: typeof data.attendance;
  
  if (shiftName.toUpperCase() === 'SHIFT 1') {
    // For Shift 1 section: Include ALL attendance records for this date
    attendanceForThisShift = data.attendance.filter(att => att.date === data.startDate);
  } else {
    // For Shift 2 section: Only show if employee is actually scheduled for Shift 2
    attendanceForThisShift = data.attendance.filter(att => {
      if (att.date !== data.startDate) return false;
      const employeeRoster = data.roster?.find(r => r.employeeId === att.employeeId && r.date === data.startDate && r.shift === 'Shift 2');
      return !!employeeRoster;
    });
  }
  
  // Add all attendance records as roster entries for this shift
  attendanceForThisShift.forEach(att => {
    const employee = data.employees.find(emp => emp.id === att.employeeId);
    
    if (employee) {
      // Check if employee already exists in scheduledEmployees
      const existingIndex = scheduledEmployees.findIndex(emp => emp.employeeId === att.employeeId);
      
      if (existingIndex >= 0) {
        // Update existing roster entry with attendance data
        scheduledEmployees[existingIndex] = {
          ...scheduledEmployees[existingIndex],
          jamTidur: att.jamTidur || '',
          fitToWork: att.fitToWork || 'Fit To Work'
        };
      } else {
        // Add new roster entry for attendance - get hariKerja from any roster for this employee
        const anyRosterRecord = data.roster?.find(r => r.employeeId === att.employeeId);
        
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
    }
  });
  
  // Check if there's no data for this shift
  if (scheduledEmployees.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Tidak ada data untuk shift ini', margin + 5, yPosition);
    yPosition += 20;
    return yPosition;
  }
  
  // Professional table headers (ReportLab hierarchy: 9pt headers, 8pt content)
  doc.setFontSize(9); // 9pt untuk table headers sesuai ReportLab standard
  doc.setFont('helvetica', 'bold');
  const headers = ['Nama', 'NIK', 'Shift', 'Hari Kerja', 'Jam Masuk', 'Nomor Lambung', 'Jam Tidur', 'Fit To Work', 'Status'];
  const baseColumnWidths = [90, 60, 32, 48, 52, 88, 42, 65, 48]; // Enhanced proportions based on ReportLab A4
  
  // Auto-fit table to page width
  const availableWidth = pageWidth - (2 * margin);
  const totalBaseWidth = baseColumnWidths.reduce((sum, width) => sum + width, 0);
  const scaleFactor = availableWidth / totalBaseWidth;
  
  const columnWidths = baseColumnWidths.map(width => Math.floor(width * scaleFactor));
  const finalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const rowHeight = 11; // More compact row height
  const headerHeight = 13; // Compact header height
  
  // Professional header background (following ReportLab grey standard)
  doc.setFillColor(128, 128, 128); // Proper grey background like ReportLab example
  doc.rect(margin, yPosition, finalTableWidth, headerHeight, 'F');
  
  // We will show ALL scheduled employees for this shift (both attended and not attended)
  const totalScheduledEmployees = scheduledEmployees.length;
  
  // Main table border tipis
  doc.setLineWidth(0.2); // Thin border
  doc.rect(margin, yPosition, finalTableWidth, (totalScheduledEmployees + 1) * rowHeight);
  
  // Vertical grid lines tipis
  let currentX = margin;
  for (let i = 0; i <= headers.length; i++) {
    doc.setLineWidth(0.2);
    doc.line(currentX, yPosition, currentX, yPosition + (totalScheduledEmployees + 1) * rowHeight);
    if (i < headers.length) {
      currentX += columnWidths[i];
    }
  }
  
  // Header text - center aligned, bold, white text on grey background (ReportLab style)
  doc.setTextColor(255, 255, 255); // White text for contrast on grey background
  currentX = margin;
  headers.forEach((header, index) => {
    const headerText = header;
    const textWidth = doc.getTextWidth(headerText);
    const centerX = currentX + (columnWidths[index] - textWidth) / 2;
    doc.text(headerText, centerX, yPosition + 9);
    currentX += columnWidths[index];
  });
  doc.setTextColor(0, 0, 0); // Reset to black text for content
  
  // Horizontal line after header tipis
  doc.setLineWidth(0.2);
  doc.line(margin, yPosition + headerHeight, margin + finalTableWidth, yPosition + headerHeight);
  
  yPosition += headerHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8); // 8pt font untuk content sesuai ReportLab professional standard
  
  // CRITICAL: Check if we need a new page BEFORE starting to render any rows
  const estimatedTableHeight = (scheduledEmployees.length + 1) * rowHeight + 20;
  if (yPosition + estimatedTableHeight > doc.internal.pageSize.height - bottomMargin) {
    addProfessionalFooter(doc, doc.internal.pageSize.width, doc.internal.pageSize.height, margin, 1);
    doc.addPage();
    
    // Professional header for new page
    yPosition = addProfessionalHeader(doc, margin, shiftName);
    
    // Redraw table header with professional styling
    yPosition = redrawTableHeader(doc, headers, columnWidths, finalTableWidth, margin, yPosition, headerHeight);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10); // Professional font size
    
  }

  // Process ALL scheduled employees (both attended and not attended)
  scheduledEmployees.forEach((rosterRecord, rowIndex) => {
    // Find attendance record for this employee (if exists)
    const attendanceRecord = data.attendance.find(att => att.employeeId === rosterRecord.employeeId);
    const employee = data.employees.find(emp => emp.id === rosterRecord.employeeId);
    
    if (!employee) return;
    
    // Get work days from roster data
    const workDaysText = rosterRecord.hariKerja || '-';
    
    // Prepare row data - show ALL scheduled employees with their attendance status (ReportLab style with icons)
    const jamTidur = attendanceRecord?.jamTidur || '-';
    const fitToWorkStatus = attendanceRecord?.fitToWork || 'Not Fit To Work';
    const attendanceStatus = attendanceRecord ? '✅ Hadir' : '❌ Tidak Hadir'; // Icons like ReportLab example
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
    
    // Professional alternating row colors (ReportLab whitesmoke standard)
    if (rowIndex % 2 === 1) { // Alternating rows dengan professional styling
      doc.setFillColor(245, 245, 245); // Whitesmoke sesuai ReportLab example
      doc.rect(margin, yPosition, finalTableWidth, rowHeight, 'F');
    }
    
    // Draw row data with proper alignment
    let currentX = margin;
    rowData.forEach((cellData, columnIndex) => {
      const cellText = String(cellData);
      
      if (columnIndex === 0 || columnIndex === 5) {
        // Name and Nomor Lambung columns - left aligned (ReportLab style)
        doc.text(cellText, currentX + 3, yPosition + 7.5);
      } else {
        // All other columns - center aligned (ReportLab style)
        const textWidth = doc.getTextWidth(cellText);
        const centerX = currentX + (columnWidths[columnIndex] - textWidth) / 2;
        doc.text(cellText, centerX, yPosition + 7.5);
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
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  doc.line(margin, yPosition + 2, margin + finalTableWidth, yPosition + 2);
  yPosition += 8; // Reduced spacing after table
  
  // Shift summary - teks lebih kecil dari isi tabel
  doc.setFontSize(9); // Smaller than table content (10pt)
  doc.setFont('helvetica', 'normal');
  
  const attendedCount = scheduledEmployees.filter(scheduleRecord => {
    return data.attendance.some(attendance => attendance.employeeId === scheduleRecord.employeeId);
  }).length;
  const scheduledCount = scheduledEmployees.length;
  const absentCount = scheduledCount - attendedCount;
  
  const summaryText = `Ringkasan ${shiftName}: Dijadwalkan: ${scheduledCount} | Hadir: ${attendedCount} | Tidak Hadir: ${absentCount}`;
  doc.text(summaryText, margin, yPosition);
  
  return yPosition + 15; // Reduced spacing after shift section
}


function formatDateForPDF(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`; // dd-mm-yyyy format as requested
}

// Enhanced professional footer dengan styling seperti ReportLab custom footer
function addProfessionalFooter(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number, pageNumber?: number): void {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  
  // Footer positioning sesuai ReportLab (1cm from bottom)
  const footerY = pageHeight - 10; // Lebih dekat ke bottom edge
  doc.setFontSize(8); // 8pt untuk footer text
  doc.setFont('helvetica', 'normal');
  
  // Combined text seperti ReportLab: "Halaman X | Dicetak: date time"
  const pageText = pageNumber ? `Halaman ${pageNumber}` : '';
  const timestampText = `Dicetak: ${day}-${month}-${year} ${hours}:${minutes}`;
  const fullFooterText = pageNumber ? `${pageText} | ${timestampText}` : timestampText;
  
  // Right-aligned footer text seperti ReportLab example
  doc.text(fullFooterText, pageWidth - margin, footerY, { align: 'right' });
}

// Professional header untuk halaman baru
function addProfessionalHeader(doc: jsPDF, margin: number, shiftName: string): number {
  let yPosition = margin;
  
  // Add company logo
  try {
    doc.addImage(companyLogo, 'PNG', margin, yPosition, 30, 15);
  } catch (error) {
    console.warn('Could not add logo to new page:', error);
  }
  
  yPosition += 25;
  
  // Shift title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(shiftName.toUpperCase(), margin, yPosition);
  yPosition += 10;
  
  return yPosition;
}

// Redraw table header untuk halaman baru
function redrawTableHeader(doc: jsPDF, headers: string[], columnWidths: number[], finalTableWidth: number, margin: number, yPosition: number, headerHeight: number): number {
  // Professional header background (ReportLab grey standard)
  doc.setFillColor(128, 128, 128);
  doc.rect(margin, yPosition, finalTableWidth, headerHeight, 'F');
  
  // Table border
  doc.setLineWidth(0.2);
  doc.rect(margin, yPosition, finalTableWidth, headerHeight);
  
  // Vertical lines
  let currentX = margin;
  headers.forEach((header, index) => {
    if (index > 0) {
      doc.line(currentX, yPosition, currentX, yPosition + headerHeight);
    }
    
    // Professional header text dengan consistent font sizing
    const textWidth = doc.getTextWidth(header);
    const centerX = currentX + (columnWidths[index] - textWidth) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9); // 9pt untuk table headers sesuai ReportLab
    doc.setTextColor(255, 255, 255); // White text pada grey background
    doc.text(header, centerX, yPosition + 9);
    doc.setTextColor(0, 0, 0); // Reset to black
    
    currentX += columnWidths[index];
  });
  
  // Right border
  doc.line(currentX, yPosition, currentX, yPosition + headerHeight);
  
  return yPosition + headerHeight;
}

// Function khusus untuk A4 Portrait dengan layout yang diminta user
async function generateA4PortraitPDF(data: ReportData): Promise<void> {
  const doc = new jsPDF('portrait', 'pt', 'a4'); // Use points for precise measurements
  const pageWidth = doc.internal.pageSize.width; // 595.28 pt
  const pageHeight = doc.internal.pageSize.height; // 841.89 pt
  const margin = 40; // 40pt margins untuk A4 portrait
  const bottomMargin = 60; // Space untuk footer
  
  let yPosition = margin;
  let pageNumber = 1;
  
  // Judul Laporan - Teks besar, bold, rata tengah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16); // Lebih besar untuk judul utama
  const title = 'FORMULIR PEMANTAUAN PERIODE KERJA KONTRAKTOR HAULING';
  const titleWidth = doc.getTextWidth(title);
  const titleX = (pageWidth - titleWidth) / 2;
  doc.text(title, titleX, yPosition + 20);
  yPosition += 35;
  
  // Garis tipis horizontal di bawah judul
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 25;
  
  // Bagian Informasi & Tanda Tangan (dua kolom: 60% dan 40%)
  const leftColumnWidth = (pageWidth - 2 * margin) * 0.6; // 60% lebar
  const rightColumnWidth = (pageWidth - 2 * margin) * 0.4; // 40% lebar
  const rightColumnX = margin + leftColumnWidth + 20; // 20pt spacing between columns
  
  // Kolom kiri - Informasi
  const leftX = margin + 10;
  let leftY = yPosition;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  
  const infoFields = [
    `Perusahaan : ${data.reportInfo?.perusahaan || ''}`,
    `Nama Pengawas : ${data.reportInfo?.namaPengawas || ''}`,
    `Hari/Tanggal/Waktu : ${data.reportInfo?.hari || ''}, ${formatDateForPDF(data.startDate)} / ${data.reportInfo?.waktu || ''}`,
    `Shift : ${data.reportInfo?.shift || ''}`,
    `Tempat : ${data.reportInfo?.tempat || ''}`
  ];
  
  infoFields.forEach(field => {
    doc.text(field, leftX, leftY);
    leftY += 18;
  });
  
  // Kolom kanan - Kotak tanda tangan dengan border tipis
  const signBoxHeight = 80;
  const signBoxY = yPosition;
  
  // Draw border kotak tanda tangan
  doc.setLineWidth(0.5);
  doc.rect(rightColumnX, signBoxY - 10, rightColumnWidth - 20, signBoxHeight);
  
  // Judul "Diperiksa Oleh," rata tengah atas
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const checkText = 'Diperiksa Oleh,';
  const checkTextWidth = doc.getTextWidth(checkText);
  const checkTextX = rightColumnX + (rightColumnWidth - 20 - checkTextWidth) / 2;
  doc.text(checkText, checkTextX, signBoxY + 5);
  
  // Garis tanda tangan rata tengah di bagian bawah kotak
  const signLineY = signBoxY + signBoxHeight - 25;
  const signLineX1 = rightColumnX + 15;
  const signLineX2 = rightColumnX + rightColumnWidth - 35;
  doc.line(signLineX1, signLineY, signLineX2, signLineY);
  
  // Nama pemeriksa tepat di bawah garis, posisi center
  const nameText = data.reportInfo?.diperiksaOleh || '';
  if (nameText) {
    const nameWidth = doc.getTextWidth(nameText);
    const nameX = rightColumnX + (rightColumnWidth - 20 - nameWidth) / 2;
    doc.text(nameText, nameX, signLineY + 15);
  }
  
  yPosition = Math.max(leftY, signBoxY + signBoxHeight) + 20;
  
  // Tanggal laporan rata tengah
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const reportDate = `Tanggal: ${formatDateForPDF(data.startDate)}`;
  const dateWidth = doc.getTextWidth(reportDate);
  const dateX = (pageWidth - dateWidth) / 2;
  doc.text(reportDate, dateX, yPosition);
  yPosition += 25;
  
  // Generate tabel dengan proporsi kolom yang tepat
  await generateA4PortraitTable(doc, data, yPosition, margin, pageWidth, pageHeight, bottomMargin, pageNumber);
  
  // Save PDF
  const fileName = `laporan-attendance-${formatDateForPDF(data.startDate)}-A4.pdf`;
  doc.save(fileName);
}

// Function untuk generate tabel khusus A4 Portrait
async function generateA4PortraitTable(
  doc: jsPDF, 
  data: ReportData, 
  startY: number, 
  margin: number, 
  pageWidth: number, 
  pageHeight: number, 
  bottomMargin: number,
  initialPageNumber: number
): Promise<void> {
  
  let yPosition = startY;
  let pageNumber = initialPageNumber;
  
  // Proporsi kolom sesuai spesifikasi: total 100%
  const tableWidth = pageWidth - 2 * margin;
  const columnProportions = [0.20, 0.12, 0.08, 0.10, 0.12, 0.12, 0.08, 0.10, 0.08]; // Total = 1.00
  const columnWidths = columnProportions.map(prop => tableWidth * prop);
  
  const headers = ['Nama', 'NIK', 'Shift', 'Hari Kerja', 'Jam Masuk', 'Nomor Lambung', 'Jam Tidur', 'Fit To Work', 'Status'];
  const rowHeight = 25;
  const headerHeight = 30;
  
  // Function untuk draw header tabel (hanya sekali per halaman)
  const drawTableHeader = (yPos: number) => {
    // Background abu-abu muda untuk header
    doc.setFillColor(220, 220, 220);
    doc.rect(margin, yPos, tableWidth, headerHeight, 'F');
    
    // Border header
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos, tableWidth, headerHeight);
    
    // Header text bold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    let currentX = margin;
    headers.forEach((header, index) => {
      // Vertical lines between columns
      if (index > 0) {
        doc.line(currentX, yPos, currentX, yPos + headerHeight);
      }
      
      // Header text centered
      const textWidth = doc.getTextWidth(header);
      const centerX = currentX + (columnWidths[index] - textWidth) / 2;
      doc.text(header, centerX, yPos + headerHeight / 2 + 3);
      
      currentX += columnWidths[index];
    });
    
    return yPos + headerHeight;
  };
  
  // Function untuk add footer dengan page numbering
  const addA4Footer = (pageNum: number) => {
    const footerY = pageHeight - 30;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    // Page number rata kanan
    const pageText = `Halaman ${pageNum}`;
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - margin - pageTextWidth, footerY);
    
    // Timestamp
    const now = new Date();
    const timestamp = `Dicetak: ${formatDateForPDF(now.toISOString().split('T')[0])} ${now.toTimeString().split(' ')[0].substring(0,5)}`;
    doc.text(timestamp, margin, footerY);
  };
  
  // Generate shift sections
  const shifts = data.shiftFilter === 'all' ? ['Shift 1', 'Shift 2'] : [data.shiftFilter || 'Shift 1'];
  
  for (const shift of shifts) {
    const shiftEmployees = getShiftEmployees(data, shift);
    
    if (shiftEmployees.length === 0) continue;
    
    // Check space untuk shift title + minimal 3 rows
    const neededSpace = 40 + headerHeight + (3 * rowHeight);
    if (yPosition + neededSpace > pageHeight - bottomMargin) {
      addA4Footer(pageNumber);
      doc.addPage();
      pageNumber++;
      yPosition = margin + 30; // Reset position pada halaman baru
    }
    
    // Shift title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const shiftTitle = shift.toUpperCase();
    const shiftTitleWidth = doc.getTextWidth(shiftTitle);
    const shiftTitleX = (pageWidth - shiftTitleWidth) / 2;
    doc.text(shiftTitle, shiftTitleX, yPosition);
    yPosition += 25;
    
    // Draw table header
    yPosition = drawTableHeader(yPosition);
    
    // Table content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    shiftEmployees.forEach((employee, rowIndex) => {
      // Check jika perlu halaman baru
      if (yPosition + rowHeight > pageHeight - bottomMargin) {
        addA4Footer(pageNumber);
        doc.addPage();
        pageNumber++;
        yPosition = margin + 30;
        yPosition = drawTableHeader(yPosition); // Redraw header di halaman baru
      }
      
      // Alternating row background
      if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, yPosition, tableWidth, rowHeight, 'F');
      }
      
      // Row border
      doc.setLineWidth(0.3);
      doc.rect(margin, yPosition, tableWidth, rowHeight);
      
      // Row data
      const attendance = data.attendance.find(a => a.employeeId === employee.id);
      const attendanceStatus = attendance ? '✅ Hadir' : '❌ Tidak Hadir';
      const jamTidur = attendance?.jamTidur || '-';
      const fitToWork = attendance?.fitToWork || '-';
      const jamMasuk = attendance?.time || '-';
      
      const rowData = [
        employee.name,
        employee.id,
        shift === 'Shift 1' ? '1' : '2',
        employee.workDays?.toString() || '-',
        jamMasuk,
        employee.nomorLambung || '-',
        jamTidur,
        fitToWork,
        attendanceStatus
      ];
      
      let currentX = margin;
      rowData.forEach((cellData, columnIndex) => {
        // Vertical lines
        if (columnIndex > 0) {
          doc.line(currentX, yPosition, currentX, yPosition + rowHeight);
        }
        
        // Text alignment: Nama rata kiri, sisanya rata tengah
        if (columnIndex === 0) { // Nama kolom
          doc.text(cellData, currentX + 5, yPosition + rowHeight / 2 + 3);
        } else { // Sisanya rata tengah
          const textWidth = doc.getTextWidth(cellData);
          const centerX = currentX + (columnWidths[columnIndex] - textWidth) / 2;
          doc.text(cellData, centerX, yPosition + rowHeight / 2 + 3);
        }
        
        currentX += columnWidths[columnIndex];
      });
      
      yPosition += rowHeight;
    });
    
    yPosition += 20; // Space between shifts
  }
  
  // Add footer ke halaman terakhir
  addA4Footer(pageNumber);
}

// Helper function untuk get shift employees
function getShiftEmployees(data: ReportData, shift: string): any[] {
  // Get scheduled employees for this shift first (from roster)
  const scheduledEmployees = data.roster?.filter(r => r.shift === shift && r.date === data.startDate) || [];
  
  // For SHIFT 1: show all attendance, For SHIFT 2: show only if there's actual Shift 2 roster data
  let attendanceForThisShift: typeof data.attendance;
  
  if (shift.toUpperCase() === 'SHIFT 1') {
    // For Shift 1 section: Include ALL attendance records for this date
    attendanceForThisShift = data.attendance.filter(att => att.date === data.startDate);
  } else {
    // For Shift 2 section: Only show if employee is actually scheduled for Shift 2
    attendanceForThisShift = data.attendance.filter(att => {
      if (att.date !== data.startDate) return false;
      const employeeRoster = data.roster?.find(r => r.employeeId === att.employeeId && r.date === data.startDate && r.shift === 'Shift 2');
      return !!employeeRoster;
    });
  }
  
  // Add all attendance records as roster entries for this shift
  attendanceForThisShift.forEach(att => {
    const employee = data.employees.find(emp => emp.id === att.employeeId);
    
    if (employee) {
      // Check if employee already exists in scheduledEmployees
      const existingIndex = scheduledEmployees.findIndex(emp => emp.employeeId === att.employeeId);
      
      if (existingIndex >= 0) {
        // Update existing roster entry with attendance data
        scheduledEmployees[existingIndex] = {
          ...scheduledEmployees[existingIndex],
          jamTidur: att.jamTidur || '',
          fitToWork: att.fitToWork || 'Fit To Work'
        };
      } else {
        // Add new roster entry for attendance - get hariKerja from any roster for this employee
        const anyRosterRecord = data.roster?.find(r => r.employeeId === att.employeeId);
        
        const tempRoster = {
          id: `temp-${att.employeeId}`,
          employeeId: att.employeeId,
          date: data.startDate,
          shift: shift,
          startTime: shift === 'Shift 1' ? '06:00' : '18:00',
          endTime: shift === 'Shift 1' ? '18:00' : '06:00',
          jamTidur: att.jamTidur || '',
          fitToWork: att.fitToWork || 'Fit To Work',
          hariKerja: anyRosterRecord?.hariKerja || '',
          status: 'scheduled'
        } as any;
        
        // Add extra properties for processing
        (tempRoster as any).employee = employee;
        (tempRoster as any).workDays = (anyRosterRecord as any)?.workDays || parseInt(anyRosterRecord?.hariKerja || '0', 10);
        
        scheduledEmployees.push(tempRoster);
      }
    }
  });
  
  // Convert to simple employee objects with enhanced data
  return scheduledEmployees.map(roster => {
    const employee = (roster as any).employee || data.employees.find(e => e.id === roster.employeeId);
    const workDays = (roster as any).workDays || parseInt(roster.hariKerja || '0', 10);
    
    return {
      id: roster.employeeId,
      name: employee?.name || 'Unknown',
      nomorLambung: employee?.nomorLambung || '-',
      workDays: workDays
    };
  });
}
