import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, Calendar, Clock, MapPin } from "lucide-react";
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

export default function DriverView() {
  const [nik, setNik] = useState("");
  const [searchEmployee, setSearchEmployee] = useState<Employee | null>(null);

  // Query untuk mencari employee berdasarkan NIK
  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
    enabled: true,
  });

  // Query untuk roster berdasarkan employee yang dipilih
  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["/api/roster"],
    enabled: !!searchEmployee,
  });

  // Query untuk leave requests berdasarkan employee yang dipilih
  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ["/api/leave"],
    enabled: !!searchEmployee,
  });

  const handleSearch = () => {
    if (!nik.trim()) return;
    
    const employeeList = employees as Employee[] || [];
    const employee = employeeList.find((emp: Employee) => 
      emp.id === nik.trim() || 
      emp.name.toLowerCase().includes(nik.trim().toLowerCase())
    );
    
    setSearchEmployee(employee || null);
  };

  const rosterList = rosterData as RosterSchedule[] || [];
  const employeeRoster = rosterList.filter((roster: RosterSchedule) => 
    roster.employeeId === searchEmployee?.id
  );

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
            <Input
              placeholder="Masukkan NIK atau nama karyawan..."
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              data-testid="input-nik-search"
            />
            <Button onClick={handleSearch} data-testid="button-search-employee">
              <Search className="h-4 w-4 mr-2" />
              Cari
            </Button>
          </div>
          
          {nik && !searchEmployee && (
            <p className="text-red-500 text-sm">Karyawan dengan NIK "{nik}" tidak ditemukan</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Nomor Lambung</p>
                <p className="font-semibold">{searchEmployee.nomorLambung}</p>
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
    </div>
  );
}