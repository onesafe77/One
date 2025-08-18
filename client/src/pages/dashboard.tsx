import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, CheckCircle, Clock, FileText, Calendar, RefreshCw } from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DashboardStats {
  totalEmployees: number;
  scheduledToday: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  pendingLeaveRequests: number;
}

interface RecentActivity {
  id: string;
  employeeId: string;
  employeeName: string;
  time: string;
  jamTidur: string;
  fitToWork: string;
  status: string;
  createdAt: string;
}

interface AttendanceDetail {
  employeeId: string;
  employeeName: string;
  position: string;
  shift: string;
  scheduledTime: string;
  actualTime: string;
  jamTidur: string;
  fitToWork: string;
  status: string;
  hasAttended: boolean;
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const { data: stats, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const { data: recentActivities, refetch: refetchActivities } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/recent-activities", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/recent-activities?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
  });

  const { data: attendanceDetails, refetch: refetchDetails } = useQuery<AttendanceDetail[]>({
    queryKey: ["/api/dashboard/attendance-details", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/attendance-details?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch attendance details');
      return response.json();
    },
  });

  const handleRefresh = () => {
    refetchStats();
    refetchActivities();
    refetchDetails();
  };

  // Auto refresh every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [selectedDate]);

  const attendanceChartData = {
    labels: ['Hadir', 'Belum Hadir', 'Cuti'],
    datasets: [{
      data: [
        stats?.presentToday || 0,
        stats?.absentToday || 0,
        stats?.onLeaveToday || 0
      ],
      backgroundColor: ['#10B981', '#ff1100', '#8B5CF6'],
      borderWidth: 0
    }]
  };

  const weeklyTrendData = {
    labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
    datasets: [{
      label: 'Kehadiran (%)',
      data: [85, 89, 92, 88, 85, 78, 82],
      backgroundColor: 'rgba(255, 17, 0, 0.1)',
      borderColor: '#ff1100',
      fill: true,
      tension: 0.4
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Filter and Refresh */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <label htmlFor="date-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tanggal:
            </label>
          </div>
          <Input
            id="date-filter"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
            data-testid="date-filter"
          />
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          className="flex items-center gap-2"
          data-testid="refresh-button"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Karyawan"
          value={stats?.totalEmployees || 0}
          icon={<Users className="w-6 h-6" />}
          iconColor="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
        />
        <StatsCard
          title="Hadir Hari Ini"
          value={stats?.presentToday || 0}
          icon={<CheckCircle className="w-6 h-6" />}
          iconColor="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300"
        />
        <StatsCard
          title="Belum Hadir"
          value={stats?.absentToday || 0}
          icon={<Clock className="w-6 h-6" />}
          iconColor="bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300"
        />
        <StatsCard
          title="Cuti"
          value={stats?.onLeaveToday || 0}
          icon={<FileText className="w-6 h-6" />}
          iconColor="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Statistik Kehadiran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Doughnut data={attendanceChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tren Mingguan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar 
                data={weeklyTrendData} 
                options={{
                  ...chartOptions,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100
                    }
                  }
                }} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Details Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detail Kehadiran Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Nama</th>
                    <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Shift</th>
                    <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Jam</th>
                    <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceDetails?.slice(0, 8).map((detail) => (
                    <tr key={detail.employeeId} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{detail.employeeName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{detail.position}</div>
                        </div>
                      </td>
                      <td className="py-2 text-gray-700 dark:text-gray-300">{detail.shift}</td>
                      <td className="py-2">
                        <div className="text-gray-700 dark:text-gray-300">
                          {detail.hasAttended ? detail.actualTime : detail.scheduledTime}
                        </div>
                        {detail.hasAttended && detail.jamTidur !== '-' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Tidur: {detail.jamTidur} jam
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          detail.hasAttended 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {detail.hasAttended ? 'Hadir' : 'Belum Hadir'}
                        </span>
                        {detail.hasAttended && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {detail.fitToWork}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {attendanceDetails && attendanceDetails.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Tidak ada data roster untuk tanggal ini
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities && recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.employeeName} ({activity.employeeId}) telah melakukan absensi
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Jam: {activity.time} | Tidur: {activity.jamTidur} jam | {activity.fitToWork}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Belum ada aktivitas absensi hari ini
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
