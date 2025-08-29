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

    // ==================== HEADER SECTION ====================
    // Tanggal dicetak (top right) - more professional styling
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Dicetak pada: ${currentDateTime.toLocaleDateString('id-ID')} ${currentDateTime.toLocaleTimeString('id-ID')}`, pageWidth - margin, 18, { align: 'right' });

    // Main title - larger and more prominent
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('LAPORAN KEHADIRAN MEETING', pageWidth / 2, 35, { align: 'center' });

    // Double line under title for professional look
    pdf.setLineWidth(1);
    pdf.setDrawColor(180, 30, 30); // Dark red
    pdf.line(margin, 42, pageWidth - margin, 42);
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(200, 200, 200); // Light gray
    pdf.line(margin, 44, pageWidth - margin, 44);

    // ==================== MEETING INFORMATION BOX ====================
    let yPosition = 55;
    const boxHeight = 62;
    
    // Draw enhanced border box for meeting info with shadow effect
    pdf.setFillColor(245, 245, 245); // Very light gray background
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, boxHeight, 'F');
    pdf.setLineWidth(1);
    pdf.setDrawColor(180, 30, 30); // Dark red border
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, boxHeight, 'S');
    
    // Box header with background
    pdf.setFillColor(180, 30, 30); // Dark red header
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 16, 'F');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255); // White text
    pdf.text('INFORMASI MEETING', margin + 8, yPosition + 6);
    
    // Meeting details with better spacing and formatting
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(40, 40, 40); // Dark gray text
    yPosition += 20;
    const lineHeight = 8;
    
    const meetingDate = new Date(data.meeting.date);
    // Create two columns for better organization
    const leftColX = margin + 8;
    const rightColX = margin + (pageWidth - 2 * margin) / 2 + 8;
    
    // Left column
    pdf.setFont('helvetica', 'bold');
    pdf.text('Judul Meeting:', leftColX, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.meeting.title, leftColX + 32, yPosition);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Tanggal:', leftColX, yPosition + lineHeight);
    pdf.setFont('helvetica', 'normal');
    pdf.text(meetingDate.toLocaleDateString('id-ID'), leftColX + 32, yPosition + lineHeight);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Waktu:', leftColX, yPosition + lineHeight * 2);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${data.meeting.startTime} - ${data.meeting.endTime}`, leftColX + 32, yPosition + lineHeight * 2);
    
    // Right column
    pdf.setFont('helvetica', 'bold');
    pdf.text('Lokasi:', rightColX, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.meeting.location, rightColX + 32, yPosition);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Penyelenggara:', rightColX, yPosition + lineHeight);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.meeting.organizer, rightColX + 32, yPosition + lineHeight);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Total Hadir:', rightColX, yPosition + lineHeight * 2);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${data.totalAttendees} orang`, rightColX + 32, yPosition + lineHeight * 2);

    yPosition += boxHeight + 20;

    // ==================== ATTENDANCE TABLE ====================
    // Table header with background
    pdf.setFillColor(250, 250, 250);
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 18, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(180, 30, 30); // Dark red
    pdf.text('DAFTAR KEHADIRAN', margin + 5, yPosition + 8);
    yPosition += 20;

    if (data.attendance && data.attendance.length > 0) {
      const tableData = data.attendance.map((attendance, index) => [
        (index + 1).toString(),
        attendance.employee?.id || '-',
        attendance.employee?.name || 'Unknown',
        attendance.employee?.department || '-',
        data.meeting.title.length > 20 ? data.meeting.title.substring(0, 17) + '...' : data.meeting.title,
        new Date(attendance.scanDate).toLocaleDateString('id-ID'),
        attendance.scanTime ? `${attendance.scanTime} WITA` : '-',
        getShortDeviceInfo(attendance.deviceInfo || 'Unknown')
      ]);

      autoTable(pdf, {
        head: [['No', 'NIK', 'Nama Karyawan', 'Department', 'Meeting', 'Tanggal', 'Waktu', 'Device']],
        body: tableData,
        startY: yPosition,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 5,
          lineColor: [220, 220, 220],
          lineWidth: 0.4,
          font: 'helvetica',
          textColor: [40, 40, 40],
          minCellHeight: 12
        },
        headStyles: {
          fillColor: [180, 30, 30], // Dark red professional
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 11,
          halign: 'center',
          valign: 'middle',
          cellPadding: 6
        },
        alternateRowStyles: {
          fillColor: [252, 252, 252] // Very light gray for alternate rows
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' }, // No - wider
          1: { cellWidth: 25, halign: 'center' }, // NIK - wider
          2: { cellWidth: 45, halign: 'left' },   // Nama - wider
          3: { cellWidth: 35, halign: 'left' },   // Department - wider
          4: { cellWidth: 30, halign: 'left' },   // Meeting - wider
          5: { cellWidth: 20, halign: 'center' }, // Tanggal - wider
          6: { cellWidth: 18, halign: 'center' }, // Waktu - wider
          7: { cellWidth: 20, halign: 'center' }  // Device - wider
        },
        margin: { left: margin, right: margin },
        tableWidth: 'auto',
        tableLineColor: [180, 30, 30],
        tableLineWidth: 0.8
      });
    } else {
      // No attendance message
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(11);
      pdf.setTextColor(120, 120, 120);
      pdf.text('Belum ada peserta yang hadir pada meeting ini.', margin, yPosition + 10);
    }

    // ==================== FOOTER SECTION ====================
    const footerY = pageHeight - 55;
    
    // Footer background
    pdf.setFillColor(248, 248, 248);
    pdf.rect(0, footerY - 15, pageWidth, 65, 'F');
    
    // Footer separator line - double line design
    pdf.setLineWidth(0.8);
    pdf.setDrawColor(180, 30, 30);
    pdf.line(margin, footerY - 10, pageWidth - margin, footerY - 10);
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
    
    // Left side - generation info with better formatting
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text('Laporan dibuat oleh:', margin, footerY);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Sistem Manajemen Meeting PT.GECL', margin, footerY + 8);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`Tanggal: ${currentDateTime.toLocaleDateString('id-ID')} | Waktu: ${currentDateTime.toLocaleTimeString('id-ID')}`, margin, footerY + 16);
    
    // Right side - enhanced signature area
    const signatureX = pageWidth - 110;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(signatureX - 5, footerY - 8, 100, 40, 'F');
    pdf.setLineWidth(0.5);
    pdf.setDrawColor(180, 30, 30);
    pdf.rect(signatureX - 5, footerY - 8, 100, 40, 'S');
    
    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Mengetahui,', signatureX, footerY - 2);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('Penyelenggara Meeting', signatureX, footerY + 6);
    
    // Enhanced signature line
    pdf.setLineWidth(0.8);
    pdf.setDrawColor(40, 40, 40);
    pdf.line(signatureX, footerY + 18, signatureX + 75, footerY + 18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`(${data.meeting.organizer})`, signatureX + 5, footerY + 26);

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