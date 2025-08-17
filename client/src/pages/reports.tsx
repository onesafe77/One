import { useState } from "react";
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
import type { Employee, AttendanceRecord, LeaveRequest } from "@shared/schema";
import { Download, FileText, Calendar, Users, TrendingUp } from "lucide-react";

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState("attendance");
  const [format, setFormat] = useState("pdf");
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", startDate],
    enabled: reportType === "attendance",
  });

  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave"],
    enabled: reportType === "leave",
  });

  const exportReport = () => {
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
        const filteredAttendance = attendance.filter(record => {
          return record.date >= startDate && record.date <= endDate;
        });

        if (format === "pdf") {
          generateAttendancePDF({
            employees,
            attendance: filteredAttendance,
            startDate,
            endDate,
            reportType: "attendance"
          });
        } else {
          exportAttendanceToCSV(filteredAttendance, employees);
        }
      } else if (reportType === "leave") {
        if (format === "csv") {
          exportLeaveToCSV(leaveRequests, employees);
        } else {
          toast({
            title: "Info",
            description: "Laporan cuti dalam format PDF belum tersedia",
          });
        }
      } else if (reportType === "summary") {
        if (format === "csv") {
          exportEmployeesToCSV(employees);
        } else {
          toast({
            title: "Info",
            description: "Laporan ringkasan dalam format PDF belum tersedia",
          });
        }
      }

      toast({
        title: "Berhasil",
        description: "Laporan berhasil diunduh",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mengunduh laporan",
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
          
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </Label>
            <RadioGroup value={format} onValueChange={setFormat} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="format-pdf" data-testid="format-pdf" />
                <Label htmlFor="format-pdf" className="text-sm text-gray-700 dark:text-gray-300">
                  PDF
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
            onClick={exportReport} 
            className="w-full bg-green-600 hover:bg-green-700"
            data-testid="download-report-button"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Laporan
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
