import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

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
    const margin = 20;

    // Header
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('LAPORAN KEHADIRAN MEETING', pageWidth / 2, 25, { align: 'center' });

    // Date and time generated
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const currentDateTime = new Date();
    pdf.text(`Dicetak pada: ${currentDateTime.toLocaleDateString('id-ID')} ${currentDateTime.toLocaleTimeString('id-ID')}`, pageWidth - margin, 15, { align: 'right' });

    // Meeting Information
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    let yPosition = 45;
    const lineHeight = 6;

    // Meeting info box
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 45);
    pdf.text('INFORMASI MEETING', margin + 5, yPosition + 3);
    yPosition += lineHeight + 2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    
    pdf.text(`Judul Meeting: ${data.meeting.title || 'N/A'}`, margin + 5, yPosition);
    yPosition += lineHeight;

    const meetingDate = new Date(data.meeting.date);
    pdf.text(`Tanggal: ${meetingDate.toLocaleDateString('id-ID')}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Waktu: ${data.meeting.startTime} - ${data.meeting.endTime}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Lokasi: ${data.meeting.location || 'N/A'}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Penyelenggara: ${data.meeting.organizer || 'N/A'}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Total Peserta Hadir: ${data.totalAttendees || 0} orang`, margin + 5, yPosition);
    yPosition += lineHeight + 15;

    // Table header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('DAFTAR KEHADIRAN', margin, yPosition);
    yPosition += 10;

    // Attendance table
    if (data.attendance && data.attendance.length > 0) {
      const tableData = data.attendance.map((attendance, index) => [
        (index + 1).toString(),
        attendance.employee?.id || '-',
        attendance.employee?.name || 'Unknown',
        attendance.employee?.department || '-',
        data.meeting.title,
        new Date(attendance.scanDate).toLocaleDateString('id-ID'),
        attendance.scanTime || '-',
        getShortDeviceInfo(attendance.deviceInfo || 'Unknown')
      ]);

      (pdf as any).autoTable({
        head: [['No', 'NIK', 'Nama', 'Department', 'Meeting', 'Tanggal', 'Waktu', 'Device']],
        body: tableData,
        startY: yPosition,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 20 },
          2: { cellWidth: 30 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25 },
          5: { cellWidth: 18 },
          6: { cellWidth: 15 },
          7: { cellWidth: 20 },
        },
      });
    } else {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.text('Belum ada peserta yang hadir pada meeting ini.', margin, yPosition);
    }

    // Footer
    const footerY = pdf.internal.pageSize.height - 40;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    pdf.text(`Laporan dicetak pada: ${currentDateTime.toLocaleDateString('id-ID')} ${currentDateTime.toLocaleTimeString('id-ID')}`, margin, footerY);
    
    // Signature area
    const signatureX = pageWidth - 100;
    pdf.text('Mengetahui,', signatureX, footerY);
    pdf.text('Penyelenggara Meeting', signatureX, footerY + 8);
    pdf.line(signatureX, footerY + 25, signatureX + 70, footerY + 25);
    pdf.text(`(${data.meeting.organizer || 'N/A'})`, signatureX, footerY + 30);

    // Generate filename
    const dateStr = meetingDate.toISOString().split('T')[0];
    const titleStr = (data.meeting.title || 'meeting').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filename = `laporan-meeting-${titleStr}-${dateStr}.pdf`;

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