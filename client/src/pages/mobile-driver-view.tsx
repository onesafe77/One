import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, Calendar, Clock, MapPin, ChevronDown, ChevronUp, Bell, AlertTriangle, TrendingUp, Activity, CheckCircle, XCircle, Shield } from "lucide-react";
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

interface LeaveRosterMonitoring {
  id: string;
  nik: string;
  name: string;
  nomorLambung: string;
  month: string;
  investorGroup: string;
  lastLeaveDate: string;
  leaveOption: string;
  monitoringDays: number;
  onSite: string;
  status: string;
  nextLeaveDate: string;
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

export default function MobileDriverView() {
  const [nik, setNik] = useState("");
  const [searchEmployee, setSearchEmployee] = useState<Employee | null>(null);
  const [suggestions, setSuggestions] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'roster' | 'leave' | 'monitoring' | 'simper'>('roster');

  // Query untuk mencari employee berdasarkan NIK - OPTIMIZED
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
    enabled: true,
    staleTime: 10 * 60 * 1000, // 10 minutes cache - employees data doesn't change often
  });

  // Query untuk roster berdasarkan employee yang dipilih - LAZY LOADING
  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["/api/roster", { employeeId: searchEmployee?.id }],
    queryFn: async () => {
      if (!searchEmployee?.id) return [];
      const response = await fetch(`/api/roster?employeeId=${searchEmployee.id}`);
      if (!response.ok) throw new Error('Failed to fetch roster');
      return response.json();
    },
    enabled: !!searchEmployee && activeTab === 'roster', // Only load when roster tab active
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Query untuk leave requests berdasarkan employee yang dipilih - LAZY LOADING
  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ["/api/leave"],
    enabled: !!searchEmployee && activeTab === 'leave', // Only load when leave tab active
    staleTime: 3 * 60 * 1000, // 3 minutes cache
  });

  // Query untuk leave monitoring data - LAZY LOADING
  const { data: upcomingLeaves = [] } = useQuery({
    queryKey: ["/api/leave-monitoring/upcoming"],
    enabled: !!searchEmployee && activeTab === 'monitoring', // Only load when monitoring tab active
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });

  const { data: leaveHistory = [] } = useQuery({
    queryKey: ["/api/leave-monitoring/history"],
    enabled: !!searchEmployee && activeTab === 'monitoring', // Only load when monitoring tab active
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ["/api/leave/pending-from-monitoring"],
    enabled: !!searchEmployee && activeTab === 'monitoring', // Only load when monitoring tab active
    staleTime: 1 * 60 * 1000, // 1 minute cache
  });

  // Query untuk leave roster monitoring data - COMPREHENSIVE
  const { data: leaveRosterMonitoring = [], isLoading: monitoringLoading } = useQuery({
    queryKey: ["/api/leave-roster-monitoring"],
    enabled: !!searchEmployee && activeTab === 'monitoring', // Only load when monitoring tab active
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });

  // Filter data monitoring untuk employee yang dipilih
  const employeeMonitoring = (leaveRosterMonitoring as LeaveRosterMonitoring[]).find(
    (item: LeaveRosterMonitoring) => item.nik === searchEmployee?.id
  ) || null;

  // Query untuk SIMPER monitoring berdasarkan employee yang dipilih - LAZY LOADING
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
    enabled: !!searchEmployee && activeTab === 'simper', // Only load when SIMPER tab active
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const handleSearchWithNik = (nikValue: string) => {
    if (!nikValue.trim()) return;
    
    console.log('🔍 Mobile Driver View: Searching for NIK:', nikValue);
    const employeeList = employees as Employee[] || [];
    console.log('👥 Available employees:', employeeList.length);
    const searchTerm = nikValue.trim().toLowerCase();
    
    const employee = employeeList.find((emp: Employee) => {
      if (emp.id.toLowerCase() === searchTerm) return true;
      if (emp.name.toLowerCase().includes(searchTerm)) return true;
      if (emp.position && emp.position.toLowerCase().includes(searchTerm)) return true;
      return false;
    });
    
    if (employee) {
      console.log('✅ Employee found:', employee.name, employee.id);
    } else {
      console.log('❌ No employee found for:', nikValue);
    }
    
    setSearchEmployee(employee || null);
    setSuggestions([]);
  };

  // Auto-focus untuk mobile - OPTIMIZED
  useEffect(() => {
    console.log('🚀 Mobile Driver View loaded');
    // Detect if accessed via QR scan (check URL params)
    const urlParams = new URLSearchParams(window.location.search);
    const scannedNik = urlParams.get('nik');
    console.log('🔗 URL params - nik:', scannedNik);
    
    if (scannedNik && employees && Array.isArray(employees) && employees.length > 0) {
      setNik(scannedNik);
      console.log('📱 Auto-searching for employee:', scannedNik);
      // Immediate search - no delay needed
      handleSearchWithNik(scannedNik);
      // Auto set to roster tab for quick access
      setActiveTab('roster');
    }
  }, [employees]); // Depend on employees so it runs when data is loaded

  const handleSearch = () => {
    handleSearchWithNik(nik);
  };

  const employeeRoster = (rosterData as RosterSchedule[]) || [];
  const leaveList = leaveData as LeaveRequest[] || [];
  const employeeLeaves = leaveList.filter((leave: LeaveRequest) => 
    leave.employeeId === searchEmployee?.id
  );

  const getShiftBadgeColor = (shift: string) => {
    return shift === "Shift 1" ? "bg-blue-500 text-white" : "bg-orange-500 text-white";
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-500 text-white";
      case "scheduled": return "bg-blue-500 text-white";
      case "pending": return "bg-yellow-500 text-black";
      case "approved": return "bg-green-500 text-white";
      case "rejected": return "bg-red-500 text-white";
      default: return "bg-gray-500 text-white";
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Modern Mobile Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 text-white p-6 sticky top-0 z-50 shadow-xl">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Activity className="h-6 w-6 mr-2" />
            <h1 className="text-2xl font-bold">Driver View</h1>
          </div>
          <p className="text-red-100 text-sm font-medium">Employee Data & Monitoring System</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Loading State untuk employees */}
        {employeesLoading && (
          <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg">
            <CardContent className="p-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-500"></div>
                <p className="text-gray-600 dark:text-gray-300 font-semibold">Loading employee data...</p>
                <p className="text-gray-400 text-sm">Memuat data karyawan dari server...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modern Search Section */}
        {!employeesLoading && (
          <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg">
          <CardHeader className="pb-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 dark:text-white">
              <div className="p-2 bg-red-500 rounded-full">
                <Search className="h-5 w-5 text-white" />
              </div>
              Cari Karyawan
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 font-medium">
              Scan QR code atau masukkan NIK untuk melihat data lengkap
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                placeholder="Ketik NIK atau nama karyawan..."
                value={nik}
                onChange={(e) => {
                  const value = e.target.value;
                  setNik(value);
                  
                  if (value.trim().length > 2) {
                    const employeeList = employees as Employee[] || [];
                    const searchTerm = value.trim().toLowerCase();
                    
                    const matchedEmployees = employeeList.filter((emp: Employee) => {
                      return emp.name.toLowerCase().includes(searchTerm) ||
                             emp.id.toLowerCase().includes(searchTerm) ||
                             (emp.position && emp.position.toLowerCase().includes(searchTerm));
                    }).slice(0, 3); // Limit untuk mobile
                    
                    setSuggestions(matchedEmployees);
                  } else {
                    setSuggestions([]);
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="text-base border-2 focus:border-red-500 rounded-xl py-3 px-4"
                data-testid="input-mobile-nik-search"
              />
              
              {/* Mobile Suggestions */}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 mt-2">
                  {suggestions.map((emp) => (
                    <div
                      key={emp.id}
                      className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 first:rounded-t-xl last:rounded-b-xl"
                      onClick={() => {
                        setNik(emp.name);
                        setSearchEmployee(emp);
                        setSuggestions([]);
                      }}
                    >
                      <div className="font-semibold text-sm">{emp.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {emp.id} | {emp.position}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <Button 
              onClick={handleSearch} 
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              data-testid="button-mobile-search"
            >
              <Search className="h-5 w-5 mr-2" />
              Cari Data Karyawan
            </Button>
            
            {nik && !searchEmployee && (
              <div className="text-red-500 text-sm text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="font-semibold">Karyawan "{nik}" tidak ditemukan</p>
                <p className="text-xs text-gray-500 mt-1">Coba cari dengan NIK atau nama lengkap</p>
              </div>
            )}
          </CardContent>
          </Card>
        )}

        {/* Employee Info - Modern Card */}
        {searchEmployee && !employeesLoading && (
          <>
            <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 dark:text-white">
                  <div className="p-3 bg-blue-500 rounded-full shadow-lg">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  {searchEmployee.name}
                </CardTitle>
                <CardDescription className="text-blue-600 dark:text-blue-300 font-semibold text-base">
                  NIK: {searchEmployee.id}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Posisi</p>
                    <p className="font-bold text-gray-800 dark:text-white">{searchEmployee.position}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Department</p>
                    <p className="font-bold text-gray-800 dark:text-white">{searchEmployee.department}</p>
                  </div>
                  <div className="col-span-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Investor Group</p>
                    <p className="font-bold text-gray-800 dark:text-white">{searchEmployee.investorGroup}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Modern Tab Navigation */}
            <div className="grid grid-cols-4 gap-1">
              <Button
                variant={activeTab === 'roster' ? "default" : "outline"}
                onClick={() => setActiveTab('roster')}
                className={`p-3 rounded-xl font-semibold ${activeTab === 'roster' 
                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg' 
                  : 'bg-white dark:bg-gray-800 border-2'}`}
              >
                <Calendar className="h-4 w-4 mb-1" />
                <span className="text-xs">Roster</span>
              </Button>
              <Button
                variant={activeTab === 'leave' ? "default" : "outline"}
                onClick={() => setActiveTab('leave')}
                className={`p-3 rounded-xl font-semibold ${activeTab === 'leave' 
                  ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg' 
                  : 'bg-white dark:bg-gray-800 border-2'}`}
              >
                <MapPin className="h-4 w-4 mb-1" />
                <span className="text-xs">Cuti</span>
              </Button>
              <Button
                variant={activeTab === 'monitoring' ? "default" : "outline"}
                onClick={() => setActiveTab('monitoring')}
                className={`p-3 rounded-xl font-semibold ${activeTab === 'monitoring' 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg' 
                  : 'bg-white dark:bg-gray-800 border-2'}`}
              >
                <Bell className="h-4 w-4 mb-1" />
                <span className="text-xs">Monitor</span>
              </Button>
              <Button
                variant={activeTab === 'simper' ? "default" : "outline"}
                onClick={() => setActiveTab('simper')}
                className={`p-3 rounded-xl font-semibold ${activeTab === 'simper' 
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg' 
                  : 'bg-white dark:bg-gray-800 border-2'}`}
              >
                <Shield className="h-4 w-4 mb-1" />
                <span className="text-xs">SIMPER</span>
              </Button>
            </div>

            {/* Tab Content */}
            {activeTab === 'roster' && (
              <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 dark:text-white">
                    <div className="p-2 bg-green-500 rounded-full">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    Jadwal Roster Kerja
                  </CardTitle>
                  <CardDescription className="text-green-600 dark:text-green-300 font-medium">
                    Daftar jadwal kerja untuk {searchEmployee.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {rosterLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-green-500 mx-auto"></div>
                      <p className="text-gray-600 dark:text-gray-300 font-semibold mt-4">Loading roster data...</p>
                      <p className="text-gray-400 text-sm mt-2">Mengambil jadwal kerja terbaru...</p>
                    </div>
                  ) : employeeRoster.length > 0 ? (
                    <div className="space-y-4">
                      {employeeRoster
                        .sort((a: RosterSchedule, b: RosterSchedule) => 
                          new Date(b.date).getTime() - new Date(a.date).getTime()
                        )
                        .slice(0, 10)
                        .map((roster: RosterSchedule) => (
                          <div key={roster.id} className="border-2 border-gray-100 dark:border-gray-700 rounded-xl p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-bold text-lg text-gray-800 dark:text-white">
                                  {format(new Date(roster.date), "dd MMM yyyy")}
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <Badge className={getShiftBadgeColor(roster.shift) + " px-3 py-1 rounded-full font-semibold"}>
                                    {roster.shift}
                                  </Badge>
                                  <Badge className={getStatusBadgeColor(roster.status) + " px-3 py-1 rounded-full font-semibold"}>
                                    {roster.status}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-semibold">{roster.startTime} - {roster.endTime}</span>
                                </div>
                                {roster.jamTidur && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Jam Tidur: {roster.jamTidur}
                                  </p>
                                )}
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {roster.fitToWork}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Tidak ada data roster ditemukan</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'leave' && (
              <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 dark:text-white">
                    <div className="p-2 bg-orange-500 rounded-full">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    Riwayat Cuti
                  </CardTitle>
                  <CardDescription className="text-orange-600 dark:text-orange-300 font-medium">
                    Daftar pengajuan cuti untuk {searchEmployee.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {leaveLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-orange-500 mx-auto"></div>
                      <p className="text-gray-600 dark:text-gray-300 font-semibold mt-4">Loading leave data...</p>
                      <p className="text-gray-400 text-sm mt-2">Mengambil data cuti terbaru...</p>
                    </div>
                  ) : employeeLeaves.length > 0 ? (
                    <div className="space-y-4">
                      {employeeLeaves
                        .sort((a: LeaveRequest, b: LeaveRequest) => 
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                        )
                        .slice(0, 5)
                        .map((leave: LeaveRequest) => (
                          <div key={leave.id} className="border-2 border-gray-100 dark:border-gray-700 rounded-xl p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-bold text-lg text-gray-800 dark:text-white mb-1">{leave.leaveType}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  {format(new Date(leave.startDate), "dd MMM yyyy")} - {format(new Date(leave.endDate), "dd MMM yyyy")}
                                </p>
                                {leave.reason && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Alasan:</span> {leave.reason}
                                  </p>
                                )}
                              </div>
                              <Badge className={getStatusBadgeColor(leave.status) + " px-3 py-1 rounded-full font-semibold"}>
                                {leave.status === 'approved' ? 'Disetujui' : 
                                 leave.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Tidak ada data cuti ditemukan</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'monitoring' && (
              <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 dark:text-white">
                    <div className="p-2 bg-purple-500 rounded-full">
                      <Bell className="h-5 w-5 text-white" />
                    </div>
                    Monitoring Cuti
                  </CardTitle>
                  <CardDescription className="text-purple-600 dark:text-purple-300 font-medium">
                    Monitoring siklus cuti dan status untuk {searchEmployee.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {monitoringLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-purple-500 mx-auto"></div>
                      <p className="text-gray-600 dark:text-gray-300 font-semibold mt-4">Loading monitoring data...</p>
                      <p className="text-gray-400 text-sm mt-2">Mengambil data monitoring cuti...</p>
                    </div>
                  ) : employeeMonitoring ? (
                    <div className="space-y-6">
                      {/* Status Card - Main */}
                      <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border-2 border-indigo-200 dark:border-indigo-700">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-indigo-800 dark:text-indigo-200">Status Monitoring</h3>
                          <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                            employeeMonitoring.status === 'Aktif' ? 'bg-green-500 text-white' :
                            employeeMonitoring.status === 'Menunggu Cuti' ? 'bg-yellow-500 text-black' :
                            employeeMonitoring.status === 'Sedang Cuti' ? 'bg-blue-500 text-white' :
                            'bg-gray-500 text-white'
                          }`}>
                            {employeeMonitoring.status}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                              {employeeMonitoring.monitoringDays}
                            </p>
                            <p className="text-sm text-indigo-600 dark:text-indigo-400">Hari Monitoring</p>
                          </div>
                          <div className="text-center">
                            <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                              {employeeMonitoring.leaveOption}
                            </p>
                            <p className="text-sm text-purple-600 dark:text-purple-400">Target Hari Kerja</p>
                          </div>
                        </div>
                      </div>

                      {/* Cycle Progress */}
                      <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-700">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-emerald-500 rounded-full">
                            <TrendingUp className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">Progress Siklus Cuti</h3>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
                          <div 
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, (employeeMonitoring.monitoringDays / parseInt(employeeMonitoring.leaveOption)) * 100)}%` 
                            }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            {employeeMonitoring.monitoringDays} / {employeeMonitoring.leaveOption} hari
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {Math.round((employeeMonitoring.monitoringDays / parseInt(employeeMonitoring.leaveOption)) * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Dates Information */}
                      <div className="grid grid-cols-1 gap-4">
                        {/* Last Leave */}
                        <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-700">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-orange-500 rounded-full">
                              <Calendar className="h-4 w-4 text-white" />
                            </div>
                            <h4 className="font-bold text-orange-800 dark:text-orange-200">Terakhir Cuti</h4>
                          </div>
                          <p className="text-orange-700 dark:text-orange-300 font-semibold">
                            {employeeMonitoring.lastLeaveDate ? format(new Date(employeeMonitoring.lastLeaveDate), "dd MMM yyyy") : "Belum ada data"}
                          </p>
                        </div>

                        {/* Next Leave */}
                        <div className="p-4 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl border-2 border-cyan-200 dark:border-cyan-700">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-cyan-500 rounded-full">
                              <Clock className="h-4 w-4 text-white" />
                            </div>
                            <h4 className="font-bold text-cyan-800 dark:text-cyan-200">Target Cuti Berikutnya</h4>
                          </div>
                          <p className="text-cyan-700 dark:text-cyan-300 font-semibold">
                            {employeeMonitoring.nextLeaveDate ? format(new Date(employeeMonitoring.nextLeaveDate), "dd MMM yyyy") : "Belum terhitung"}
                          </p>
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 rounded-xl border-2 border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400 font-medium">Investor Group</p>
                            <p className="font-bold text-gray-800 dark:text-white">{employeeMonitoring.investorGroup}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400 font-medium">OnSite Status</p>
                            <p className="font-bold text-gray-800 dark:text-white">
                              {employeeMonitoring.onSite || "Tidak diisi"}
                            </p>
                          </div>
                          {employeeMonitoring.nomorLambung && (
                            <div className="col-span-2">
                              <p className="text-gray-600 dark:text-gray-400 font-medium">Nomor Lambung</p>
                              <p className="font-bold text-gray-800 dark:text-white">{employeeMonitoring.nomorLambung}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-700">
                          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {employeeLeaves.filter(l => l.status === 'approved').length}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400">Cuti Disetujui</p>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl border border-red-200 dark:border-red-700">
                          <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                            {employeeLeaves.filter(l => l.status === 'rejected').length}
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-400">Cuti Ditolak</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300 font-semibold text-lg mb-2">
                        Data Monitoring Tidak Ditemukan
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Employee {searchEmployee.name} belum terdaftar dalam sistem monitoring cuti
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'simper' && (
              <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg">
                <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 dark:text-white">
                    <div className="p-2 bg-red-500 rounded-full">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    Data SIMPER Monitoring
                  </CardTitle>
                  <CardDescription className="text-red-600 dark:text-red-300 font-medium">
                    Status SIMPER BIB dan TIA untuk {searchEmployee.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {simperLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-red-500 mx-auto"></div>
                      <p className="text-gray-600 dark:text-gray-300 font-semibold mt-4">Loading SIMPER data...</p>
                      <p className="text-gray-400 text-sm mt-2">Mengambil data SIMPER terbaru...</p>
                    </div>
                  ) : simperData ? (
                    <div className="space-y-6">
                      {/* Employee Info */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 p-4 rounded-xl">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3">Informasi Karyawan</h3>
                        <div className="grid grid-cols-1 gap-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Nama:</span>
                            <span className="font-semibold text-gray-800 dark:text-white">{simperData.employeeName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">NIK:</span>
                            <span className="font-semibold text-gray-800 dark:text-white">{simperData.nik}</span>
                          </div>
                        </div>
                      </div>

                      {/* SIMPER Status Cards */}
                      <div className="space-y-4">
                        {/* SIMPER BIB */}
                        <div className="border-2 border-blue-100 dark:border-blue-800 rounded-xl p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                          <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center">
                            <Shield className="w-5 h-5 mr-2 text-blue-600" />
                            SIMPER BIB
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400 text-sm">Tanggal Expired:</span>
                              <span className="font-semibold text-gray-800 dark:text-white">
                                {formatDateDD_MM_YYYY(simperData.simperBibExpiredDate)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400 text-sm">Monitoring Days:</span>
                              <span className="font-semibold text-gray-800 dark:text-white">
                                {simperData.bibMonitoringDays !== null ? `${simperData.bibMonitoringDays} hari` : '-'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400 text-sm">Status:</span>
                              <Badge className={getSimperStatusColor(simperData.bibStatus || 'Tidak Ada Data') + ' px-3 py-1 rounded-full font-semibold'}>
                                {simperData.bibStatus || 'Tidak Ada Data'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* SIMPER TIA */}
                        <div className="border-2 border-green-100 dark:border-green-800 rounded-xl p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                          <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center">
                            <Shield className="w-5 h-5 mr-2 text-green-600" />
                            SIMPER TIA
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400 text-sm">Tanggal Expired:</span>
                              <span className="font-semibold text-gray-800 dark:text-white">
                                {formatDateDD_MM_YYYY(simperData.simperTiaExpiredDate)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400 text-sm">Monitoring Days:</span>
                              <span className="font-semibold text-gray-800 dark:text-white">
                                {simperData.tiaMonitoringDays !== null ? `${simperData.tiaMonitoringDays} hari` : '-'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400 text-sm">Status:</span>
                              <Badge className={getSimperStatusColor(simperData.tiaStatus || 'Tidak Ada Data') + ' px-3 py-1 rounded-full font-semibold'}>
                                {simperData.tiaStatus || 'Tidak Ada Data'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Alert untuk status kritis */}
                      {(simperData.bibStatus === 'Segera Perpanjang' || simperData.tiaStatus === 'Segera Perpanjang' ||
                        simperData.bibStatus === 'Mendekati Perpanjangan' || simperData.tiaStatus === 'Mendekati Perpanjangan') && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-xl p-4">
                          <div className="flex items-center mb-2">
                            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                            <span className="font-bold text-red-800 dark:text-red-200">Peringatan SIMPER</span>
                          </div>
                          <p className="text-red-700 dark:text-red-300 text-sm">
                            Ada SIMPER yang akan expired dalam waktu dekat. Segera lakukan perpanjangan.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300 font-semibold text-lg mb-2">
                        Data SIMPER Tidak Ditemukan
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Karyawan {searchEmployee.name} belum terdaftar dalam sistem monitoring SIMPER
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}