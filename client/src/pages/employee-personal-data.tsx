import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, User, Clock, Heart, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import type { Employee, RosterSchedule, LeaveRequest } from "@shared/schema";

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
    queryKey: ["/api/roster"],
    enabled: !!employeeId,
  });

  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ["/api/leave"],
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

  // Calculate working days from roster - count the number of roster entries
  const calculateWorkingDays = () => {
    return employeeRoster.length;
  };

  const totalWorkingDays = calculateWorkingDays();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Employee Info */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-full">
                  <User className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">{employee.name}</CardTitle>
                  <p className="text-gray-600 dark:text-gray-400">NIK: {employee.id}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">{employee.position}</Badge>
                    <Badge variant="outline">{employee.department}</Badge>
                    {employee.nomorLambung && (
                      <Badge variant="outline">{employee.nomorLambung}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                size="sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Hari Kerja</p>
                  <p className="text-2xl font-bold">{totalWorkingDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Jadwal Roster</p>
                  <p className="text-2xl font-bold">{employeeRoster.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pengajuan Cuti</p>
                  <p className="text-2xl font-bold">{employeeLeave.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Data Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Detail Data Pribadi</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="roster" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="roster">Data Roster</TabsTrigger>
                <TabsTrigger value="leave">Data Cuti</TabsTrigger>
              </TabsList>
              
              <TabsContent value="roster" className="mt-6">
                {rosterLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Memuat data roster...</p>
                  </div>
                ) : employeeRoster.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Belum ada jadwal roster</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {employeeRoster.map((roster: RosterSchedule) => (
                      <Card key={roster.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                            <div>
                              <p className="font-medium">{format(new Date(roster.date), "dd MMMM yyyy")}</p>
                              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                <span>Shift: {roster.shift}</span>
                                <span>Status: {roster.status}</span>
                              </div>
                            </div>
                            <Badge 
                              variant={roster.shift === 'Shift 1' ? 'default' : 'secondary'}
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
                  <div className="text-center py-8">
                    <p className="text-gray-500">Belum ada pengajuan cuti</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {employeeLeave.map((leave: LeaveRequest) => (
                      <Card key={leave.id} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{leave.leaveType}</p>
                              <Badge 
                                variant={
                                  leave.status === 'approved' ? 'default' :
                                  leave.status === 'rejected' ? 'destructive' : 'secondary'
                                }
                              >
                                {leave.status === 'approved' ? 'Disetujui' :
                                 leave.status === 'rejected' ? 'Ditolak' : 'Pending'}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              <p>Tanggal: {format(new Date(leave.startDate), "dd MMM yyyy")} - {format(new Date(leave.endDate), "dd MMM yyyy")}</p>
                              {leave.reason && <p>Alasan: {leave.reason}</p>}
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
      </div>
    </div>
  );
}