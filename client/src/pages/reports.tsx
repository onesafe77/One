import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generateAttendancePDF } from "@/lib/pdf-utils";
import { exportAttendanceToCSV, exportLeaveToCSV, exportEmployeesToCSV } from "@/lib/csv-utils";
import { useToast } from "@/hooks/use-toast";
import type { Employee, AttendanceRecord, LeaveRequest, RosterSchedule } from "@shared/schema";
import { Download, FileText, Calendar, Users, TrendingUp, RefreshCw, CheckCircle, BarChart3, Activity, Target, Zap, Shield, Filter } from "lucide-react";

export default function Reports() {
  console.log('🟢 Reports component loading...'); // Debug test
  
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState("attendance");
  const [format, setFormat] = useState("pdf");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  
  // Form fields for report header
  const [reportInfo, setReportInfo] = useState({
    perusahaan: "",
    namaPengawas: "",
    hari: new Date().toLocaleDateString('id-ID', { weekday: 'long' }),
    tanggal: new Date().toLocaleDateString('id-ID'),
    waktu: "",
    shift: "",
    tempat: "",
    diperiksaOleh: "",
    catatan: "",
    tandaTangan: null as File | string | null
  });
  const { toast } = useToast();

  // Real-time data refresh listener
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Enhanced auto-refresh for reports when roster data changes
    const startAutoRefresh = () => {
      intervalId = setInterval(async () => {
        console.log("🔄 Auto-refreshing report data...");
        const { queryClient } = await import("@/lib/queryClient");
        
        // Force refresh all report-related data
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
        queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
        queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
        queryClient.invalidateQueries({ queryKey: ["/api/leave-roster-monitoring"] });
      }, 30000); // Every 30 seconds
    };

    startAutoRefresh();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Check for roster updates
  const { data: updateStatus } = useQuery({
    queryKey: ["/api/report-update-status"],
    refetchInterval: 30000,
  });

  const handleExport = () => {
    setIsExporting(true);
    exportReport().finally(() => setIsExporting(false));
  };

  // Auto-refresh queries every 30 seconds for real-time report updates
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    refetchInterval: 30000, // 30 seconds
    refetchIntervalInBackground: true,
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", startDate],
    queryFn: async () => {
      const response = await fetch(`/api/attendance?date=${startDate}`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return response.json();
    },
    enabled: reportType === "attendance",
    refetchInterval: 30000, // 30 seconds
    refetchIntervalInBackground: true,
  });

  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave"],
    enabled: reportType === "leave",
    refetchInterval: 30000, // 30 seconds
  });

  const { data: roster = [] } = useQuery<RosterSchedule[]>({
    queryKey: ["/api/roster", startDate],
    queryFn: async () => {
      const response = await fetch(`/api/roster?date=${startDate}`);
      if (!response.ok) throw new Error('Failed to fetch roster');
      return response.json();
    },
    enabled: reportType === "attendance",
    refetchInterval: 30000, // 30 seconds
    refetchIntervalInBackground: true,
  });

  const exportReport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Silakan pilih periode tanggal",
        variant: "destructive",
      });
      return;
    }

    try {
      if (reportType === "attendance") {
        if (!employees || employees.length === 0) {
          toast({
            title: "Error",
            description: "Data karyawan tidak tersedia",
            variant: "destructive",
          });
          return;
        }

        // Force refresh data before generating report to ensure latest attendance data
        const { queryClient } = await import("@/lib/queryClient");
        
        console.log("Refreshing data before generating report...");
        
        // Force refresh all data
        await queryClient.refetchQueries({ queryKey: ["/api/attendance"] });
        await queryClient.refetchQueries({ queryKey: ["/api/roster"] });
        await queryClient.refetchQueries({ queryKey: ["/api/employees"] });
        
        // Get fresh data directly from server including leave monitoring and employees
        const [freshAttendance, freshRoster, freshLeaveMonitoring, freshEmployees] = await Promise.all([
          fetch(`/api/attendance?date=${startDate}`).then(res => res.json()),
          fetch(`/api/roster?date=${startDate}`).then(res => res.json()),
          fetch(`/api/leave-roster-monitoring`).then(res => res.json()),
          fetch(`/api/employees`).then(res => res.json())
        ]);

        console.log("Fresh attendance data:", freshAttendance);
        console.log("Fresh roster data:", freshRoster);
        console.log("Fresh employees data (for updated nomor lambung):", freshEmployees.filter((e: any) => e.nomorLambung !== 'SPARE').slice(0, 3));

        const filteredAttendance = freshAttendance.filter((record: any) => {
          return record.date >= startDate && record.date <= endDate;
        });

        // Validate required report information for PDF (both landscape and portrait)
        if (format === "pdf" || format === "pdf-portrait") {
          const requiredFields = [];
          if (!reportInfo.namaPengawas.trim()) requiredFields.push("Nama Pengawas");
          if (!reportInfo.waktu.trim()) requiredFields.push("Waktu");
          if (!reportInfo.shift.trim()) requiredFields.push("Shift");
          if (!reportInfo.tempat.trim()) requiredFields.push("Tempat");
          if (!reportInfo.diperiksaOleh.trim()) requiredFields.push("Diperiksa Oleh");
          
          if (requiredFields.length > 0) {
            toast({
              title: "Form Tidak Lengkap",
              description: `Mohon isi field berikut: ${requiredFields.join(", ")}`,
              variant: "destructive",
            });
            return;
          }

          // Convert signature file to base64 jika ada
          let processedReportInfo = { ...reportInfo };
          if (reportInfo.tandaTangan && reportInfo.tandaTangan instanceof File) {
            try {
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  // Remove data URL prefix (data:image/jpeg;base64,)
                  const base64String = result.split(',')[1];
                  resolve(`data:image/jpeg;base64,${base64String}`);
                };
                reader.onerror = reject;
                reader.readAsDataURL(reportInfo.tandaTangan as File);
              });
              processedReportInfo.tandaTangan = base64;
            } catch (error) {
              console.error('Error converting signature to base64:', error);
              // Keep original if conversion fails
            }
          }

          await generateAttendancePDF({
            employees: freshEmployees, // Use fresh employee data to show updated nomor lambung
            attendance: filteredAttendance,
            roster: freshRoster,
            leaveMonitoring: freshLeaveMonitoring,
            startDate,
            endDate,
            reportType: "attendance",
            shiftFilter,
            reportInfo: processedReportInfo, // Use processed reportInfo with base64 signature
            orientation: format === "pdf-portrait" ? "portrait" : "landscape" // Professional orientation
          });
          
          const orientationText = format === "pdf-portrait" ? "A4 Portrait" : "Landscape";
          toast({
            title: "Berhasil",
            description: `Laporan PDF ${orientationText} berhasil diunduh`,
          });
        } else {
          exportAttendanceToCSV(filteredAttendance, freshEmployees); // Use fresh employee data
          
          toast({
            title: "Berhasil",
            description: "Laporan CSV berhasil diunduh",
          });
        }
      } else if (reportType === "leave") {
        // Get fresh employees for leave reports too
        const freshEmployees = await fetch(`/api/employees`).then(res => res.json());
        
        if (format === "csv") {
          exportLeaveToCSV(leaveRequests, freshEmployees); // Use fresh employee data
          
          toast({
            title: "Berhasil",
            description: "Laporan cuti CSV berhasil diunduh",
          });
        } else {
          toast({
            title: "Info",
            description: "Laporan cuti dalam format PDF belum tersedia",
          });
        }
      } else if (reportType === "summary") {
        // Get fresh employees for summary reports too
        const freshEmployees = await fetch(`/api/employees`).then(res => res.json());
        
        if (format === "csv") {
          exportEmployeesToCSV(freshEmployees); // Use fresh employee data
          
          toast({
            title: "Berhasil",
            description: "Laporan ringkasan CSV berhasil diunduh",
          });
        } else {
          toast({
            title: "Info",
            description: "Laporan ringkasan dalam format PDF belum tersedia",
          });
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: `Gagal mengunduh laporan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Calculate statistics
  const totalAttendance = attendance.length;
  const presentCount = attendance.filter(r => r.status === 'present').length;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
  const totalLeave = leaveRequests.filter(r => r.status === 'approved').length;
  const pendingLeave = leaveRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-8">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-green-600 text-white p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/10 opacity-30"></div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-6 lg:space-y-0">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight">
                    Analytics & Reports
                  </h1>
                  <p className="text-xl text-green-100 mt-2">
                    Generate sophisticated attendance and leave reports
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Activity className="w-4 h-4" />
                  <span>Real-time Data</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Target className="w-4 h-4" />
                  <span>{attendanceRate}% Kehadiran</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Users className="w-4 h-4" />
                  <span>{employees.length} Karyawan</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {updateStatus && (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-200" />
                    <span>Data terupdate</span>
                  </div>
                  <p className="text-xs text-green-200 mt-1">Auto-refresh active</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <Zap className="w-5 h-5 text-blue-500 opacity-60" />
            </div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Tingkat Kehadiran</p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1" data-testid="stats-attendance-rate">{attendanceRate}%</p>
          </div>
        </div>
        
        <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-900/20 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-500 opacity-60" />
            </div>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total Absensi</p>
            <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mt-1" data-testid="stats-total-attendance">{totalAttendance}</p>
          </div>
        </div>
        
        <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <Shield className="w-5 h-5 text-purple-500 opacity-60" />
            </div>
            <p className="text-sm font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Total Karyawan</p>
            <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1" data-testid="stats-total-employees">{employees.length}</p>
          </div>
        </div>
        
        <div className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <Activity className="w-5 h-5 text-amber-500 opacity-60" />
            </div>
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Total Cuti</p>
            <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-1" data-testid="stats-total-leave">{totalLeave}</p>
          </div>
        </div>
      </div>

      {/* Enhanced Report Generator & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Premium Export Options */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Report Generator</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Buat dan download laporan dengan konfigurasi lengkap</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                <Download className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Periode Laporan
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-blue-600 dark:text-blue-400 mb-1 block">Dari Tanggal</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white/50 border-blue-200 dark:border-blue-700"
                    data-testid="report-start-date"
                  />
                </div>
                <div>
                  <Label className="text-xs text-blue-600 dark:text-blue-400 mb-1 block">Sampai Tanggal</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white/50 border-blue-200 dark:border-blue-700"
                    data-testid="report-end-date"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <Label className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Jenis Laporan
                </Label>
              </div>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="bg-white/50 border-purple-200 dark:border-purple-700" data-testid="report-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attendance">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Laporan Absensi
                    </div>
                  </SelectItem>
                  <SelectItem value="leave">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Laporan Cuti
                    </div>
                  </SelectItem>
                  <SelectItem value="summary">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Laporan Ringkasan
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType === "attendance" && (
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <Label className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Filter Shift
                  </Label>
                </div>
                <Select value={shiftFilter} onValueChange={setShiftFilter}>
                  <SelectTrigger className="bg-white/50 border-orange-200 dark:border-orange-700" data-testid="shift-filter-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Shift</SelectItem>
                    <SelectItem value="Shift 1">Shift 1 saja</SelectItem>
                    <SelectItem value="Shift 2">Shift 2 saja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Enhanced Report Information Form */}
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/10 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h4 className="font-semibold text-gray-900 dark:text-white">Informasi Laporan</h4>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Perusahaan
                    </Label>
                    <Input
                      value={reportInfo.perusahaan}
                      onChange={(e) => setReportInfo(prev => ({...prev, perusahaan: e.target.value}))}
                      placeholder="Nama perusahaan"
                      className="bg-white/50 border-gray-300 dark:border-gray-600"
                      data-testid="input-perusahaan"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nama Pengawas
                    </Label>
                    <Input
                      value={reportInfo.namaPengawas}
                      onChange={(e) => setReportInfo(prev => ({...prev, namaPengawas: e.target.value}))}
                      placeholder="Nama pengawas"
                      className="bg-white/50 border-gray-300 dark:border-gray-600"
                      data-testid="input-nama-pengawas"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Waktu
                    </Label>
                    <Input
                      value={reportInfo.waktu}
                      onChange={(e) => setReportInfo(prev => ({...prev, waktu: e.target.value}))}
                      placeholder="17:00 - 18:30"
                      className="bg-white/50 border-gray-300 dark:border-gray-600"
                      data-testid="input-waktu"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Shift
                    </Label>
                    <Select value={reportInfo.shift} onValueChange={(value) => setReportInfo(prev => ({...prev, shift: value}))}>
                      <SelectTrigger className="bg-white/50 border-gray-300 dark:border-gray-600" data-testid="select-shift">
                        <SelectValue placeholder="Pilih Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Shift 1">Shift 1</SelectItem>
                        <SelectItem value="Shift 2">Shift 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tempat
                    </Label>
                    <Input
                      value={reportInfo.tempat}
                      onChange={(e) => setReportInfo(prev => ({...prev, tempat: e.target.value}))}
                      placeholder="Titik Kumpul Workshop GECL"
                      className="bg-white/50 border-gray-300 dark:border-gray-600"
                      data-testid="input-tempat"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Diperiksa Oleh
                    </Label>
                    <Input
                      value={reportInfo.diperiksaOleh}
                      onChange={(e) => setReportInfo(prev => ({...prev, diperiksaOleh: e.target.value}))}
                      placeholder="Nama pengawas pool"
                      className="bg-white/50 border-gray-300 dark:border-gray-600"
                      data-testid="input-diperiksa-oleh"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Catatan
                    </Label>
                    <Textarea
                      value={reportInfo.catatan || ""}
                      onChange={(e) => setReportInfo(prev => ({...prev, catatan: e.target.value}))}
                      placeholder="Catatan tambahan (opsional)"
                      className="bg-white/50 border-gray-300 dark:border-gray-600"
                      data-testid="input-catatan"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Upload Tanda Tangan
                    </Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setReportInfo(prev => ({...prev, tandaTangan: file}));
                      }}
                      className="bg-white/50 border-gray-300 dark:border-gray-600 file:bg-gray-100 file:text-gray-700"
                      data-testid="input-tanda-tangan"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-2 mb-3">
                <Download className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <Label className="text-sm font-medium text-teal-700 dark:text-teal-300">
                  Format & Orientasi
                </Label>
              </div>
              <RadioGroup value={format} onValueChange={setFormat} className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg border border-teal-100 dark:border-teal-700">
                  <RadioGroupItem value="pdf" id="format-pdf" data-testid="format-pdf" />
                  <Label htmlFor="format-pdf" className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF Landscape (ReportLab Style)
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg border border-teal-100 dark:border-teal-700">
                  <RadioGroupItem value="pdf-portrait" id="format-pdf-portrait" data-testid="format-pdf-portrait" />
                  <Label htmlFor="format-pdf-portrait" className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF A4 Portrait (Professional)
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg border border-teal-100 dark:border-teal-700">
                  <RadioGroupItem value="csv" id="format-csv" data-testid="format-csv" />
                  <Label htmlFor="format-csv" className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    CSV
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <Button 
              onClick={handleExport} 
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg font-medium"
              data-testid="download-report-button"
              disabled={!startDate || !endDate || isExporting}
            >
              <Download className="w-5 h-5 mr-2" />
              {isExporting ? "Generating Report..." : "Generate & Download"}
            </Button>
            </div>
        </div>
        
        {/* Enhanced Recent Reports */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-purple-50 dark:from-gray-800 dark:to-purple-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Reports</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Laporan yang telah dibuat sebelumnya</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700/30 dark:to-blue-900/10 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">Laporan Absensi Bulan Ini</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Dibuat hari ini</p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 mt-1">
                      Tersedia
                    </span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-10 px-4 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
              
              <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-green-50 dark:from-gray-700/30 dark:to-green-900/10 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">Laporan Cuti Q4 2024</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Dibuat 2 hari yang lalu</p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 mt-1">
                      Tersedia
                    </span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-10 px-4 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
