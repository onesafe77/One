import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  Clock, 
  Building2, 
  Target,
  FileText,
  BarChart3,
  User,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
);

interface LeaveAnalyticsOverview {
  overview: {
    totalEmployees: number;
    totalLeaveRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    totalLeaveDaysTaken: number;
    averageLeaveDays: number;
  };
  topLeaveEmployees: Array<{
    employeeId: string;
    employeeName: string;
    usedDays: number;
    remainingDays: number;
    percentage: number;
  }>;
  monthlyLeaveData: Array<{
    month: string;
    requests: number;
    totalDays: number;
  }>;
  leaveTypeDistribution: Record<string, number>;
}

interface DepartmentStats {
  department: string;
  totalEmployees: number;
  totalLeaveDays: number;
  averageLeaveDays: number;
  employees: Array<{
    nik: string;
    name: string;
    position: string;
    usedDays: number;
    remainingDays: number;
  }>;
}

export default function LeaveEvaluation() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  const { data: analyticsData, isLoading: loadingAnalytics, refetch: refetchAnalytics } = useQuery<LeaveAnalyticsOverview>({
    queryKey: ["/api/leave-analytics/overview", selectedYear],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: departmentData = [], isLoading: loadingDepartments, refetch: refetchDepartments } = useQuery<DepartmentStats[]>({
    queryKey: ["/api/leave-analytics/department", selectedYear],
    refetchInterval: 60000,
  });

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchAnalytics();
      refetchDepartments();
    }, 60000);

    return () => clearInterval(interval);
  }, [refetchAnalytics, refetchDepartments]);

  const generateChartData = () => {
    if (!analyticsData) return {};

    // Monthly trend chart
    const monthlyChartData = {
      labels: analyticsData.monthlyLeaveData.map(item => item.month),
      datasets: [
        {
          label: 'Jumlah Permohonan',
          data: analyticsData.monthlyLeaveData.map(item => item.requests),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1,
        },
        {
          label: 'Total Hari Cuti',
          data: analyticsData.monthlyLeaveData.map(item => item.totalDays),
          backgroundColor: 'rgba(251, 146, 60, 0.8)',
          borderColor: 'rgba(251, 146, 60, 1)',
          borderWidth: 1,
        }
      ]
    };

    // Leave type distribution chart
    const leaveTypeChartData = {
      labels: Object.keys(analyticsData.leaveTypeDistribution),
      datasets: [{
        data: Object.values(analyticsData.leaveTypeDistribution),
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };

    // Department chart
    const departmentChartData = {
      labels: departmentData.map(dept => dept.department),
      datasets: [{
        label: 'Rata-rata Hari Cuti',
        data: departmentData.map(dept => dept.averageLeaveDays),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      }]
    };

    return { monthlyChartData, leaveTypeChartData, departmentChartData };
  };

  const { monthlyChartData, leaveTypeChartData, departmentChartData } = generateChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
    },
  };

  const exportToExcel = () => {
    if (!analyticsData || !departmentData) return;

    // Create export data
    const exportData = {
      overview: analyticsData.overview,
      departments: departmentData,
      topEmployees: analyticsData.topLeaveEmployees,
      monthlyTrend: analyticsData.monthlyLeaveData
    };

    // Convert to CSV format
    const csvContent = [
      ['Dashboard Evaluasi Cuti - PT GECL'],
      ['Tahun', selectedYear],
      [''],
      ['RINGKASAN STATISTIK'],
      ['Total Karyawan', analyticsData.overview.totalEmployees],
      ['Total Permohonan Cuti', analyticsData.overview.totalLeaveRequests],
      ['Permohonan Pending', analyticsData.overview.pendingRequests],
      ['Permohonan Disetujui', analyticsData.overview.approvedRequests],
      ['Total Hari Cuti Diambil', analyticsData.overview.totalLeaveDaysTaken],
      ['Rata-rata Hari Cuti', analyticsData.overview.averageLeaveDays],
      [''],
      ['TOP 5 KARYAWAN CUTI TERBANYAK'],
      ['NIK', 'Nama', 'Hari Digunakan', 'Sisa Hari', 'Persentase'],
      ...analyticsData.topLeaveEmployees.map(emp => [
        emp.employeeId, emp.employeeName, emp.usedDays, emp.remainingDays, `${emp.percentage}%`
      ]),
      [''],
      ['STATISTIK PER DEPARTEMEN'],
      ['Departemen', 'Total Karyawan', 'Total Hari Cuti', 'Rata-rata Hari Cuti'],
      ...departmentData.map(dept => [
        dept.department, dept.totalEmployees, dept.totalLeaveDays, dept.averageLeaveDays
      ])
    ].map(row => row.join(',')).join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `evaluasi-cuti-${selectedYear}-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  if (loadingAnalytics || loadingDepartments) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Evaluasi Cuti</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Evaluasi Cuti</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Analisis komprehensif manajemen cuti karyawan PT GECL
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Karyawan</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {analyticsData?.overview.totalEmployees || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Karyawan aktif
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Permohonan</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {analyticsData?.overview.totalLeaveRequests || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {analyticsData?.overview.pendingRequests || 0} pending, {analyticsData?.overview.approvedRequests || 0} disetujui
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hari Cuti</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {analyticsData?.overview.totalLeaveDaysTaken || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Hari cuti yang telah diambil
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata Cuti</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analyticsData?.overview.averageLeaveDays || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Hari per karyawan
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Tren Cuti</TabsTrigger>
          <TabsTrigger value="departments">Per Departemen</TabsTrigger>
          <TabsTrigger value="employees">Top Karyawan</TabsTrigger>
          <TabsTrigger value="types">Jenis Cuti</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-red-600" />
                Tren Cuti 6 Bulan Terakhir
              </CardTitle>
              <CardDescription>
                Analisis pola penggunaan cuti dalam 6 bulan terakhir
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {monthlyChartData && (
                  <Bar data={monthlyChartData} options={chartOptions} />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-red-600" />
                  Rata-rata Cuti per Departemen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {departmentChartData && (
                    <Bar data={departmentChartData} options={chartOptions} />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detail Departemen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                  {departmentData.map((dept, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-lg">{dept.department}</h4>
                        <Badge variant="outline">{dept.totalEmployees} karyawan</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total Hari Cuti:</span>
                          <span className="font-semibold ml-2">{dept.totalLeaveDays}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Rata-rata:</span>
                          <span className="font-semibold ml-2">{dept.averageLeaveDays} hari</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2 text-red-600" />
                Top 5 Karyawan dengan Cuti Terbanyak
              </CardTitle>
              <CardDescription>
                Karyawan yang menggunakan cuti paling banyak tahun ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.topLeaveEmployees.map((employee, index) => (
                  <div key={employee.employeeId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 font-bold">#{index + 1}</span>
                      </div>
                      <div>
                        <h4 className="font-semibold">{employee.employeeName}</h4>
                        <p className="text-sm text-gray-600">NIK: {employee.employeeId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">{employee.usedDays} hari</div>
                      <div className="text-sm text-gray-600">
                        Sisa: {employee.remainingDays} hari ({employee.percentage}%)
                      </div>
                      <Progress value={employee.percentage} className="w-24 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-red-600" />
                Distribusi Jenis Cuti
              </CardTitle>
              <CardDescription>
                Breakdown penggunaan cuti berdasarkan jenis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-[300px]">
                  {leaveTypeChartData && (
                    <Doughnut data={leaveTypeChartData} options={doughnutOptions} />
                  )}
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">Detail Jenis Cuti:</h4>
                  {Object.entries(analyticsData?.leaveTypeDistribution || {}).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center p-2 border rounded">
                      <span className="capitalize">{type}</span>
                      <Badge variant="secondary">{count} permohonan</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Real-time indicators */}
      <div className="text-center">
        <p className="text-sm text-gray-500">
          Data terupdate otomatis setiap menit | Terakhir diupdate: {format(new Date(), 'HH:mm:ss', { locale: localeId })}
        </p>
      </div>
    </div>
  );
}