import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generateAttendancePDF } from "@/lib/pdf-utils";
import { exportAttendanceToCSV, exportLeaveToCSV, exportEmployeesToCSV } from "@/lib/csv-utils";
import { useToast } from "@/hooks/use-toast";
import type { Employee, AttendanceRecord, LeaveRequest, RosterSchedule } from "@shared/schema";
import { Download, FileText, Calendar, Users, TrendingUp, RefreshCw, CheckCircle } from "lucide-react";

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState("attendance");
  const [format, setFormat] = useState("pdf");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  
  // Form fields for report header
  const [reportInfo, setReportInfo] = useState({
    perusahaan: "PT Goden Energi Cemerlang Lestari",
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Laporan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Periode
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="report-start-date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="report-end-date"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jenis Laporan
            </Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger data-testid="report-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance">Laporan Absensi</SelectItem>
                <SelectItem value="leave">Laporan Cuti</SelectItem>
                <SelectItem value="summary">Laporan Ringkasan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportType === "attendance" && (
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter Shift
              </Label>
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger data-testid="shift-filter-select">
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

          {/* Report Information Form */}
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <h4 className="font-medium text-gray-900 dark:text-white">Informasi Laporan</h4>
            
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Perusahaan
              </Label>
              <Input
                value={reportInfo.perusahaan}
                onChange={(e) => setReportInfo(prev => ({...prev, perusahaan: e.target.value}))}
                placeholder="Nama perusahaan"
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
                data-testid="input-nama-pengawas"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Waktu
                </Label>
                <Input
                  value={reportInfo.waktu}
                  onChange={(e) => setReportInfo(prev => ({...prev, waktu: e.target.value}))}
                  placeholder="17:00 - 18:30"
                  data-testid="input-waktu"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Shift
                </Label>
                <Select value={reportInfo.shift} onValueChange={(value) => setReportInfo(prev => ({...prev, shift: value}))}>
                  <SelectTrigger data-testid="select-shift">
                    <SelectValue placeholder="Pilih Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Shift 1">Shift 1</SelectItem>
                    <SelectItem value="Shift 2">Shift 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tempat
              </Label>
              <Input
                value={reportInfo.tempat}
                onChange={(e) => setReportInfo(prev => ({...prev, tempat: e.target.value}))}
                placeholder="Titik Kumpul Workshop GECL"
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
                data-testid="input-diperiksa-oleh"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Catatan
              </Label>
              <Input
                value={reportInfo.catatan || ""}
                onChange={(e) => setReportInfo(prev => ({...prev, catatan: e.target.value}))}
                placeholder="Catatan tambahan (opsional)"
                data-testid="input-catatan"
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
                  const file = e.target.files?.[0] || null;
                  setReportInfo(prev => ({...prev, tandaTangan: file}));
                }}
                data-testid="input-tanda-tangan"
              />
              {reportInfo.tandaTangan && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  File dipilih: {typeof reportInfo.tandaTangan === 'string' ? 'Signature uploaded' : reportInfo.tandaTangan.name}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format & Orientasi
            </Label>
            <RadioGroup value={format} onValueChange={setFormat} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="format-pdf" data-testid="format-pdf" />
                <Label htmlFor="format-pdf" className="text-sm text-gray-700 dark:text-gray-300">
                  PDF Landscape (ReportLab Style)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf-portrait" id="format-pdf-portrait" data-testid="format-pdf-portrait" />
                <Label htmlFor="format-pdf-portrait" className="text-sm text-gray-700 dark:text-gray-300">
                  PDF A4 Portrait (Professional)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="format-csv" data-testid="format-csv" />
                <Label htmlFor="format-csv" className="text-sm text-gray-700 dark:text-gray-300">
                  CSV
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <Button 
            onClick={handleExport} 
            className="w-full bg-green-600 hover:bg-green-700"
            data-testid="download-report-button"
            disabled={!startDate || !endDate || isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Mengunduh..." : "Download Laporan"}
          </Button>
        </CardContent>
      </Card>
      
      {/* Report Summary */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Ringkasan Laporan</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg" data-testid="stats-attendance-rate">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{attendanceRate}%</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Tingkat Kehadiran</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg" data-testid="stats-total-attendance">
              <Calendar className="w-6 h-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{totalAttendance}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Absensi</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg" data-testid="stats-total-employees">
              <Users className="w-6 h-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{employees.length}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Karyawan</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg" data-testid="stats-total-leave">
              <FileText className="w-6 h-6 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{totalLeave}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Cuti</p>
            </div>
          </div>
          
          {/* Recent Reports */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Laporan Terbaru</h4>
            <div className="space-y-3">
              {[
                {
                  title: "Laporan Absensi Bulan Ini",
                  description: "Dibuat hari ini",
                  type: "attendance",
                  icon: Calendar
                },
                {
                  title: "Laporan Cuti Q4 2024",
                  description: "Dibuat 2 hari yang lalu",
                  type: "leave",
                  icon: FileText
                },
                {
                  title: "Laporan Ringkasan Karyawan",
                  description: "Dibuat 1 minggu yang lalu",
                  type: "summary",
                  icon: Users
                }
              ].map((report, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  data-testid={`recent-report-${report.type}`}
                >
                  <div className="flex items-center">
                    <report.icon className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{report.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{report.description}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-primary-600 hover:text-primary-700"
                    data-testid={`download-recent-${report.type}`}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
