import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Employee {
  id: string;
  name: string;
  position?: string;
  department?: string;
}

interface MeetingAttendance {
  id: string;
  meetingId: string;
  employeeId: string;
  scanTime: string;
  scanDate: string;
  deviceInfo?: string;
  employee?: Employee;
}

interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  organizer: string;
  status: string;
}

interface MeetingAttendanceData {
  meeting: Meeting;
  attendance: MeetingAttendance[];
  totalAttendees: number;
}

// Remove module declaration as we're importing autoTable directly

export function generateMeetingAttendancePDF(data: MeetingAttendanceData): void {
  console.log('Starting PDF generation with data:', {
    meeting: data.meeting.title,
    attendanceCount: data.attendance.length,
    totalAttendees: data.totalAttendees
  });

  try {
    // Validate data first
    if (!data || !data.meeting) {
      throw new Error('Data meeting tidak valid');
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    const currentDateTime = new Date();

    // ==================== MODERN HEADER SECTION ====================
    // Clean background with subtle shadow effect
    pdf.setFillColor(250, 250, 250);
    pdf.rect(0, 0, pageWidth, 50, 'F');
    
    // Company branding area - subtle
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text('PT. GECL - Sistem Manajemen Meeting', margin, 12);
    
    // Print timestamp - top right, modern styling
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Dicetak pada: ${currentDateTime.toLocaleDateString('id-ID')} ${currentDateTime.toLocaleTimeString('id-ID')}`, pageWidth - margin, 12, { align: 'right' });

    // Main title - MODERN & BOLD with shadow effect
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(220, 38, 38); // Modern red
    pdf.text('LAPORAN KEHADIRAN MEETING', pageWidth / 2, 32, { align: 'center' });

    // Elegant underline - single bold line
    pdf.setLineWidth(2);
    pdf.setDrawColor(220, 38, 38); // Modern red
    pdf.line(margin + 30, 37, pageWidth - margin - 30, 37);
    
    // Subtle accent line
    pdf.setLineWidth(0.5);
    pdf.setDrawColor(156, 163, 175); // Cool gray
    pdf.line(margin, 42, pageWidth - margin, 42);

    // ==================== MODERN INFORMATION CARD ====================
    let yPosition = 58;
    const cardHeight = 65;
    const cardMargin = margin + 5;
    const cardWidth = pageWidth - 2 * cardMargin;
    
    // Modern card with shadow effect
    pdf.setFillColor(248, 249, 250);
    pdf.rect(cardMargin, yPosition, cardWidth, cardHeight, 'F');
    
    // Subtle border with modern styling
    pdf.setLineWidth(0.8);
    pdf.setDrawColor(229, 231, 235);
    pdf.rect(cardMargin, yPosition, cardWidth, cardHeight, 'S');
    
    // Left accent line - modern red
    pdf.setLineWidth(4);
    pdf.setDrawColor(220, 38, 38);
    pdf.line(cardMargin, yPosition, cardMargin, yPosition + cardHeight);
    
    // Modern header section
    pdf.setFillColor(220, 38, 38);
    pdf.rect(cardMargin + 1, yPosition + 1, cardWidth - 2, 18, 'F');
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('INFORMASI MEETING', cardMargin + 10, yPosition + 12);
    
    // Content area with proper spacing
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(55, 65, 81);
    yPosition += 25;
    const lineHeight = 8;
    
    const meetingDate = new Date(data.meeting.date);
    
    // Compact 2-column layout
    const leftColX = cardMargin + 10;
    const rightColX = cardMargin + cardWidth / 2 + 5;
    
    // Left column - compact styling
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Judul Meeting', leftColX, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(31, 41, 55);
    pdf.text(data.meeting.title.length > 30 ? data.meeting.title.substring(0, 27) + '...' : data.meeting.title, leftColX, yPosition + 5);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Tanggal', leftColX, yPosition + lineHeight * 2);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(31, 41, 55);
    pdf.text(meetingDate.toLocaleDateString('id-ID'), leftColX, yPosition + lineHeight * 2 + 5);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Waktu', leftColX, yPosition + lineHeight * 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(31, 41, 55);
    pdf.text(`${data.meeting.startTime} - ${data.meeting.endTime}`, leftColX, yPosition + lineHeight * 4 + 5);
    
    // Right column
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Lokasi', rightColX, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(31, 41, 55);
    pdf.text(data.meeting.location, rightColX, yPosition + 5);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Penyelenggara', rightColX, yPosition + lineHeight * 2);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(31, 41, 55);
    pdf.text(data.meeting.organizer, rightColX, yPosition + lineHeight * 2 + 5);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Total Peserta Hadir', rightColX, yPosition + lineHeight * 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(220, 38, 38);
    pdf.text(`${data.totalAttendees} orang`, rightColX, yPosition + lineHeight * 4 + 5);

    yPosition += cardHeight + 18;

    // ==================== CLEAN TABLE SECTION ====================
    // Simple section header
    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 18, 'F');
    
    // Left accent line
    pdf.setLineWidth(3);
    pdf.setDrawColor(220, 38, 38);
    pdf.line(margin, yPosition - 5, margin, yPosition + 13);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(220, 38, 38);
    pdf.text('DAFTAR KEHADIRAN', margin + 8, yPosition + 6);
    
    // Compact participant count badge
    pdf.setFillColor(220, 38, 38);
    pdf.roundedRect(pageWidth - margin - 55, yPosition - 2, 45, 10, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${data.totalAttendees} Peserta`, pageWidth - margin - 52, yPosition + 3);
    
    yPosition += 20;

    if (data.attendance && data.attendance.length > 0) {
      const tableData = data.attendance.map((attendance, index) => [
        (index + 1).toString(), // Simple number format
        attendance.attendanceType === 'manual_entry' ? '-' : (attendance.employee?.id || '-'),
        attendance.attendanceType === 'manual_entry' ? attendance.manualName : (attendance.employee?.name || 'Unknown'),
        attendance.attendanceType === 'manual_entry' ? attendance.manualPosition : (attendance.employee?.position || '-'),
        attendance.attendanceType === 'manual_entry' ? attendance.manualDepartment : (attendance.employee?.department || '-'),
        new Date(attendance.scanDate).toLocaleDateString('id-ID'),
        attendance.scanTime ? `${attendance.scanTime} WITA` : '-' // Single line format
      ]);

      autoTable(pdf, {
        head: [['NO', 'NIK', 'Nama Karyawan', 'Position', 'Department', 'Tanggal', 'Waktu']],
        body: tableData,
        startY: yPosition,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 3,
          lineColor: [229, 231, 235],
          lineWidth: 0.3,
          font: 'helvetica',
          textColor: [55, 65, 81],
          minCellHeight: 12,
          valign: 'middle',
          overflow: 'hidden',
          halign: 'center' // Default alignment untuk semua cell
        },
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          cellPadding: 3,
          minCellHeight: 12,
          lineWidth: 0.5,
          lineColor: [180, 30, 30],
          overflow: 'hidden'
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', valign: 'middle' },  // NO
          1: { cellWidth: 20, halign: 'center', valign: 'middle' }, // NIK
          2: { cellWidth: 40, halign: 'left', valign: 'middle', cellPadding: { left: 2, right: 2 } },   // Nama Karyawan
          3: { cellWidth: 25, halign: 'left', valign: 'middle', cellPadding: { left: 2, right: 2 } },   // Position
          4: { cellWidth: 30, halign: 'left', valign: 'middle', cellPadding: { left: 2, right: 2 } },   // Department
          5: { cellWidth: 20, halign: 'center', valign: 'middle' }, // Tanggal
          6: { cellWidth: 25, halign: 'center', valign: 'middle' }  // Waktu
        },
        margin: { left: margin, right: margin },
        tableWidth: 172, // Total column width: 12+20+40+25+30+20+25 = 172
        showHead: 'everyPage'
      });
    } else {
      // Modern empty state message
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 30, 'F');
      pdf.setLineWidth(1);
      pdf.setDrawColor(229, 231, 235);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 30, 'S');
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(107, 114, 128);
      pdf.text('Belum ada peserta yang hadir pada meeting ini.', pageWidth / 2, yPosition + 18, { align: 'center' });
    }

    // ==================== MODERN FOOTER SECTION ====================
    const footerY = pageHeight - 40;
    
    // Clean footer background
    pdf.setFillColor(249, 250, 251);
    pdf.rect(0, footerY - 10, pageWidth, 50, 'F');
    
    // Elegant separator line
    pdf.setLineWidth(1);
    pdf.setDrawColor(220, 38, 38);
    pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    // Modern footer text - left aligned
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Laporan dibuat oleh Sistem Manajemen Meeting PT.GECL', margin, footerY + 5);
    
    // Print timestamp - right aligned as requested
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`Dicetak pada: ${currentDateTime.toLocaleDateString('id-ID')} ${currentDateTime.toLocaleTimeString('id-ID')}`, pageWidth - margin, footerY + 5, { align: 'right' });
    
    // Modern signature area - simplified and elegant
    const signatureX = pageWidth - 100;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(55, 65, 81);
    pdf.text('Mengetahui,', signatureX, footerY + 15);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Penyelenggara Meeting', signatureX, footerY + 22);
    
    // Clean signature line
    pdf.setLineWidth(0.8);
    pdf.setDrawColor(156, 163, 175);
    pdf.line(signatureX, footerY + 30, signatureX + 70, footerY + 30);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(55, 65, 81);
    pdf.text(`(${data.meeting.organizer})`, signatureX + 5, footerY + 37);

    // Generate professional filename
    const dateStr = meetingDate.toISOString().split('T')[0];
    const titleStr = (data.meeting.title || 'meeting').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filename = `Laporan-Kehadiran-Meeting-${titleStr}-${dateStr}.pdf`;

    console.log('PDF generation completed, saving as:', filename);
    pdf.save(filename);

  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw new Error(`Gagal membuat PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getMeetingStatusLabel(status: string): string {
  const statusLabels: { [key: string]: string } = {
    scheduled: 'Terjadwal',
    ongoing: 'Berlangsung',
    completed: 'Selesai',
    cancelled: 'Dibatalkan'
  };
  return statusLabels[status] || status;
}

function getShortDeviceInfo(deviceInfo: string): string {
  // Extract browser name and OS from user agent string
  if (deviceInfo.includes('Chrome')) return 'Chrome';
  if (deviceInfo.includes('Firefox')) return 'Firefox';
  if (deviceInfo.includes('Safari')) return 'Safari';
  if (deviceInfo.includes('Edge')) return 'Edge';
  if (deviceInfo.includes('Mobile')) return 'Mobile';
  if (deviceInfo.includes('Android')) return 'Android';
  if (deviceInfo.includes('iPhone')) return 'iPhone';
  return 'Other';
}

export function generateMeetingQRCodePDF(meeting: Meeting, qrDataURL: string): void {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 20;

  // Header
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('QR CODE MEETING', pageWidth / 2, 40, { align: 'center' });

  // Meeting info
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(meeting.title, pageWidth / 2, 60, { align: 'center' });

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  
  let yPos = 80;
  pdf.text(`Tanggal: ${new Date(meeting.date).toLocaleDateString('id-ID')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  pdf.text(`Waktu: ${meeting.startTime} - ${meeting.endTime}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  pdf.text(`Lokasi: ${meeting.location}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 30;

  // QR Code
  if (qrDataURL) {
    const qrSize = 120;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = yPos;
    
    pdf.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
    yPos += qrSize + 20;
  }

  // Instructions
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CARA ABSENSI:', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const instructions = [
    '1. Buka halaman "Scan QR Meeting" di aplikasi atau browser mobile',
    '2. Masukkan NIK karyawan pada form yang tersedia',
    '3. Tekan tombol "Mulai Scan QR Code" untuk mengaktifkan kamera',
    '4. Arahkan kamera ke QR code di atas hingga berhasil terbaca',
    '5. Sistem akan otomatis mencatat kehadiran Anda di meeting ini'
  ];

  instructions.forEach((instruction, index) => {
    pdf.text(instruction, margin, yPos + (index * 8));
  });

  // Footer
  const footerY = pageHeight - 30;
  pdf.setFontSize(8);
  pdf.text(`Meeting ID: ${meeting.id}`, margin, footerY);
  pdf.text(`Generated: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, footerY, { align: 'right' });

  // Generate filename
  const meetingDate = new Date(meeting.date).toISOString().split('T')[0];
  const meetingTitle = meeting.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = `meeting-qr-${meetingTitle}-${meetingDate}.pdf`;

  // Download PDF
  pdf.save(filename);
}