import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, Calendar, Clock, MapPin, ChevronDown, ChevronUp, Bell, AlertTriangle, TrendingUp, Activity, CheckCircle, XCircle, Shield, Loader2 } from "lucide-react";
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
  // Get NIK from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const nikFromUrl = urlParams.get('nik') || "";
  
  const [nik, setNik] = useState(nikFromUrl);
  const [debouncedNik, setDebouncedNik] = useState(nikFromUrl);
  const [searchEmployee, setSearchEmployee] = useState<Employee | null>(null);
  const [suggestions, setSuggestions] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'roster' | 'leave' | 'monitoring' | 'simper'>('roster');
  const [isSearching, setIsSearching] = useState(false);
  const [urlSearchCompleted, setUrlSearchCompleted] = useState(false); // Flag to prevent duplicate search
  
  // Query client for prefetching
  const queryClient = useQueryClient();

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

  // Query untuk leave requests berdasarkan employee yang dipilih - OPTIMIZED WITH PARAMETERS
  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ["/api/leave", { employeeId: searchEmployee?.id }],
    queryFn: async () => {
      if (!searchEmployee?.id) return [];
      const response = await fetch(`/api/leave?employeeId=${searchEmployee.id}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch leave data');
      return response.json();
    },
    enabled: !!searchEmployee && activeTab === 'leave', // Only load when leave tab active
    staleTime: 3 * 60 * 1000, // 3 minutes cache
  });

  // Query untuk monitoring data - CONSOLIDATED untuk performance
  const { data: monitoringData, isLoading: monitoringLoading } = useQuery({
    queryKey: ["/api/leave-monitoring/summary", { employeeId: searchEmployee?.id }],
    queryFn: async () => {
      if (!searchEmployee?.id) return null;
      
      // For now, we'll make parallel calls but in future this should be a single endpoint
      const [upcomingRes, historyRes, pendingRes, rosterMonitoringRes] = await Promise.all([
        fetch("/api/leave-monitoring/upcoming").then(r => r.ok ? r.json() : []),
        fetch("/api/leave-monitoring/history").then(r => r.ok ? r.json() : []),
        fetch("/api/leave/pending-from-monitoring").then(r => r.ok ? r.json() : []),
        fetch("/api/leave-roster-monitoring").then(r => r.ok ? r.json() : [])
      ]);
      
      // Filter and find employee-specific data
      const employeeMonitoring = rosterMonitoringRes.find(
        (item: LeaveRosterMonitoring) => item.nik === searchEmployee.id
      ) || null;
      
      return {
        upcoming: upcomingRes,
        history: historyRes,
        pending: pendingRes,
        employeeMonitoring
      };
    },
    enabled: !!searchEmployee && activeTab === 'monitoring', // Only load when monitoring tab active
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });

  // Extract monitoring data from consolidated response
  const upcomingLeaves = monitoringData?.upcoming || [];
  const leaveHistory = monitoringData?.history || [];
  const pendingLeaves = monitoringData?.pending || [];
  const employeeMonitoring = monitoringData?.employeeMonitoring || null;

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

  // Auto search when debounced value changes - SKIP if URL search already completed
  useEffect(() => {
    // Skip debounced search if URL search was already completed for this exact value
    if (urlSearchCompleted && debouncedNik === nikFromUrl) {
      return;
    }
    
    if (debouncedNik.trim() && employees) {
      handleSearchWithNik(debouncedNik);
    } else {
      setSuggestions([]);
      setSearchEmployee(null);
    }
  }, [debouncedNik, employees, urlSearchCompleted, nikFromUrl]);

  const handleSearchWithNik = useCallback((nikValue: string) => {
    if (!nikValue.trim()) return;
    
    setIsSearching(true);
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
    
    // Generate suggestions for partial matches
    if (!employee && searchTerm.length > 2) {
      const matchedEmployees = employeeList.filter((emp: Employee) => {
        return emp.name.toLowerCase().includes(searchTerm) ||
               emp.id.toLowerCase().includes(searchTerm) ||
               (emp.position && emp.position.toLowerCase().includes(searchTerm));
      }).slice(0, 3); // Limit untuk mobile
      setSuggestions(matchedEmployees);
    } else {
      setSuggestions([]);
    }
    
    if (employee) {
      console.log('✅ Employee found:', employee.name, employee.id);
    } else {
      console.log('❌ No employee found for:', nikValue);
    }
    
    setSearchEmployee(employee || null);
    setIsSearching(false);
  }, [employees]);

  // PREFETCH related data after employee selection for instant tab switching
  useEffect(() => {
    if (searchEmployee?.id) {
      console.log('🚀 Prefetching data for employee:', searchEmployee.name);
      
      // Prefetch roster data
      queryClient.prefetchQuery({
        queryKey: ["/api/roster", { employeeId: searchEmployee.id }],
        queryFn: async () => {
          const response = await fetch(`/api/roster?employeeId=${searchEmployee.id}`);
          if (!response.ok) throw new Error('Failed to fetch roster');
          return response.json();
        },
        staleTime: 5 * 60 * 1000,
      });

      // Prefetch leave data
      queryClient.prefetchQuery({
        queryKey: ["/api/leave", { employeeId: searchEmployee.id }],
        queryFn: async () => {
          const response = await fetch(`/api/leave?employeeId=${searchEmployee.id}&limit=50`);
          if (!response.ok) throw new Error('Failed to fetch leave data');
          return response.json();
        },
        staleTime: 3 * 60 * 1000,
      });

      // Prefetch SIMPER data
      queryClient.prefetchQuery({
        queryKey: ["/api/simper-monitoring/nik", searchEmployee.id],
        queryFn: async () => {
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
        staleTime: 5 * 60 * 1000,
      });

      console.log('✅ Prefetch initiated for all employee data');
    }
  }, [searchEmployee, queryClient]);

  // Auto-search when NIK from URL is present and employees are loaded - ONE TIME ONLY
  useEffect(() => {
    console.log('🚀 Mobile Driver View loaded with nikFromUrl:', nikFromUrl);
    
    if (nikFromUrl && employees && Array.isArray(employees) && employees.length > 0 && !urlSearchCompleted) {
      console.log('📱 Auto-searching for employee from URL (ONE-TIME):', nikFromUrl);
      // Immediate search - no delay needed
      handleSearchWithNik(nikFromUrl);
      // Auto set to roster tab for quick access
      setActiveTab('roster');
      // Mark URL search as completed to prevent duplicate
      setUrlSearchCompleted(true);
    }
  }, [employees, nikFromUrl, handleSearchWithNik, urlSearchCompleted]); // Depend on employees so it runs when data is loaded

  const handleSearch = () => {
    handleSearchWithNik(nik);
  };

  const employeeRoster = (rosterData as RosterSchedule[]) || [];
  // Leave data is already filtered by employeeId from backend, no need for client-side filtering
  const employeeLeaves = (leaveData as LeaveRequest[]) || [];

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Clean Modern Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Driver View</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Employee Monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-md mx-auto">
        {/* Modern Loading State */}
        {employeesLoading && (
          <Card className="border-0 shadow-sm bg-white dark:bg-gray-800">
            <CardContent className="p-6">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Loading data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clean Search Section */}
        {!employeesLoading && (
          <Card className="border-0 shadow-sm bg-white dark:bg-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Search Employee
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                Enter NIK or name to view employee data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by NIK or name..."
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                  data-testid="input-mobile-nik-search"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                )}
                
                {/* Clean Suggestions */}
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 mt-1">
                    {suggestions.map((emp) => (
                      <div
                        key={emp.id}
                        className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        onClick={() => {
                          setNik(emp.name);
                          setSearchEmployee(emp);
                          setSuggestions([]);
                        }}
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{emp.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {emp.id} • {emp.position}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {nik && !searchEmployee && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Employee "{nik}" not found</p>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">Try searching with NIK or full name</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Clean Employee Info Card */}
        {searchEmployee && !employeesLoading && (
          <>
            <Card className="border-0 shadow-sm bg-white dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {searchEmployee.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">NIK: {searchEmployee.id}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Position</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{searchEmployee.position}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Department</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{searchEmployee.department}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Investor Group</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{searchEmployee.investorGroup}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clean Tab Navigation */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-4 gap-1">
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('roster')}
                  className={`flex flex-col items-center justify-center h-16 rounded-lg ${
                    activeTab === 'roster' 
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Calendar className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">Roster</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('leave')}
                  className={`flex flex-col items-center justify-center h-16 rounded-lg ${
                    activeTab === 'leave' 
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <MapPin className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">Leave</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('monitoring')}
                  className={`flex flex-col items-center justify-center h-16 rounded-lg ${
                    activeTab === 'monitoring' 
                      ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Bell className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">Monitor</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('simper')}
                  className={`flex flex-col items-center justify-center h-16 rounded-lg ${
                    activeTab === 'simper' 
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Shield className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">SIMPER</span>
                </Button>
              </div>
            </div>

            {/* Tab Content - Roster */}
            {activeTab === 'roster' && (
              <Card className="border-0 shadow-sm bg-white dark:bg-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Work Schedule
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                    Schedule for {searchEmployee.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {rosterLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">Loading schedule...</p>
                    </div>
                  ) : employeeRoster.length > 0 ? (
                    <div className="space-y-3">
                      {employeeRoster
                        .sort((a: RosterSchedule, b: RosterSchedule) => 
                          new Date(b.date).getTime() - new Date(a.date).getTime()
                        )
                        .slice(0, 10)
                        .map((roster: RosterSchedule) => (
                          <div key={roster.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-700/30">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-semibold text-base text-gray-900 dark:text-white">
                                  {format(new Date(roster.date), "dd MMM yyyy")}
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <Badge className={`${getShiftBadgeColor(roster.shift)} px-2 py-1 rounded-md text-xs font-medium`}>
                                    {roster.shift}
                                  </Badge>
                                  <Badge className={`${getStatusBadgeColor(roster.status)} px-2 py-1 rounded-md text-xs font-medium`}>
                                    {roster.status}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <Clock className="h-4 w-4" />
                                  <span className="text-sm font-medium">{roster.startTime} - {roster.endTime}</span>
                                </div>
                                {roster.jamTidur && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">No schedule found</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">No work schedule available for this employee</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab Content - Leave */}
            {activeTab === 'leave' && (
              <Card className="border-0 shadow-sm bg-white dark:bg-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Leave History
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                    Leave requests for {searchEmployee.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {leaveLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">Loading leave data...</p>
                    </div>
                  ) : employeeLeaves.length > 0 ? (
                    <div className="space-y-3">
                      {employeeLeaves
                        .sort((a: LeaveRequest, b: LeaveRequest) => 
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                        )
                        .slice(0, 5)
                        .map((leave: LeaveRequest) => (
                          <div key={leave.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-700/30">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-semibold text-base text-gray-900 dark:text-white mb-1">{leave.leaveType}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  {format(new Date(leave.startDate), "dd MMM yyyy")} - {format(new Date(leave.endDate), "dd MMM yyyy")}
                                </p>
                                {leave.reason && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Reason:</span> {leave.reason}
                                  </p>
                                )}
                              </div>
                              <Badge className={`${getStatusBadgeColor(leave.status)} px-2 py-1 rounded-md text-xs font-medium`}>
                                {leave.status === 'approved' ? 'Approved' : 
                                 leave.status === 'rejected' ? 'Rejected' : 'Pending'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MapPin className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">No leave requests found</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">No leave history available for this employee</p>
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