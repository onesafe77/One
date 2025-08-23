import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, Calendar, Clock, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface Employee {
  id: string;
  name: string;
  position: string;
  nomorLambung: string;
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

export default function MobileDriverView() {
  const [nik, setNik] = useState("");
  const [searchEmployee, setSearchEmployee] = useState<Employee | null>(null);
  const [suggestions, setSuggestions] = useState<Employee[]>([]);
  const [showRoster, setShowRoster] = useState(true);
  const [showLeave, setShowLeave] = useState(false);

  // Auto-focus untuk mobile
  useEffect(() => {
    // Detect if accessed via QR scan (check URL params)
    const urlParams = new URLSearchParams(window.location.search);
    const scannedNik = urlParams.get('nik');
    if (scannedNik) {
      setNik(scannedNik);
      handleSearchWithNik(scannedNik);
    }
  }, []);

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

  const handleSearchWithNik = (nikValue: string) => {
    if (!nikValue.trim()) return;
    
    const employeeList = employees as Employee[] || [];
    const searchTerm = nikValue.trim().toLowerCase();
    
    const employee = employeeList.find((emp: Employee) => {
      if (emp.id.toLowerCase() === searchTerm) return true;
      if (emp.name.toLowerCase().includes(searchTerm)) return true;
      if (emp.nomorLambung && emp.nomorLambung.toLowerCase().includes(searchTerm)) return true;
      if (emp.position && emp.position.toLowerCase().includes(searchTerm)) return true;
      return false;
    });
    
    setSearchEmployee(employee || null);
    setSuggestions([]);
  };

  const handleSearch = () => {
    handleSearchWithNik(nik);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header */}
      <div className="bg-primary-600 dark:bg-primary-700 text-white p-4 sticky top-0 z-50">
        <div className="text-center">
          <h1 className="text-xl font-bold">Driver View</h1>
          <p className="text-sm text-primary-100">Data Karyawan</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search Section - Mobile Optimized */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5" />
              Cari Karyawan
            </CardTitle>
            <CardDescription className="text-sm">
              Scan barcode atau masukkan NIK untuk melihat data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                             (emp.nomorLambung && emp.nomorLambung.toLowerCase().includes(searchTerm)) ||
                             (emp.position && emp.position.toLowerCase().includes(searchTerm));
                    }).slice(0, 3); // Limit untuk mobile
                    
                    setSuggestions(matchedEmployees);
                  } else {
                    setSuggestions([]);
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="text-base" // Better for mobile
                data-testid="input-mobile-nik-search"
              />
              
              {/* Mobile Suggestions */}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 mt-1">
                  {suggestions.map((emp) => (
                    <div
                      key={emp.id}
                      className="px-3 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      onClick={() => {
                        setNik(emp.name);
                        setSearchEmployee(emp);
                        setSuggestions([]);
                      }}
                    >
                      <div className="font-medium text-sm">{emp.name}</div>
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
              className="w-full"
              data-testid="button-mobile-search"
            >
              <Search className="h-4 w-4 mr-2" />
              Cari Data
            </Button>
            
            {nik && !searchEmployee && (
              <div className="text-red-500 text-sm text-center">
                <p>Karyawan "{nik}" tidak ditemukan</p>
                <p className="text-xs text-gray-500 mt-1">Coba cari dengan NIK atau nama lengkap</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Info - Mobile Card */}
        {searchEmployee && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Informasi Karyawan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">NIK</p>
                    <p className="font-semibold" data-testid="text-mobile-employee-nik">{searchEmployee.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Nama</p>
                    <p className="font-semibold" data-testid="text-mobile-employee-name">{searchEmployee.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Posisi</p>
                    <p className="font-semibold">{searchEmployee.position}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">No. Lambung</p>
                    <p className="font-semibold">{searchEmployee.nomorLambung}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Department</p>
                    <p className="font-semibold">{searchEmployee.department}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Investor</p>
                    <p className="font-semibold">{searchEmployee.investorGroup}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Toggle Buttons untuk Mobile */}
        {searchEmployee && (
          <div className="flex gap-2">
            <Button
              variant={showRoster ? "default" : "outline"}
              onClick={() => {
                setShowRoster(true);
                setShowLeave(false);
              }}
              className="flex-1 text-sm"
            >
              <Calendar className="h-4 w-4 mr-1" />
              Jadwal Roster
            </Button>
            <Button
              variant={showLeave ? "default" : "outline"}
              onClick={() => {
                setShowRoster(false);
                setShowLeave(true);
              }}
              className="flex-1 text-sm"
            >
              <MapPin className="h-4 w-4 mr-1" />
              Riwayat Cuti
            </Button>
          </div>
        )}

        {/* Roster Data - Mobile */}
        {searchEmployee && showRoster && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Jadwal Roster Kerja
                </div>
              </CardTitle>
              <CardDescription className="text-sm">
                Daftar jadwal kerja untuk {searchEmployee.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rosterLoading ? (
                <p className="text-center py-4">Memuat data roster...</p>
              ) : employeeRoster.length > 0 ? (
                <div className="space-y-3">
                  {employeeRoster
                    .sort((a: RosterSchedule, b: RosterSchedule) => 
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .slice(0, 10)
                    .map((roster: RosterSchedule) => (
                      <div key={roster.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800" data-testid={`mobile-roster-item-${roster.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-sm">
                              {format(new Date(roster.date), "dd MMM yyyy")}
                            </p>
                            <div className="flex gap-1 mt-1">
                              <Badge className={`${getShiftBadgeColor(roster.shift)} text-xs`}>
                                {roster.shift}
                              </Badge>
                              <Badge variant="outline" className={`${getStatusBadgeColor(roster.status)} text-xs`}>
                                {roster.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right text-xs">
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
                <p className="text-center py-4 text-gray-500">Tidak ada data roster ditemukan</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Leave Data - Mobile */}
        {searchEmployee && showLeave && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Riwayat Cuti
              </CardTitle>
              <CardDescription className="text-sm">
                Daftar pengajuan cuti untuk {searchEmployee.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaveLoading ? (
                <p className="text-center py-4">Memuat data cuti...</p>
              ) : employeeLeaves.length > 0 ? (
                <div className="space-y-3">
                  {employeeLeaves
                    .sort((a: LeaveRequest, b: LeaveRequest) => 
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                    .slice(0, 5)
                    .map((leave: LeaveRequest) => (
                      <div key={leave.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800" data-testid={`mobile-leave-item-${leave.id}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{leave.leaveType}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {format(new Date(leave.startDate), "dd MMM yyyy")} - {format(new Date(leave.endDate), "dd MMM yyyy")}
                            </p>
                            {leave.reason && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Alasan: {leave.reason}
                              </p>
                            )}
                          </div>
                          <Badge className={`${getStatusBadgeColor(leave.status)} text-xs ml-2`}>
                            {leave.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center py-4 text-gray-500">Tidak ada data cuti ditemukan</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer info untuk mobile */}
        <div className="text-center text-xs text-gray-500 py-4 space-y-2">
          <p>Driver View - Read Only</p>
          <p>Data diperbarui secara real-time</p>
          
          {/* Developer Info */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 mx-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                💻 Pembuat Sistem
              </p>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                Bagus Andyka Firmansyah
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                HSE Data Evaluator GECL
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}