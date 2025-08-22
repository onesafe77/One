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
  try {
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
    pdf.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 15, { align: 'right' });

    // Meeting Information Box
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    let yPosition = 45;
    const lineHeight = 6;

    // Draw box for meeting info
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 45);
    
    pdf.text('INFORMASI MEETING', margin + 5, yPosition + 3);
    yPosition += lineHeight + 2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    
    pdf.text(`Judul Meeting: ${data.meeting.title}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Tanggal: ${new Date(data.meeting.date).toLocaleDateString('id-ID')}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Waktu: ${data.meeting.startTime} - ${data.meeting.endTime}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Lokasi: ${data.meeting.location}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Penyelenggara: ${data.meeting.organizer}`, margin + 5, yPosition);
    yPosition += lineHeight;

    pdf.text(`Total Peserta Hadir: ${data.totalAttendees} orang`, margin + 5, yPosition);
    yPosition += lineHeight + 15;

    // Attendance table header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('DAFTAR KEHADIRAN MEETING', margin, yPosition);
    yPosition += 10;

    // Attendance table
    if (data.attendance.length > 0) {
      const tableColumns = [
        { header: 'No', dataKey: 'no' },
        { header: 'NIK', dataKey: 'nik' },
        { header: 'Nama Karyawan', dataKey: 'name' },
        { header: 'Department', dataKey: 'department' },
        { header: 'Meeting', dataKey: 'meeting' },
        { header: 'Tanggal Scan', dataKey: 'scanDate' },
        { header: 'Waktu Scan', dataKey: 'scanTime' },
        { header: 'Device', dataKey: 'deviceInfo' }
      ];

      const tableRows = data.attendance.map((attendance, index) => ({
        no: (index + 1).toString(),
        nik: attendance.employee?.id || '-',
        name: attendance.employee?.name || 'Unknown',
        department: attendance.employee?.department || '-',
        meeting: data.meeting.title,
        scanDate: new Date(attendance.scanDate).toLocaleDateString('id-ID'),
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
          0: { cellWidth: 12 }, // No
          1: { cellWidth: 22 }, // NIK
          2: { cellWidth: 35 }, // Nama
          3: { cellWidth: 20 }, // Department
          4: { cellWidth: 25 }, // Meeting
          5: { cellWidth: 20 }, // Tanggal Scan
          6: { cellWidth: 18 }, // Waktu Scan
          7: { cellWidth: 25 }, // Device
        },
        margin: { left: margin, right: margin },
      });
    } else {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.text('Belum ada peserta yang hadir pada meeting ini.', margin, yPosition);
    }

    // Footer with signature area
    const footerY = pdf.internal.pageSize.height - 60;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    
    // Left side - Generated info
    pdf.text(`Laporan dicetak pada: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, margin, footerY);
    
    // Right side - Signature area
    const signatureX = pageWidth - margin - 80;
    pdf.text('Mengetahui,', signatureX, footerY);
    pdf.text('Penyelenggara Meeting', signatureX, footerY + 6);
    
    // Signature line
    pdf.line(signatureX, footerY + 25, signatureX + 70, footerY + 25);
    pdf.text(`(${data.meeting.organizer})`, signatureX, footerY + 32);

    // Generate filename
    const meetingDate = new Date(data.meeting.date).toISOString().split('T')[0];
    const meetingTitle = data.meeting.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filename = `Laporan-Kehadiran-Meeting-${meetingTitle}-${meetingDate}.pdf`;

    // Download PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Gagal membuat PDF. Silakan periksa data meeting dan coba lagi.');
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