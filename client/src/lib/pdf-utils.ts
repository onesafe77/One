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
  tandaTangan: File | string | null;
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

// Helper function to properly capitalize names
function capitalizeNames(text: string): string {
  if (!text) return text;
  return text.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

export async function generateAttendancePDF(data: ReportData): Promise<void> {
  try {
    console.log('🔥 DEBUGGING: Starting PDF generation...', {
      orientation: data.orientation,
      defaultOrientation: data.orientation || 'landscape',
      hasReportInfo: !!data.reportInfo,
      reportInfo: data.reportInfo
    });
    
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
      
      // Information box dengan styling professional - adjusted for 10x6cm signature box
      const infoBoxY = yPosition;
      const infoBoxHeight = 75; // Height in mm to accommodate 6cm signature box + padding
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
      // Use sans-serif font and proper capitalization
      doc.setFont('helvetica', 'normal'); // Helvetica is sans-serif
      const supervisorName = capitalizeNames(data.reportInfo.namaPengawas || 'Pengawas');
      doc.text(supervisorName, leftX + labelWidth + 5, leftY);
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
      
      // Add Catatan with proper wrapping and fallback
      if (data.reportInfo?.catatan && data.reportInfo.catatan.trim()) {
        doc.text('Catatan', leftX, leftY);
        doc.text(':', leftX + labelWidth, leftY);
        
        // Professional signature box is 10x6 cm (100x60 mm) with proper spacing
        const sigBoxWidth = 100; // 10 cm in mm
        const maxCatatanWidth = pageWidth - 2 * margin - sigBoxWidth - labelWidth - 15; // Conservative margin in mm
        
        let catatanText = data.reportInfo.catatan;
        // Check if text appears to be meaningful content
        const isGibberish = /^([a-zA-Z])\1{4,}/.test(catatanText) || // Repeated chars like "asdasdasd"
                           catatanText.length > 300 || // Excessively long
                           !/[aeiouAEIOU]/.test(catatanText.replace(/\s/g, '')); // No vowels (likely keyboard mashing)
        
        if (isGibberish) {
          catatanText = '[Isi catatan di sini]';
        }
        
        // Split text with proper wrapping
        const catatanLines = doc.splitTextToSize(catatanText, maxCatatanWidth);
        doc.text(catatanLines, leftX + labelWidth + 5, leftY);
      } else {
        // Add placeholder if no catatan
        doc.text('Catatan', leftX, leftY);
        doc.text(':', leftX + labelWidth, leftY);
        doc.text('[Isi catatan di sini]', leftX + labelWidth + 5, leftY);
      }
      
      console.log('🔥 DEBUGGING: About to create signature box...', {
        sigBoxWidth: 100,
        sigBoxHeight: 60,
        pageWidth,
        margin
      });
      
      // Professional signature box - 10x6 cm (100x60 mm) positioned at right
      const sigBoxWidth = 100; // 10 cm in mm
      const sigBoxHeight = 60; // 6 cm in mm
      const sigBoxX = pageWidth - margin - sigBoxWidth; // Right-aligned
      const sigBoxY = infoBoxY + 5;
      
      // Draw signature box border with 1px equivalent thickness
      doc.setLineWidth(0.35); // ~1px equivalent in mm
      doc.setDrawColor(0, 0, 0); // Pure black for crisp lines
      doc.rect(sigBoxX, sigBoxY, sigBoxWidth, sigBoxHeight);
      
      // Layout kotak tanda tangan profesional sesuai format yang diminta
      doc.setFont('helvetica', 'normal'); // Clean sans-serif font
      doc.setTextColor(0, 0, 0); // Pure black for crisp text
      
      // 1. Bagian atas: "Diperiksa Oleh," rata tengah
      doc.setFontSize(11);
      const signatureText = 'Diperiksa Oleh,';
      const signatureTextWidth = doc.getTextWidth(signatureText);
      doc.text(signatureText, sigBoxX + (sigBoxWidth - signatureTextWidth) / 2, sigBoxY + 12);
      
      // 2. Bagian tengah: Tanda tangan digital rapi (lebih tebal agar terlihat)
      doc.setLineWidth(0.8); // Garis lebih tebal agar terlihat jelas
      doc.setDrawColor(0, 0, 0); // Pure black untuk kontras
      
      const sigCenterX = sigBoxX + sigBoxWidth / 2;
      const sigCenterY = sigBoxY + 28; // Sedikit lebih tinggi dari tengah
      
      console.log(`Drawing signature at center: (${sigCenterX}, ${sigCenterY})`);
      
      // Main signature stroke - simple tapi jelas terlihat
      doc.line(sigCenterX - 25, sigCenterY, sigCenterX - 15, sigCenterY - 4);
      doc.line(sigCenterX - 15, sigCenterY - 4, sigCenterX - 5, sigCenterY + 2);
      doc.line(sigCenterX - 5, sigCenterY + 2, sigCenterX + 5, sigCenterY - 1);
      doc.line(sigCenterX + 5, sigCenterY - 1, sigCenterX + 15, sigCenterY + 3);
      doc.line(sigCenterX + 15, sigCenterY + 3, sigCenterX + 25, sigCenterY);
      
      // Flourish bawah
      doc.setLineWidth(0.6);
      doc.line(sigCenterX - 18, sigCenterY + 5, sigCenterX - 8, sigCenterY + 8);
      doc.line(sigCenterX - 8, sigCenterY + 8, sigCenterX + 8, sigCenterY + 5);
      doc.line(sigCenterX + 8, sigCenterY + 5, sigCenterX + 18, sigCenterY + 8);
      
      // 3. Nama tepat di atas garis horizontal (bagian bawah)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11); // Sedikit lebih besar agar terlihat
      doc.setTextColor(0, 0, 0); // Pastikan warna hitam
      
      const nameText = data.reportInfo.diperiksaOleh || capitalizeNames(data.reportInfo.namaPengawas || 'Pengawas');
      const nameInParentheses = `(${nameText})`;
      const nameWidth = doc.getTextWidth(nameInParentheses);
      const nameCenterX = sigBoxX + (sigBoxWidth - nameWidth) / 2;
      
      // Position nama tepat di atas garis - lebih tinggi agar terlihat
      const nameY = sigBoxY + sigBoxHeight - 18; // 18mm dari bawah kotak
      console.log(`Drawing name "${nameInParentheses}" at: (${nameCenterX}, ${nameY})`);
      doc.text(nameInParentheses, nameCenterX, nameY);
      
      // 4. Garis horizontal di bawah nama - lebih tebal agar terlihat
      const lineY = nameY + 6; // 6mm di bawah nama
      const lineMargin = 10; // mm from box edges
      doc.setLineWidth(0.8); // Lebih tebal agar terlihat jelas
      doc.setDrawColor(0, 0, 0); // Pure black
      console.log(`Drawing horizontal line from (${sigBoxX + lineMargin}, ${lineY}) to (${sigBoxX + sigBoxWidth - lineMargin}, ${lineY})`);
      doc.line(sigBoxX + lineMargin, lineY, sigBoxX + sigBoxWidth - lineMargin, lineY);
      
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
  
  // FIXED: Ambil SEMUA employee yang dijadwalkan di roster untuk tanggal dan shift ini
  // Terlepas apakah mereka hadir atau tidak - sesuai permintaan user
  const scheduledEmployees = data.roster?.filter(r => r.shift === shiftName && r.date === data.startDate) || [];
  
  console.log(`📊 ROSTER ${shiftName}: Found ${scheduledEmployees.length} scheduled employees for ${data.startDate}`);
  
  // Untuk setiap employee yang dijadwalkan, cek apakah mereka hadir dan update datanya
  scheduledEmployees.forEach((rosterRecord, index) => {
    const employee = data.employees.find(emp => emp.id === rosterRecord.employeeId);
    const attendanceRecord = data.attendance.find(att => att.employeeId === rosterRecord.employeeId && att.date === data.startDate);
    
    if (employee) {
      // Update roster record dengan data attendance jika ada
      if (attendanceRecord) {
        scheduledEmployees[index] = {
          ...rosterRecord,
          jamTidur: attendanceRecord.jamTidur || '',
          fitToWork: attendanceRecord.fitToWork || 'Fit To Work',
          status: 'present',
          // CRITICAL: Tetap gunakan hariKerja dari roster asli
          hariKerja: rosterRecord.hariKerja
        };
      } else {
        // Employee tidak hadir, tetap tampilkan dengan status absent
        scheduledEmployees[index] = {
          ...rosterRecord,
          jamTidur: '',
          fitToWork: 'Fit To Work',
          status: 'absent',
          // CRITICAL: Tetap gunakan hariKerja dari roster asli
          hariKerja: rosterRecord.hariKerja
        };
      }
      
      // Add employee data to roster record
      scheduledEmployees[index].employee = employee;
      
      // DEBUG untuk employee dengan hari kerja
      if (rosterRecord.hariKerja) {
        console.log(`📅 ${employee.name}: tanggal=${data.startDate}, shift=${shiftName}, hariKerja=${rosterRecord.hariKerja}, status=${scheduledEmployees[index].status}`);
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
    
    // FIXED: Ambil data hari kerja LANGSUNG dari roster database untuk tanggal dan shift ini
    // Cari data roster yang EXACT match dengan tanggal dan shift yang dilaporkan
    const exactRosterData = data.roster?.find(r => 
      r.employeeId === employee.id && 
      r.date === data.startDate && 
      r.shift === shiftName
    );
    
    let workDaysText = '-';
    if (exactRosterData?.hariKerja !== null && exactRosterData?.hariKerja !== undefined && exactRosterData?.hariKerja !== '') {
      // Convert to string and handle both numeric and string values
      const hariKerjaStr = String(exactRosterData.hariKerja).trim();
      if (hariKerjaStr && hariKerjaStr !== '0' && hariKerjaStr !== 'null' && hariKerjaStr !== 'undefined') {
        workDaysText = hariKerjaStr;
      }
    }
    
    // DEBUG untuk semua employee yang memiliki hari kerja
    if (exactRosterData?.hariKerja) {
      console.log(`📅 ${employee.name}: tanggal=${data.startDate}, shift=${shiftName}, hariKerja=${exactRosterData.hariKerja} → ${workDaysText}`);
    }
    
    
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

// Helper function untuk text wrapping
function splitTextToFitWidth(doc: jsPDF, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const testWidth = doc.getTextWidth(testLine);
    
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Single word terlalu panjang, force break
        lines.push(word);
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.length > 0 ? lines : [text];
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
  const margin = 15; // 0.5cm margin minimal mendekati batas A4 (15pt ≈ 0.5cm)
  const bottomMargin = 60; // Space untuk footer
  
  let yPosition = margin;
  let pageNumber = 1;
  
  // Kotak header professional dengan border - diperbesar untuk tampilan lebih lapang
  const headerBoxHeight = 180;
  doc.setLineWidth(0.8);
  doc.setDrawColor(100, 100, 100);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, headerBoxHeight);
  
  yPosition += 15; // Padding dalam kotak header
  
  // Judul Laporan - Teks besar, bold, rata tengah dengan styling lebih baik
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15); // Sedikit dikurangi agar pas dalam kotak
  const title = 'FORMULIR PEMANTAUAN PERIODE KERJA KONTRAKTOR HAULING';
  const titleWidth = doc.getTextWidth(title);
  const titleX = (pageWidth - titleWidth) / 2;
  doc.text(title, titleX, yPosition + 18);
  yPosition += 30;
  
  // Garis tipis horizontal di bawah judul (dalam kotak)
  doc.setLineWidth(0.3);
  doc.setDrawColor(150, 150, 150);
  doc.line(margin + 10, yPosition, pageWidth - margin - 10, yPosition);
  yPosition += 20;
  
  // Bagian Informasi & Tanda Tangan (rebalanced: 58% dan 42% untuk proporsi lebih baik)
  const leftColumnWidth = (pageWidth - 2 * margin) * 0.58; // 58% lebar untuk info
  const rightColumnWidth = (pageWidth - 2 * margin) * 0.42; // 42% lebar untuk signature (diperlebar)
  const rightColumnX = margin + leftColumnWidth + 15; // 15pt spacing between columns
  
  // Kolom kiri - Informasi
  const leftX = margin + 10;
  let leftY = yPosition;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  
  const infoFields = [
    `Perusahaan : ${data.reportInfo?.perusahaan || 'PT Goden Energi Cemerlang Lestari'}`,
    `Nama Pengawas : ${data.reportInfo?.namaPengawas || 'BUDI HARTO DAN FADLAN'}`,
    `Hari/Tanggal/Waktu : ${data.reportInfo?.hari || 'Rabu'}, ${formatDateForPDF(data.startDate)} / ${data.reportInfo?.waktu || '17:00-18:00'}`,
    `Shift : ${data.reportInfo?.shift || 'Shift 1'}`,
    `Tempat : ${data.reportInfo?.tempat || 'Titik Kumpul WS GECL'}`
  ];
  
  // Tambahkan catatan jika ada
  if (data.reportInfo?.catatan && data.reportInfo.catatan.trim()) {
    infoFields.push(`Catatan : ${data.reportInfo.catatan}`);
  }
  
  infoFields.forEach(field => {
    doc.text(field, leftX, leftY);
    leftY += 18;
  });
  
  // Kolom kanan - Kotak tanda tangan dengan border tipis (diperbesar untuk gambar)
  const signBoxHeight = 110; // Diperbesar dari 80pt ke 110pt untuk ruang gambar
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
  
  // 🎯 FIXED: Always draw signature components unconditionally (Portrait Mode)
  console.log('🔥 Drawing portrait signature unconditionally...');
  
  try {
    // Validate all geometric values before proceeding
    if (!Number.isFinite(rightColumnX) || !Number.isFinite(rightColumnWidth) || !Number.isFinite(signBoxY) || 
        rightColumnX < 0 || rightColumnWidth <= 20 || signBoxY < 0) {
      console.warn('Portrait signature skipped: Invalid dimensions', { rightColumnX, rightColumnWidth, signBoxY });
      return;
    }

    // Setup clean typography and colors
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0); // Pure black
    
    // 2. Signature graphics in center - PRIORITIZE uploaded image over vector
    const sigCenterX = rightColumnX + (rightColumnWidth - 20) / 2;
    const sigCenterY = signBoxY + 35;
    
    console.log(`🔥 Drawing signature at: (${sigCenterX}, ${sigCenterY})`);
    
    // Check if there's an uploaded signature image (base64)
    if (data.reportInfo?.tandaTangan && typeof data.reportInfo.tandaTangan === 'string' && 
        data.reportInfo.tandaTangan.startsWith('data:image/')) {
      
      try {
        console.log('📸 Using uploaded signature image...');
        
        // Calculate signature image dimensions (fit in available space)
        const maxSignWidth = 80; // Max width in PDF units
        const maxSignHeight = 30; // Max height in PDF units
        
        const signImageX = sigCenterX - maxSignWidth / 2;
        const signImageY = sigCenterY - maxSignHeight / 2;
        
        // Add the uploaded signature image
        doc.addImage(
          data.reportInfo.tandaTangan,
          'JPEG',
          signImageX,
          signImageY,
          maxSignWidth,
          maxSignHeight
        );
        
        console.log(`✅ Uploaded signature image added at: (${signImageX}, ${signImageY})`);
        
      } catch (imageError) {
        console.error('Error adding uploaded signature image:', imageError);
        
        // Fall back to vector signature if image fails
        doc.setLineWidth(0.8);
        doc.setDrawColor(0, 0, 0);
        doc.line(sigCenterX - 20, sigCenterY, sigCenterX - 12, sigCenterY - 3);
        doc.line(sigCenterX - 12, sigCenterY - 3, sigCenterX - 4, sigCenterY + 1);
        doc.line(sigCenterX - 4, sigCenterY + 1, sigCenterX + 4, sigCenterY - 1);
        doc.line(sigCenterX + 4, sigCenterY - 1, sigCenterX + 12, sigCenterY + 2);
        doc.line(sigCenterX + 12, sigCenterY + 2, sigCenterX + 20, sigCenterY);
        
        console.log('⚠️ Using fallback vector signature due to image error');
      }
      
    } else {
      console.log('📝 No uploaded signature found, using vector signature...');
      
      // Fall back to professional vector signature
      doc.setLineWidth(0.8);
      doc.setDrawColor(0, 0, 0);
      doc.line(sigCenterX - 20, sigCenterY, sigCenterX - 12, sigCenterY - 3);
      doc.line(sigCenterX - 12, sigCenterY - 3, sigCenterX - 4, sigCenterY + 1);
      doc.line(sigCenterX - 4, sigCenterY + 1, sigCenterX + 4, sigCenterY - 1);
      doc.line(sigCenterX + 4, sigCenterY - 1, sigCenterX + 12, sigCenterY + 2);
      doc.line(sigCenterX + 12, sigCenterY + 2, sigCenterX + 20, sigCenterY);
      
      // Elegant flourish
      doc.setLineWidth(0.6);
      doc.line(sigCenterX - 15, sigCenterY + 4, sigCenterX - 6, sigCenterY + 6);
      doc.line(sigCenterX - 6, sigCenterY + 6, sigCenterX + 6, sigCenterY + 4);
      doc.line(sigCenterX + 6, sigCenterY + 4, sigCenterX + 15, sigCenterY + 6);
    }
    
    // 3. Name text - ALWAYS SHOW with fallback
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    
    // Use provided name or fallback to default
    const nameText = data.reportInfo?.diperiksaOleh?.trim() || 
                     data.reportInfo?.namaPengawas?.trim() || 
                     'Pengawas';
    const nameInParentheses = `(${nameText})`;
    const nameWidth = doc.getTextWidth(nameInParentheses);
    const nameCenterX = rightColumnX + ((rightColumnWidth - 20) - nameWidth) / 2;
    const nameY = signBoxY + signBoxHeight - 25;
    
    console.log(`🔥 Drawing name "${nameInParentheses}" at: (${nameCenterX}, ${nameY})`);
    doc.text(nameInParentheses, nameCenterX, nameY);
    
    // 4. Horizontal line - ALWAYS DRAW
    const lineY = nameY + 8;
    const lineMargin = 15;
    const lineStartX = rightColumnX + lineMargin;
    const lineEndX = rightColumnX + rightColumnWidth - 20 - lineMargin;
    
    doc.setLineWidth(0.8);
    doc.setDrawColor(0, 0, 0);
    console.log(`🔥 Drawing line from (${lineStartX}, ${lineY}) to (${lineEndX}, ${lineY})`);
    doc.line(lineStartX, lineY, lineEndX, lineY);
    
    console.log('✅ Portrait signature drawn successfully!');
    
  } catch (error) {
    console.error('Error drawing portrait signature:', error);
    // Draw fallback simple text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('(Tanda Tangan)', rightColumnX + 10, signBoxY + 40);
  }
  
  yPosition = Math.max(leftY, signBoxY + signBoxHeight) + 10;
  
  // Pastikan kita di luar kotak header
  if (yPosition < margin + headerBoxHeight + 10) {
    yPosition = margin + headerBoxHeight + 15;
  }
  
  // Tanggal laporan rata tengah dengan styling yang lebih baik
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
  
  // Proporsi kolom untuk area maksimal mendekati batas A4: total 100%
  const tableWidth = pageWidth - 2 * margin;
  const columnProportions = [0.17, 0.12, 0.06, 0.08, 0.12, 0.17, 0.07, 0.14, 0.07]; // Total = 1.00
  const columnWidths = columnProportions.map(prop => tableWidth * prop);
  
  const headers = ['Nama', 'NIK', 'Shift', 'Hari Kerja', 'Jam Masuk', 'Nomor Lambung', 'Jam Tidur', 'Fit To Work', 'Status'];
  const rowHeight = 28; // Row height untuk readability
  const headerHeight = 32; // Header height untuk wrap text
  
  // Function untuk draw header tabel (hanya sekali per halaman)
  const drawTableHeader = (yPos: number) => {
    // Background abu-abu muda untuk header
    doc.setFillColor(220, 220, 220);
    doc.rect(margin, yPos, tableWidth, headerHeight, 'F');
    
    // Border header
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos, tableWidth, headerHeight);
    
    // Header text bold dengan ukuran font sedikit lebih besar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    let currentX = margin;
    headers.forEach((header, index) => {
      // Vertical lines between columns
      if (index > 0) {
        doc.line(currentX, yPos, currentX, yPos + headerHeight);
      }
      
      // Header text centered dengan wrap untuk text panjang
      const cellWidth = columnWidths[index] - 6; // 3pt padding kiri-kanan
      const lines = splitTextToFitWidth(doc, header, cellWidth);
      
      const lineHeight = 11;
      const totalTextHeight = lines.length * lineHeight;
      const startY = yPos + (headerHeight - totalTextHeight) / 2 + lineHeight;
      
      lines.forEach((line, lineIndex) => {
        const textWidth = doc.getTextWidth(line);
        const centerX = currentX + (columnWidths[index] - textWidth) / 2;
        doc.text(line, centerX, startY + lineIndex * lineHeight);
      });
      
      currentX += columnWidths[index];
    });
    
    return yPos + headerHeight;
  };
  
  // Function untuk add footer dengan page numbering
  const addA4Footer = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 30;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    // Page number rata kanan format "Halaman X dari Y"
    const pageText = `Halaman ${pageNum}`;
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - margin - pageTextWidth, footerY);
    
    // Timestamp rata kiri
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
      addA4Footer(pageNumber, 0); // Total pages akan dihitung nanti
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
    
    // Table content dengan font sedikit lebih besar untuk readability
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    shiftEmployees.forEach((employee, rowIndex) => {
      // Check jika perlu halaman baru
      if (yPosition + rowHeight > pageHeight - bottomMargin) {
        addA4Footer(pageNumber, 0); // Total pages akan dihitung nanti
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
      const attendanceStatus = attendance ? 'Hadir' : 'Tidak Hadir'; // Tanpa emoji, hanya teks
      const jamTidur = attendance?.jamTidur || '-';
      const fitToWork = attendance?.fitToWork || '-';
      const jamMasuk = attendance?.time || '-';
      
      // Handle nilai negatif di Hari Kerja dengan strip (-)
      let hariKerjaValue = employee.workDays?.toString() || '-';
      if (employee.workDays && employee.workDays < 0) {
        hariKerjaValue = '-';
      }
      
      const rowData = [
        employee.name,
        employee.id,
        shift === 'Shift 1' ? '1' : '2',
        hariKerjaValue,
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
        
        // Text dengan wrapping untuk kolom yang mungkin panjang
        const cellWidth = columnWidths[columnIndex] - 6; // 3pt padding kiri-kanan
        const lines = splitTextToFitWidth(doc, cellData, cellWidth);
        
        const lineHeight = 10;
        const totalTextHeight = lines.length * lineHeight;
        const startY = yPosition + (rowHeight - totalTextHeight) / 2 + lineHeight;
        
        lines.forEach((line, lineIndex) => {
          if (columnIndex === 0) { // Nama kolom - rata kiri
            doc.text(line, currentX + 8, startY + lineIndex * lineHeight);
          } else { // Sisanya rata tengah
            const textWidth = doc.getTextWidth(line);
            const centerX = currentX + (columnWidths[columnIndex] - textWidth) / 2;
            doc.text(line, centerX, startY + lineIndex * lineHeight);
          }
        });
        
        currentX += columnWidths[columnIndex];
      });
      
      yPosition += rowHeight;
    });
    
    yPosition += 20; // Space between shifts
  }
  
  // Add footer ke halaman terakhir dengan total halaman yang benar
  const totalPages = pageNumber;
  
  // Update semua footer dengan total pages yang benar
  for (let i = 1; i <= totalPages; i++) {
    if (i < totalPages) {
      // Pindah ke halaman yang sesuai dan update footer
      // Note: Untuk implementasi sederhana, kita hanya update halaman terakhir
      // Idealnya perlu sistem yang lebih kompleks untuk update semua halaman
    }
  }
  
  addA4Footer(pageNumber, totalPages);
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
        // Update existing roster entry with attendance data - PRESERVE hariKerja dari roster asli!
        const originalHariKerja = scheduledEmployees[existingIndex].hariKerja;
        scheduledEmployees[existingIndex] = {
          ...scheduledEmployees[existingIndex],
          jamTidur: att.jamTidur || '',
          fitToWork: att.fitToWork || 'Fit To Work',
          // CRITICAL: Pertahankan hariKerja dari roster asli
          hariKerja: originalHariKerja
        };
        
        // SPECIAL DEBUG untuk WARSITO
        if (employee.name.includes('WARSITO')) {
          console.log('🔍 WARSITO UPDATE EXISTING ROSTER:', {
            employeeName: employee.name,
            originalHariKerja: originalHariKerja,
            preservedHariKerja: scheduledEmployees[existingIndex].hariKerja,
            updatedRecord: scheduledEmployees[existingIndex]
          });
        }
      } else {
        // Add new roster entry for attendance - get hariKerja with smart matching
        const sameDate = data.roster?.find(r => r.employeeId === att.employeeId && r.date === data.startDate);
        const anyDateSameEmployee = data.roster?.filter(r => r.employeeId === att.employeeId) || [];
        const mostRecentRecord = anyDateSameEmployee.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
        
        const bestRosterRecord = sameDate || mostRecentRecord;
        
        const tempRoster = {
          id: `temp-${att.employeeId}`,
          employeeId: att.employeeId,
          date: data.startDate,
          shift: shift,
          startTime: shift === 'Shift 1' ? '06:00' : '18:00',
          endTime: shift === 'Shift 1' ? '18:00' : '06:00',
          jamTidur: att.jamTidur || '',
          fitToWork: att.fitToWork || 'Fit To Work',
          hariKerja: bestRosterRecord?.hariKerja || '',
          status: 'scheduled'
        } as any;
        
        // Add extra properties for processing
        (tempRoster as any).employee = employee;
        (tempRoster as any).workDays = (bestRosterRecord as any)?.workDays || parseInt(bestRosterRecord?.hariKerja || '0', 10);
        
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
