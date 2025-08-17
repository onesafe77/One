import jsPDF from 'jspdf';
import type { AttendanceRecord, Employee } from '@shared/schema';

export interface ReportData {
  employees: Employee[];
  attendance: AttendanceRecord[];
  startDate: string;
  endDate: string;
  reportType: 'attendance' | 'summary' | 'leave';
}

export function generateAttendancePDF(data: ReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  
  // Title
  doc.setFontSize(20);
  doc.text('Laporan Absensi Karyawan', pageWidth / 2, 30, { align: 'center' });
  
  // Date range
  doc.setFontSize(12);
  const dateRange = data.startDate === data.endDate 
    ? `Tanggal: ${formatDateForPDF(data.startDate)}`
    : `Periode: ${formatDateForPDF(data.startDate)} - ${formatDateForPDF(data.endDate)}`;
  doc.text(dateRange, pageWidth / 2, 45, { align: 'center' });
  
  // Table headers
  let yPosition = 70;
  doc.setFontSize(10);
  doc.text('No', margin, yPosition);
  doc.text('ID', margin + 20, yPosition);
  doc.text('Nama', margin + 50, yPosition);
  doc.text('Tanggal', margin + 100, yPosition);
  doc.text('Jam', margin + 135, yPosition);
  doc.text('Status', margin + 160, yPosition);
  
  // Draw header line
  doc.line(margin, yPosition + 5, pageWidth - margin, yPosition + 5);
  yPosition += 15;
  
  // Table data
  data.attendance.forEach((record, index) => {
    const employee = data.employees.find(emp => emp.id === record.employeeId);
    if (!employee) return;
    
    doc.text((index + 1).toString(), margin, yPosition);
    doc.text(record.employeeId, margin + 20, yPosition);
    doc.text(employee.name, margin + 50, yPosition);
    doc.text(formatDateForPDF(record.date), margin + 100, yPosition);
    doc.text(record.time, margin + 135, yPosition);
    doc.text(record.status === 'present' ? 'Hadir' : 'Tidak Hadir', margin + 160, yPosition);
    
    yPosition += 12;
    
    // Add new page if needed
    if (yPosition > doc.internal.pageSize.height - 40) {
      doc.addPage();
      yPosition = 30;
    }
  });
  
  // Summary
  yPosition += 20;
  const totalRecords = data.attendance.length;
  const presentCount = data.attendance.filter(r => r.status === 'present').length;
  const absentCount = totalRecords - presentCount;
  
  doc.setFontSize(12);
  doc.text('Ringkasan:', margin, yPosition);
  yPosition += 15;
  doc.setFontSize(10);
  doc.text(`Total Absensi: ${totalRecords}`, margin, yPosition);
  yPosition += 12;
  doc.text(`Hadir: ${presentCount}`, margin, yPosition);
  yPosition += 12;
  doc.text(`Tidak Hadir: ${absentCount}`, margin, yPosition);
  
  // Footer
  const now = new Date();
  const footerText = `Laporan dibuat pada: ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID')}`;
  doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 20, { align: 'center' });
  
  // Download
  const filename = `Absensi_${data.startDate.replace(/-/g, '')}_${data.endDate.replace(/-/g, '')}.pdf`;
  doc.save(filename);
}

function formatDateForPDF(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('id-ID');
}
