import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, User, Clock, Heart, ArrowLeft, TrendingUp, AlertCircle } from "lucide-react";
import { format, addDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Employee, RosterSchedule, LeaveRequest, LeaveRosterMonitoring } from "@shared/schema";

interface EmployeePersonalDataProps {
  employeeId: string;
}

export default function EmployeePersonalData() {
  const [employeeId, setEmployeeId] = useState<string>("");

  useEffect(() => {
    // Get employee ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('employeeId');
    if (id) {
      setEmployeeId(id);
    }
  }, []);

  const { data: allEmployees, isLoading: employeeLoading } = useQuery({
    queryKey: ["/api/employees"],
    enabled: !!employeeId,
  });

  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["/api/roster", employeeId],
    queryFn: () => fetch(`/api/roster?employeeId=${employeeId}`).then(res => res.json()),
    enabled: !!employeeId,
  });

  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ["/api/leave"],
    enabled: !!employeeId,
  });

  const { data: leaveMonitoringData, isLoading: monitoringLoading } = useQuery({
    queryKey: ["/api/leave-roster-monitoring"],
    enabled: !!employeeId,
  });

  const employee = Array.isArray(allEmployees) ? allEmployees.find((emp: Employee) => emp.id === employeeId) : undefined;

  if (!employeeId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-500">Loading employee data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (employeeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Memuat data karyawan...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500">Data karyawan tidak ditemukan</p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="mt-4"
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter roster data for this employee
  const employeeRoster = Array.isArray(rosterData) ? rosterData.filter((roster: RosterSchedule) => 
    roster.employeeId === employeeId
  ) : [];

  // Filter leave data for this employee
  const employeeLeave = Array.isArray(leaveData) ? leaveData.filter((leave: LeaveRequest) => 
    leave.employeeId === employeeId
  ) : [];

  // Filter monitoring data for this employee
  const employeeMonitoring = Array.isArray(leaveMonitoringData) ? leaveMonitoringData.find((monitoring: LeaveRosterMonitoring) => 
    monitoring.nik === employeeId
  ) : undefined;

  // Calculate working days from roster - count the number of roster entries
  const calculateWorkingDays = () => {
    return employeeRoster.length;
  };

  const totalWorkingDays = calculateWorkingDays();

  // Get status color for monitoring status
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Aktif": return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "Menunggu Cuti": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "Sedang Cuti": return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "Selesai Cuti": return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-3 md:p-6">
      <div className="max-w-md mx-auto md:max-w-4xl space-y-4 md:space-y-6">
        {/* Mobile Header with Employee Info */}
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3 md:space-x-4">
                <div className="bg-gradient-to-r from-red-500 to-pink-500 p-3 rounded-full shadow-lg">
                  <User className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">{employee.name}</CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">NIK: {employee.id}</p>
                  <div className="flex flex-wrap gap-1 md:gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{employee.position}</Badge>
                    <Badge variant="outline" className="text-xs">{employee.department}</Badge>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden md:inline ml-2">Kembali</span>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4 md:pt-6">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                <div>
                  <p className="text-xs md:text-sm opacity-90">Total Hari Kerja</p>
                  <p className="text-lg md:text-2xl font-bold">{totalWorkingDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4 md:pt-6">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 md:w-5 md:h-5" />
                <div>
                  <p className="text-xs md:text-sm opacity-90">Jadwal Roster</p>
                  <p className="text-lg md:text-2xl font-bold">{employeeRoster.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-4 md:pt-6">
              <div className="flex items-center space-x-2">
                <Heart className="w-4 h-4 md:w-5 md:h-5" />
                <div>
                  <p className="text-xs md:text-sm opacity-90">Pengajuan Cuti</p>
                  <p className="text-lg md:text-2xl font-bold">{employeeLeave.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monitoring Cuti Card */}
          <Card className="border-0 shadow-md bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4 md:pt-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                <div>
                  <p className="text-xs md:text-sm opacity-90">Monitoring Hari</p>
                  <p className="text-lg md:text-2xl font-bold">
                    {employeeMonitoring?.monitoringDays || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monitoring Cuti Detail Card */}
        {employeeMonitoring && (
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-purple-600" />
                <span>Monitoring Cuti</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cuti Terakhir</p>
                  <p className="font-semibold text-sm">
                    {employeeMonitoring.lastLeaveDate 
                      ? format(new Date(employeeMonitoring.lastLeaveDate), "dd MMM yyyy", { locale: localeId })
                      : "Belum Ada"}
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cuti Berikutnya</p>
                  <p className="font-semibold text-sm">
                    {employeeMonitoring.nextLeaveDate 
                      ? format(new Date(employeeMonitoring.nextLeaveDate), "dd MMM yyyy", { locale: localeId })
                      : "Belum Terjadwal"}
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status</p>
                  <Badge className={`text-xs ${getStatusColor(employeeMonitoring.status)}`}>
                    {employeeMonitoring.status}
                  </Badge>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-300 mb-1">
                  Opsi Cuti: {employeeMonitoring.leaveOption} hari kerja
                </p>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min((employeeMonitoring.monitoringDays / parseInt(employeeMonitoring.leaveOption)) * 100, 100)}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  {employeeMonitoring.monitoringDays} / {employeeMonitoring.leaveOption} hari
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Data Tabs */}
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Detail Data Pribadi</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="roster" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12 bg-gray-100 dark:bg-gray-700">
                <TabsTrigger value="roster" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                  Data Roster
                </TabsTrigger>
                <TabsTrigger value="leave" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                  Data Cuti
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="roster" className="mt-6">
                {rosterLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Memuat data roster...</p>
                  </div>
                ) : employeeRoster.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">Belum ada jadwal roster</p>
                    <p className="text-gray-400 text-sm">Data roster akan muncul setelah dijadwalkan</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {employeeRoster.map((roster: RosterSchedule) => (
                      <Card key={roster.id} className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {format(new Date(roster.date), "dd MMMM yyyy", { locale: localeId })}
                              </p>
                              <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded-full text-xs">
                                  {roster.shift}
                                </span>
                                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded-full text-xs">
                                  {roster.status}
                                </span>
                              </div>
                            </div>
                            <Badge 
                              variant={roster.shift === 'Shift 1' ? 'default' : 'secondary'}
                              className="shrink-0"
                            >
                              {roster.shift}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="leave" className="mt-6">
                {leaveLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Memuat data cuti...</p>
                  </div>
                ) : employeeLeave.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">Belum ada pengajuan cuti</p>
                    <p className="text-gray-400 text-sm">Riwayat cuti akan muncul setelah mengajukan</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {employeeLeave.map((leave: LeaveRequest) => (
                      <Card key={leave.id} className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-gray-900 dark:text-white">{leave.leaveType}</p>
                              <Badge 
                                variant={
                                  leave.status === 'approved' ? 'default' :
                                  leave.status === 'rejected' ? 'destructive' : 'secondary'
                                }
                                className="shrink-0"
                              >
                                {leave.status === 'approved' ? 'Disetujui' :
                                 leave.status === 'rejected' ? 'Ditolak' : 'Pending'}
                              </Badge>
                            </div>
                            <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                📅 {format(new Date(leave.startDate), "dd MMM yyyy", { locale: localeId })} - {format(new Date(leave.endDate), "dd MMM yyyy", { locale: localeId })}
                              </p>
                              {leave.reason && (
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  💭 {leave.reason}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Developer Info Footer */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardContent className="p-4 text-center">
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                💻 Sistem Dibuat Oleh
              </p>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                Bagus Andyka Firmansyah
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                HSE Data Evaluator GECL
              </p>
              <div className="w-16 h-0.5 bg-blue-500 mx-auto rounded-full"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}