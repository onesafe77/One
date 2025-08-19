import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Calendar, Users, Clock } from "lucide-react";
import type { Employee, AttendanceRecord, RosterSchedule } from "@shared/schema";

interface AttendanceDetail {
  employeeId: string;
  name: string;
  position: string;
  shift: string;
  scheduledTime: string;
  actualTime?: string;
  jamTidur?: string;
  fitToWork?: string;
  status: 'present' | 'absent';
}

export default function AttendanceDetails() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Auto-refresh every 15 seconds for real-time updates
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    refetchInterval: 15000, // 15 seconds
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/attendance?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return response.json();
    },
    refetchInterval: 15000, // 15 seconds
  });

  const { data: roster = [] } = useQuery<RosterSchedule[]>({
    queryKey: ["/api/roster", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/roster?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch roster');
      return response.json();
    },
    refetchInterval: 15000, // 15 seconds
  });

  // Process data to create attendance details
  const attendanceDetails: AttendanceDetail[] = roster.map(scheduleItem => {
    const employee = employees.find(emp => emp.id === scheduleItem.employeeId);
    const attendanceRecord = attendance.find(att => att.employeeId === scheduleItem.employeeId);
    
    if (!employee) return null;

    return {
      employeeId: employee.id,
      name: employee.name,
      position: employee.position || 'Driver Dump Truck',
      shift: scheduleItem.shift,
      scheduledTime: `${scheduleItem.startTime} - ${scheduleItem.endTime}`,
      actualTime: attendanceRecord?.time,
      jamTidur: attendanceRecord?.jamTidur,
      fitToWork: attendanceRecord?.fitToWork || 'Fit To Work',
      status: attendanceRecord ? 'present' : 'absent'
    };
  }).filter(Boolean) as AttendanceDetail[];

  // Filter data based on search and filters
  const filteredDetails = attendanceDetails.filter(detail => {
    const matchesSearch = detail.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         detail.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShift = shiftFilter === "all" || detail.shift === shiftFilter;
    const matchesStatus = statusFilter === "all" || detail.status === statusFilter;
    
    return matchesSearch && matchesShift && matchesStatus;
  });

  // Calculate statistics
  const totalScheduled = attendanceDetails.length;
  const totalPresent = attendanceDetails.filter(d => d.status === 'present').length;
  const totalAbsent = totalScheduled - totalPresent;
  const attendanceRate = totalScheduled > 0 ? Math.round((totalPresent / totalScheduled) * 100) : 0;

  // Force refresh data
  const handleRefresh = () => {
    const { queryClient } = require("@/lib/queryClient");
    queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Detail Kehadiran Hari Ini
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Pantau kehadiran karyawan secara real-time
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          data-testid="refresh-button"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Dijadwalkan</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalScheduled}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Hadir</p>
                <p className="text-2xl font-bold text-green-600">{totalPresent}</p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Belum Hadir</p>
                <p className="text-2xl font-bold text-red-600">{totalAbsent}</p>
              </div>
              <Calendar className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tingkat Kehadiran</p>
                <p className="text-2xl font-bold text-blue-600">{attendanceRate}%</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-bold">%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Pencarian</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Tanggal
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                data-testid="date-picker"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Cari Karyawan
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nama atau NIK..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Filter Shift
              </label>
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger data-testid="shift-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Shift</SelectItem>
                  <SelectItem value="Shift 1">Shift 1</SelectItem>
                  <SelectItem value="Shift 2">Shift 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Filter Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="present">Hadir</SelectItem>
                  <SelectItem value="absent">Belum Hadir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Kehadiran ({filteredDetails.length} karyawan)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Nama</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Shift</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Jam</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetails.map((detail, index) => (
                  <tr 
                    key={detail.employeeId}
                    className={`border-b border-gray-100 dark:border-gray-800 ${
                      index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-950'
                    }`}
                    data-testid={`attendance-row-${detail.employeeId}`}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {detail.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {detail.position}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        {detail.shift}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        {detail.status === 'present' ? (
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {detail.actualTime}
                            </div>
                            {detail.jamTidur && (
                              <div className="text-gray-500 dark:text-gray-400">
                                Tidur: {detail.jamTidur}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 dark:text-gray-400">
                            {detail.scheduledTime}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <Badge 
                          variant={detail.status === 'present' ? 'default' : 'destructive'}
                          className={detail.status === 'present' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                        >
                          {detail.status === 'present' ? 'Hadir' : 'Belum Hadir'}
                        </Badge>
                        {detail.status === 'present' && detail.fitToWork && (
                          <Badge 
                            variant="outline" 
                            className="text-xs text-blue-600 border-blue-200"
                          >
                            {detail.fitToWork}
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredDetails.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Tidak ada data kehadiran yang ditemukan
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto-refresh indicator */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <Clock className="inline-block w-4 h-4 mr-1" />
        Data diperbarui otomatis setiap 15 detik
      </div>
    </div>
  );
}