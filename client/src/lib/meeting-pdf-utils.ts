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
  description?: string;
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
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const margin = 20;

  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('LAPORAN KEHADIRAN MEETING', pageWidth / 2, 30, { align: 'center' });

  // Meeting Information
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  
  let yPosition = 50;
  const lineHeight = 7;

  // Meeting details
  pdf.setFont('helvetica', 'bold');
  pdf.text('INFORMASI MEETING:', margin, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'normal');
  pdf.text(`Judul Meeting: ${data.meeting.title}`, margin, yPosition);
  yPosition += lineHeight;

  if (data.meeting.description) {
    pdf.text(`Deskripsi: ${data.meeting.description}`, margin, yPosition);
    yPosition += lineHeight;
  }

  pdf.text(`Tanggal: ${new Date(data.meeting.date).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`, margin, yPosition);
  yPosition += lineHeight;

  pdf.text(`Waktu: ${data.meeting.startTime} - ${data.meeting.endTime}`, margin, yPosition);
  yPosition += lineHeight;

  pdf.text(`Lokasi: ${data.meeting.location}`, margin, yPosition);
  yPosition += lineHeight;

  pdf.text(`Penyelenggara: ${data.meeting.organizer}`, margin, yPosition);
  yPosition += lineHeight;

  pdf.text(`Status: ${getMeetingStatusLabel(data.meeting.status)}`, margin, yPosition);
  yPosition += lineHeight + 5;

  // Summary
  pdf.setFont('helvetica', 'bold');
  pdf.text('RINGKASAN KEHADIRAN:', margin, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'normal');
  pdf.text(`Total Peserta Hadir: ${data.totalAttendees} orang`, margin, yPosition);
  yPosition += lineHeight + 10;

  // Attendance table
  if (data.attendance.length > 0) {
    const tableColumns = [
      { header: 'No', dataKey: 'no' },
      { header: 'NIK', dataKey: 'nik' },
      { header: 'Nama Karyawan', dataKey: 'name' },
      { header: 'Posisi', dataKey: 'position' },
      { header: 'Departemen', dataKey: 'department' },
      { header: 'Waktu Scan', dataKey: 'scanTime' },
      { header: 'Device Info', dataKey: 'deviceInfo' }
    ];

    const tableRows = data.attendance.map((attendance, index) => ({
      no: (index + 1).toString(),
      nik: attendance.employee?.id || '-',
      name: attendance.employee?.name || 'Unknown',
      position: attendance.employee?.position || '-',
      department: attendance.employee?.department || '-',
      scanTime: attendance.scanTime,
      deviceInfo: getShortDeviceInfo(attendance.deviceInfo || 'Unknown')
    }));

    pdf.autoTable({
      head: [tableColumns.map(col => col.header)],
      body: tableRows.map(row => tableColumns.map(col => row[col.dataKey as keyof typeof row])),
      startY: yPosition,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [128, 128, 128],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [220, 38, 38], // Red color matching the theme
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 15 }, // No
        1: { cellWidth: 25 }, // NIK
        2: { cellWidth: 40 }, // Nama
        3: { cellWidth: 30 }, // Posisi
        4: { cellWidth: 25 }, // Departemen
        5: { cellWidth: 25 }, // Waktu Scan
        6: { cellWidth: 30 }, // Device Info
      },
      margin: { left: margin, right: margin },
    });
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.text('Belum ada peserta yang melakukan absensi untuk meeting ini.', margin, yPosition);
  }

  // Footer
  const currentDate = new Date().toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const footerY = pdf.internal.pageSize.height - 30;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Laporan dibuat pada: ${currentDate}`, margin, footerY);
  pdf.text('Sistem Manajemen Meeting - PT. GECL', pageWidth - margin, footerY, { align: 'right' });

  // Generate filename
  const meetingDate = new Date(data.meeting.date).toISOString().split('T')[0];
  const meetingTitle = data.meeting.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = `meeting-attendance-${meetingTitle}-${meetingDate}.pdf`;

  // Download PDF
  pdf.save(filename);
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