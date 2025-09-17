import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, Calendar, Clock, MapPin, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { isMobileDevice } from "@/lib/crypto-utils";

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
  // Mobile redirect logic - if user accesses this page on mobile, redirect to mobile version
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const nikFromUrl = urlParams.get('nik');
    
    if (isMobileDevice() && nikFromUrl) {
      window.location.href = `/workspace/mobile-driver?nik=${nikFromUrl}`;
      return;
    }
  }, []);

  const [nik, setNik] = useState("");
  const [debouncedNik, setDebouncedNik] = useState("");
  const [searchEmployee, setSearchEmployee] = useState<Employee | null>(null);
  const [suggestions, setSuggestions] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'roster' | 'leave' | 'simper'>('roster');
  const [isSearching, setIsSearching] = useState(false);

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

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNik(nik);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [nik]);

  // Auto-populate NIK dari URL parameter (untuk QR scan redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scannedNik = urlParams.get('nik');
    
    if (scannedNik && employees && Array.isArray(employees) && employees.length > 0) {
      setNik(scannedNik);
      // Jangan hapus URL parameter agar stabil untuk mobile scanning
      // Biarkan parameter NIK tetap di URL untuk stabilitas
    }
  }, [employees]);

  // Auto search when debounced value changes
  useEffect(() => {
    if (debouncedNik.trim() && employees) {
      handleSearch();
    } else {
      setSuggestions([]);
      setSearchEmployee(null);
    }
  }, [debouncedNik, employees]);

  const handleSearch = useCallback(() => {
    if (!debouncedNik.trim()) return;
    
    setIsSearching(true);
    const employeeList = employees as Employee[] || [];
    const searchTerm = debouncedNik.trim().toLowerCase();
    
    const employee = employeeList.find((emp: Employee) => {
      // Cari berdasarkan NIK (exact match)
      if (emp.id.toLowerCase() === searchTerm) return true;
      
      // Cari berdasarkan nama (partial match)
      if (emp.name.toLowerCase().includes(searchTerm)) return true;
      
      // Cari berdasarkan posisi jika ada
      if (emp.position && emp.position.toLowerCase().includes(searchTerm)) return true;
      
      return false;
    });
    
    // Generate suggestions for partial matches
    if (!employee && searchTerm.length > 2) {
      const matchedEmployees = employeeList.filter((emp: Employee) => {
        return emp.name.toLowerCase().includes(searchTerm) ||
               emp.id.toLowerCase().includes(searchTerm) ||
               (emp.position && emp.position.toLowerCase().includes(searchTerm));
      }).slice(0, 5);
      setSuggestions(matchedEmployees);
    } else {
      setSuggestions([]);
    }
    
    setSearchEmployee(employee || null);
    setIsSearching(false);
  }, [debouncedNik, employees]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Driver View</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Employee Data & Monitoring System</p>
            </div>
          </div>
        </div>

        {/* Modern Loading State */}
        {employeesLoading && (
          <Card className="border-0 shadow-sm bg-white dark:bg-gray-800">
            <CardContent className="p-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-700 dark:text-gray-300 font-medium">Loading employee data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clean Search Section */}
        {!employeesLoading && (
          <Card className="border-0 shadow-sm bg-white dark:bg-gray-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                Search Employee
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Enter NIK or name to view employee roster and leave data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by NIK, name, or position..."
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  data-testid="input-nik-search"
                  className="pl-12 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-base"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-spin text-blue-500" />
                )}
                
                {/* Clean Suggestions Dropdown - Fixed positioning */}
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 mt-1">
                    {suggestions.map((emp) => (
                      <div
                        key={emp.id}
                        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 first:rounded-t-lg last:rounded-b-lg"
                        onClick={() => {
                          setNik(emp.name);
                          setSearchEmployee(emp);
                          setSuggestions([]);
                        }}
                        data-testid={`suggestion-item-${emp.id}`}
                      >
                        <div className="font-semibold text-gray-900 dark:text-white">{emp.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          NIK: {emp.id} • {emp.position} • {emp.department}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {nik && !searchEmployee && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Employee "{nik}" not found</p>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">Try searching with NIK, name, or position</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Clean Employee Information Card */}
        {searchEmployee && (
          <Card className="border-0 shadow-sm bg-white dark:bg-gray-800">
            <CardHeader className="pb-4">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {searchEmployee.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400 text-base mt-1">
                    NIK: {searchEmployee.id} • {searchEmployee.position}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs">{searchEmployee.department}</Badge>
                    <Badge variant="outline" className="text-xs">{searchEmployee.investorGroup}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Clean Tab Navigation */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-1 mx-6 mb-6">
              <div className="grid grid-cols-3 gap-1">
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('roster')}
                  className={`h-12 rounded-lg ${
                    activeTab === 'roster' 
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-600/50'
                  }`}
                  data-testid="tab-roster"
                  role="tab"
                  aria-selected={activeTab === 'roster'}
                >
                  <Calendar className="h-5 w-5 mr-2" />
                  Work Schedule
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('leave')}
                  className={`h-12 rounded-lg ${
                    activeTab === 'leave' 
                      ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-600/50'
                  }`}
                  data-testid="tab-leave"
                  role="tab"
                  aria-selected={activeTab === 'leave'}
                >
                  <MapPin className="h-5 w-5 mr-2" />
                  Leave History
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('simper')}
                  className={`h-12 rounded-lg ${
                    activeTab === 'simper' 
                      ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-600/50'
                  }`}
                  data-testid="tab-simper"
                  role="tab"
                  aria-selected={activeTab === 'simper'}
                >
                  <Shield className="h-5 w-5 mr-2" />
                  SIMPER
                </Button>
              </div>
            </div>

            {/* Tab Content */}
            <CardContent className="px-6 pb-6">
              {/* Clean Roster Tab */}
              {activeTab === 'roster' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                      Work Schedule
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {employeeRoster.length} schedules found
                    </Badge>
                  </div>

                  {rosterLoading ? (
                    <div className="text-center py-12">
                      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">Loading schedule...</p>
                    </div>
                  ) : employeeRoster.length > 0 ? (
                    <div className="grid gap-3">
                      {employeeRoster
                        .sort((a: RosterSchedule, b: RosterSchedule) => 
                          new Date(b.date).getTime() - new Date(a.date).getTime()
                        )
                        .slice(0, 10)
                        .map((roster: RosterSchedule) => (
                          <div key={roster.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-700/30 hover:bg-gray-100/70 dark:hover:bg-gray-600/50 transition-colors" data-testid={`roster-item-${roster.id}`}>
                            <div className="flex justify-between items-start">
                              <div className="space-y-2">
                                <p className="text-base font-semibold text-gray-900 dark:text-white">
                                  {format(new Date(roster.date), "dd MMM yyyy")}
                                </p>
                                <div className="flex gap-2">
                                  <Badge className={`${getShiftBadgeColor(roster.shift)} px-2 py-1 rounded-md text-xs font-medium`}>
                                    {roster.shift}
                                  </Badge>
                                  <Badge className={`${getStatusBadgeColor(roster.status)} px-2 py-1 rounded-md text-xs font-medium`}>
                                    {roster.status}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right space-y-1">
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <Clock className="h-4 w-4" />
                                  <span className="text-sm font-medium">{roster.startTime} - {roster.endTime}</span>
                                </div>
                                {roster.jamTidur && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Sleep: {roster.jamTidur}
                                  </p>
                                )}
                                <p className="text-xs text-gray-600 dark:text-gray-300">
                                  {roster.fitToWork}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">No schedule found</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">No work schedule available for this employee</p>
                    </div>
                  )}
                </div>
              )}

            {/* Leave Tab */}
            {activeTab === 'leave' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <MapPin className="h-7 w-7 mr-3 text-[#E53935]" />
                    Riwayat Cuti
                  </h3>
                  <Badge className="bg-green-100 text-green-800 px-4 py-2">
                    {employeeLeaves.length} Pengajuan Cuti
                  </Badge>
                </div>

                {leaveLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#E53935] mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300 font-semibold">Memuat data cuti...</p>
                  </div>
                ) : employeeLeaves.length > 0 ? (
                  <div className="grid gap-4">
                    {employeeLeaves
                      .sort((a: LeaveRequest, b: LeaveRequest) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )
                      .slice(0, 5)
                      .map((leave: LeaveRequest) => (
                        <div key={leave.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-200" data-testid={`leave-item-${leave.id}`}>
                          <div className="flex justify-between items-start">
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-8 bg-orange-500 rounded-full"></div>
                                <p className="text-2xl font-bold text-gray-800 dark:text-white">{leave.leaveType}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                                  {format(new Date(leave.startDate), "dd MMM yyyy")} - {format(new Date(leave.endDate), "dd MMM yyyy")}
                                </p>
                                {leave.reason && (
                                  <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                    <span className="font-semibold">Alasan:</span> {leave.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge className={getStatusBadgeColor(leave.status) + " px-4 py-2 text-sm font-bold"}>
                              {leave.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <MapPin className="h-20 w-20 text-gray-300 mx-auto mb-4" />
                    <p className="text-xl text-gray-500 font-semibold">Tidak ada data cuti ditemukan</p>
                    <p className="text-gray-400 mt-2">Belum ada pengajuan cuti yang terdaftar untuk karyawan ini</p>
                  </div>
                )}
              </div>
            )}

            {/* SIMPER Tab */}
            {activeTab === 'simper' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <Shield className="h-7 w-7 mr-3 text-[#E53935]" />
                    Data SIMPER Monitoring
                  </h3>
                </div>

                {simperLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#E53935] mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300 font-semibold">Memuat data SIMPER...</p>
                  </div>
                ) : simperData ? (
                  <div className="space-y-8">
                    {/* Employee Info */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-700">
                      <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                        <User className="h-6 w-6 mr-3 text-blue-600" />
                        Informasi Karyawan
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <span className="text-gray-600 dark:text-gray-300 text-lg">Nama:</span>
                          <span className="ml-3 font-bold text-xl text-gray-800 dark:text-white">{simperData.employeeName}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-300 text-lg">NIK:</span>
                          <span className="ml-3 font-bold text-xl text-gray-800 dark:text-white">{simperData.nik}</span>
                        </div>
                      </div>
                    </div>

                    {/* SIMPER Status Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* SIMPER BIB */}
                      <div className="bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-6 shadow-lg">
                        <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                          <div className="w-3 h-8 bg-blue-500 rounded-full mr-3"></div>
                          <Shield className="w-6 h-6 mr-3 text-blue-600" />
                          SIMPER BIB
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">Tanggal Expired:</span>
                            <span className="font-bold text-lg text-gray-800 dark:text-white">
                              {formatDateDD_MM_YYYY(simperData.simperBibExpiredDate)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">Monitoring Days:</span>
                            <span className="font-bold text-lg text-gray-800 dark:text-white">
                              {simperData.bibMonitoringDays !== null ? `${simperData.bibMonitoringDays} hari` : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">Status:</span>
                            <Badge className={getSimperStatusColor(simperData.bibStatus || 'Tidak Ada Data') + ' px-4 py-2 text-sm font-bold'}>
                              {simperData.bibStatus || 'Tidak Ada Data'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* SIMPER TIA */}
                      <div className="bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-700 rounded-xl p-6 shadow-lg">
                        <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                          <div className="w-3 h-8 bg-green-500 rounded-full mr-3"></div>
                          <Shield className="w-6 h-6 mr-3 text-green-600" />
                          SIMPER TIA
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">Tanggal Expired:</span>
                            <span className="font-bold text-lg text-gray-800 dark:text-white">
                              {formatDateDD_MM_YYYY(simperData.simperTiaExpiredDate)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">Monitoring Days:</span>
                            <span className="font-bold text-lg text-gray-800 dark:text-white">
                              {simperData.tiaMonitoringDays !== null ? `${simperData.tiaMonitoringDays} hari` : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">Status:</span>
                            <Badge className={getSimperStatusColor(simperData.tiaStatus || 'Tidak Ada Data') + ' px-4 py-2 text-sm font-bold'}>
                              {simperData.tiaStatus || 'Tidak Ada Data'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Alert untuk status kritis */}
                    {(simperData.bibStatus === 'Segera Perpanjang' || simperData.tiaStatus === 'Segera Perpanjang' ||
                      simperData.bibStatus === 'Mendekati Perpanjangan' || simperData.tiaStatus === 'Mendekati Perpanjangan') && (
                      <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-2 border-red-200 dark:border-red-700 rounded-xl p-6">
                        <div className="flex items-center mb-3">
                          <AlertTriangle className="w-7 h-7 text-red-600 mr-3" />
                          <span className="text-xl font-bold text-red-800 dark:text-red-200">Peringatan SIMPER</span>
                        </div>
                        <p className="text-red-700 dark:text-red-300 text-lg leading-relaxed">
                          Ada SIMPER yang akan expired dalam waktu dekat. Segera lakukan perpanjangan untuk menghindari masalah operasional.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Shield className="h-20 w-20 text-gray-300 mx-auto mb-4" />
                    <p className="text-xl text-gray-500 font-semibold">Data SIMPER tidak ditemukan</p>
                    <p className="text-gray-400 mt-2">Karyawan ini belum terdaftar dalam sistem monitoring SIMPER</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}