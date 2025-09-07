import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, Calendar, Clock, MapPin, Shield, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  investorGroup: string;
  phone: string;
}

interface RosterSchedule {
  id: string;
  employeeId: string;
  date: string;
  shift: string;
  startTime: string;
  endTime: string;
  jamTidur: string;
  fitToWork: string;
  status: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface SimperMonitoring {
  id: string;
  employeeName: string;
  nik: string;
  simperBibExpiredDate: string | null;
  simperTiaExpiredDate: string | null;
  bibMonitoringDays?: number | null;
  tiaMonitoringDays?: number | null;
  bibStatus?: string;
  tiaStatus?: string;
}

export default function DriverView() {
  const [nik, setNik] = useState("");
  const [searchEmployee, setSearchEmployee] = useState<Employee | null>(null);
  const [suggestions, setSuggestions] = useState<Employee[]>([]);

  // Query untuk mencari employee berdasarkan NIK
  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
    enabled: true,
  });

  // Query untuk roster berdasarkan employee yang dipilih
  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["/api/roster", { employeeId: searchEmployee?.id }],
    queryFn: async () => {
      if (!searchEmployee?.id) return [];
      const response = await fetch(`/api/roster?employeeId=${searchEmployee.id}`);
      if (!response.ok) throw new Error('Failed to fetch roster');
      return response.json();
    },
    enabled: !!searchEmployee,
  });

  // Query untuk leave requests berdasarkan employee yang dipilih
  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ["/api/leave"],
    enabled: !!searchEmployee,
  });

  // Query untuk SIMPER monitoring berdasarkan employee yang dipilih
  const { data: simperData, isLoading: simperLoading } = useQuery({
    queryKey: ["/api/simper-monitoring/nik", searchEmployee?.id],
    queryFn: async () => {
      if (!searchEmployee?.id) return null;
      const response = await fetch(`/api/simper-monitoring/nik/${searchEmployee.id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch SIMPER data');
      }
      const data = await response.json();
      
      // Calculate monitoring days and status
      const today = new Date();
      const processSIMPER = (expiredDate: string | null) => {
        if (!expiredDate) return { days: null, status: 'Tidak Ada Data' };
        
        const expired = new Date(expiredDate);
        const diffTime = expired.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { days: diffDays, status: 'Segera Perpanjang' };
        if (diffDays < 7) return { days: diffDays, status: 'Mendekati Perpanjangan' };
        if (diffDays < 30) return { days: diffDays, status: 'Menuju Perpanjangan' };
        return { days: diffDays, status: 'Aktif' };
      };

      const bibStatus = processSIMPER(data.simperBibExpiredDate);
      const tiaStatus = processSIMPER(data.simperTiaExpiredDate);

      return {
        ...data,
        bibMonitoringDays: bibStatus.days,
        bibStatus: bibStatus.status,
        tiaMonitoringDays: tiaStatus.days,
        tiaStatus: tiaStatus.status
      };
    },
    enabled: !!searchEmployee,
  });

  const handleSearch = () => {
    if (!nik.trim()) return;
    
    const employeeList = employees as Employee[] || [];
    const searchTerm = nik.trim().toLowerCase();
    
    const employee = employeeList.find((emp: Employee) => {
      // Cari berdasarkan NIK (exact match)
      if (emp.id.toLowerCase() === searchTerm) return true;
      
      // Cari berdasarkan nama (partial match)
      if (emp.name.toLowerCase().includes(searchTerm)) return true;
      
      
      // Cari berdasarkan posisi jika ada
      if (emp.position && emp.position.toLowerCase().includes(searchTerm)) return true;
      
      return false;
    });
    
    setSearchEmployee(employee || null);
  };

  const employeeRoster = (rosterData as RosterSchedule[]) || [];

  const leaveList = leaveData as LeaveRequest[] || [];
  const employeeLeaves = leaveList.filter((leave: LeaveRequest) => 
    leave.employeeId === searchEmployee?.id
  );

  const getShiftBadgeColor = (shift: string) => {
    return shift === "Shift 1" ? "bg-blue-500" : "bg-orange-500";
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-500";
      case "scheduled": return "bg-blue-500";
      case "pending": return "bg-yellow-500";
      case "approved": return "bg-green-500";
      case "rejected": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getSimperStatusColor = (status: string) => {
    switch (status) {
      case 'Segera Perpanjang':
        return 'bg-red-100 text-red-800';
      case 'Mendekati Perpanjangan':
        return 'bg-yellow-100 text-yellow-800';
      case 'Menuju Perpanjangan':
        return 'bg-orange-100 text-orange-800';
      case 'Aktif':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateDD_MM_YYYY = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Driver View - Data Karyawan
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Scan barcode atau masukkan NIK untuk melihat data roster dan cuti karyawan
        </p>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Cari Karyawan
          </CardTitle>
          <CardDescription>
            Masukkan NIK atau nama karyawan untuk melihat data roster dan cuti
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative">
              <Input
                placeholder="Masukkan NIK, nama, atau posisi karyawan..."
                value={nik}
                onChange={(e) => {
                  const value = e.target.value;
                  setNik(value);
                  
                  // Show suggestions saat user mengetik
                  if (value.trim().length > 2) {
                    const employeeList = employees as Employee[] || [];
                    const searchTerm = value.trim().toLowerCase();
                    
                    const matchedEmployees = employeeList.filter((emp: Employee) => {
                      return emp.name.toLowerCase().includes(searchTerm) ||
                             emp.id.toLowerCase().includes(searchTerm) ||
                             (emp.position && emp.position.toLowerCase().includes(searchTerm));
                    }).slice(0, 5);
                    
                    setSuggestions(matchedEmployees);
                  } else {
                    setSuggestions([]);
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                data-testid="input-nik-search"
              />
              
              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 mt-1">
                  {suggestions.map((emp) => (
                    <div
                      key={emp.id}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      onClick={() => {
                        setNik(emp.name);
                        setSearchEmployee(emp);
                        setSuggestions([]);
                      }}
                    >
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        NIK: {emp.id} | {emp.position} | {emp.department}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleSearch} data-testid="button-search-employee">
              <Search className="h-4 w-4 mr-2" />
              Cari
            </Button>
          </div>
          
          {nik && !searchEmployee && (
            <div className="text-red-500 text-sm space-y-1">
              <p>Karyawan dengan kata kunci "{nik}" tidak ditemukan</p>
              <p className="text-xs text-gray-500">Coba cari dengan NIK, nama, atau posisi karyawan</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Info */}
      {searchEmployee && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informasi Karyawan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">NIK</p>
                <p className="font-semibold" data-testid="text-employee-nik">{searchEmployee.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Nama</p>
                <p className="font-semibold" data-testid="text-employee-name">{searchEmployee.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Posisi</p>
                <p className="font-semibold">{searchEmployee.position}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Department</p>
                <p className="font-semibold">{searchEmployee.department}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Investor Group</p>
                <p className="font-semibold">{searchEmployee.investorGroup}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roster Data */}
      {searchEmployee && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Jadwal Roster Kerja
            </CardTitle>
            <CardDescription>
              Daftar jadwal kerja untuk {searchEmployee.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rosterLoading ? (
              <p>Memuat data roster...</p>
            ) : employeeRoster.length > 0 ? (
              <div className="space-y-3">
                {employeeRoster
                  .sort((a: RosterSchedule, b: RosterSchedule) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .slice(0, 10)
                  .map((roster: RosterSchedule) => (
                    <div key={roster.id} className="border rounded-lg p-4 space-y-2" data-testid={`roster-item-${roster.id}`}>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-semibold">
                            {format(new Date(roster.date), "dd MMM yyyy")}
                          </p>
                          <div className="flex gap-2 items-center">
                            <Badge className={getShiftBadgeColor(roster.shift)}>
                              {roster.shift}
                            </Badge>
                            <Badge variant="outline" className={getStatusBadgeColor(roster.status)}>
                              {roster.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{roster.startTime} - {roster.endTime}</span>
                          </div>
                          {roster.jamTidur && (
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                              Jam Tidur: {roster.jamTidur}
                            </p>
                          )}
                          <p className="text-gray-600 dark:text-gray-400">
                            {roster.fitToWork}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500">Tidak ada data roster ditemukan</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leave Data */}
      {searchEmployee && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Riwayat Cuti
            </CardTitle>
            <CardDescription>
              Daftar pengajuan cuti untuk {searchEmployee.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leaveLoading ? (
              <p>Memuat data cuti...</p>
            ) : employeeLeaves.length > 0 ? (
              <div className="space-y-3">
                {employeeLeaves
                  .sort((a: LeaveRequest, b: LeaveRequest) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )
                  .slice(0, 5)
                  .map((leave: LeaveRequest) => (
                    <div key={leave.id} className="border rounded-lg p-4 space-y-2" data-testid={`leave-item-${leave.id}`}>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-semibold">{leave.leaveType}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(leave.startDate), "dd MMM yyyy")} - {format(new Date(leave.endDate), "dd MMM yyyy")}
                          </p>
                          {leave.reason && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Alasan: {leave.reason}
                            </p>
                          )}
                        </div>
                        <Badge className={getStatusBadgeColor(leave.status)}>
                          {leave.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500">Tidak ada data cuti ditemukan</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* SIMPER Monitoring Data */}
      {searchEmployee && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#E53935]" />
              Data SIMPER Monitoring
            </CardTitle>
            <CardDescription>
              Status SIMPER BIB dan TIA untuk {searchEmployee.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {simperLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E53935]"></div>
              </div>
            ) : simperData ? (
              <div className="space-y-6">
                {/* Employee Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-2">Informasi Karyawan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Nama:</span>
                      <span className="ml-2 font-medium">{simperData.employeeName}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">NIK:</span>
                      <span className="ml-2 font-medium">{simperData.nik}</span>
                    </div>
                  </div>
                </div>

                {/* SIMPER Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SIMPER BIB */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-blue-600" />
                      SIMPER BIB
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tanggal Expired:</span>
                        <span className="font-medium">
                          {formatDateDD_MM_YYYY(simperData.simperBibExpiredDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monitoring Days:</span>
                        <span className="font-medium">
                          {simperData.bibMonitoringDays !== null ? simperData.bibMonitoringDays : '-'} hari
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status:</span>
                        <Badge className={getSimperStatusColor(simperData.bibStatus || 'Tidak Ada Data')}>
                          {simperData.bibStatus || 'Tidak Ada Data'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* SIMPER TIA */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-green-600" />
                      SIMPER TIA
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tanggal Expired:</span>
                        <span className="font-medium">
                          {formatDateDD_MM_YYYY(simperData.simperTiaExpiredDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monitoring Days:</span>
                        <span className="font-medium">
                          {simperData.tiaMonitoringDays !== null ? simperData.tiaMonitoringDays : '-'} hari
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status:</span>
                        <Badge className={getSimperStatusColor(simperData.tiaStatus || 'Tidak Ada Data')}>
                          {simperData.tiaStatus || 'Tidak Ada Data'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alert untuk status kritis */}
                {(simperData.bibStatus === 'Segera Perpanjang' || simperData.tiaStatus === 'Segera Perpanjang' ||
                  simperData.bibStatus === 'Mendekati Perpanjangan' || simperData.tiaStatus === 'Mendekati Perpanjangan') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                      <span className="font-semibold text-red-800">Peringatan SIMPER</span>
                    </div>
                    <p className="text-red-700 mt-1 text-sm">
                      Ada SIMPER yang akan expired dalam waktu dekat. Segera lakukan perpanjangan.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Data SIMPER tidak ditemukan untuk karyawan ini</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}