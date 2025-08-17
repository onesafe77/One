import type { AttendanceRecord, Employee, LeaveRequest } from '@shared/schema';

export function exportAttendanceToCSV(
  attendance: AttendanceRecord[], 
  employees: Employee[]
): void {
  const headers = ['No', 'ID Karyawan', 'Nama', 'Tanggal', 'Jam', 'Status'];
  
  const csvData = [
    headers,
    ...attendance.map((record, index) => {
      const employee = employees.find(emp => emp.id === record.employeeId);
      return [
        (index + 1).toString(),
        record.employeeId,
        employee?.name || 'Unknown',
        formatDateForCSV(record.date),
        record.time,
        record.status === 'present' ? 'Hadir' : 'Tidak Hadir'
      ];
    })
  ];
  
  downloadCSV(csvData, `absensi_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportLeaveToCSV(
  leaveRequests: LeaveRequest[], 
  employees: Employee[]
): void {
  const headers = ['No', 'ID Karyawan', 'Nama', 'Tanggal Mulai', 'Tanggal Selesai', 'Jenis Cuti', 'Status', 'Keterangan'];
  
  const csvData = [
    headers,
    ...leaveRequests.map((request, index) => {
      const employee = employees.find(emp => emp.id === request.employeeId);
      return [
        (index + 1).toString(),
        request.employeeId,
        employee?.name || 'Unknown',
        formatDateForCSV(request.startDate),
        formatDateForCSV(request.endDate),
        getLeaveTypeLabel(request.leaveType),
        getLeaveStatusLabel(request.status),
        request.reason || ''
      ];
    })
  ];
  
  downloadCSV(csvData, `cuti_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportEmployeesToCSV(employees: Employee[]): void {
  const headers = ['No', 'ID Karyawan', 'Nama', 'No. WhatsApp', 'Shift', 'Status'];
  
  const csvData = [
    headers,
    ...employees.map((employee, index) => [
      (index + 1).toString(),
      employee.id,
      employee.name,
      employee.phone,
      getShiftLabel(employee.shift),
      employee.status === 'active' ? 'Aktif' : 'Tidak Aktif'
    ])
  ];
  
  downloadCSV(csvData, `karyawan_${new Date().toISOString().split('T')[0]}.csv`);
}

function downloadCSV(data: string[][], filename: string): void {
  const csvContent = data.map(row => 
    row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  const BOM = '\uFEFF'; // UTF-8 BOM for proper Excel encoding
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  window.URL.revokeObjectURL(url);
}

function formatDateForCSV(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('id-ID');
}

function getLeaveTypeLabel(type: string): string {
  const types: { [key: string]: string } = {
    'annual': 'Cuti Tahunan',
    'sick': 'Cuti Sakit',
    'personal': 'Cuti Pribadi',
    'maternity': 'Cuti Melahirkan'
  };
  return types[type] || type;
}

function getLeaveStatusLabel(status: string): string {
  const statuses: { [key: string]: string } = {
    'pending': 'Menunggu',
    'approved': 'Disetujui',
    'rejected': 'Ditolak'
  };
  return statuses[status] || status;
}

function getShiftLabel(shift: string): string {
  const shifts: { [key: string]: string } = {
    'Pagi': 'Pagi',
    'Siang': 'Siang',
    'Malam': 'Malam'
  };
  return shifts[shift] || shift;
}
