import { useQuery } from "@tanstack/react-query";
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
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
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

  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?date=${selectedDate}`, {
        cache: 'no-cache', // Force fresh data
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 0, // Data immediately stale for real-time updates
    refetchOnWindowFocus: true,
  });

  const { data: recentActivities, refetch: refetchActivities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/recent-activities", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/recent-activities?date=${selectedDate}`, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });


  const handleRefresh = () => {
    refetchStats();
    refetchActivities();
  };

  // Auto refresh yang lebih responsif untuk real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 15000); // 15 seconds untuk update lebih cepat

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
      {/* Modern Date Filter and Refresh */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <label htmlFor="date-filter" className="text-sm font-medium text-gray-900 dark:text-white">
                Filter Tanggal:
              </label>
            </div>
            <Input
              id="date-filter"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500"
              data-testid="date-filter"
            />
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700"
            data-testid="refresh-button"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Modern Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Karyawan</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="stats-total-employees">{stats?.totalEmployees || 0}</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Hadir Hari Ini</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="stats-present-today">{stats?.presentToday || 0}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Belum Hadir</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="stats-absent-today">{stats?.absentToday || 0}</p>
                </div>
                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cuti</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="stats-on-leave">{stats?.onLeaveToday || 0}</p>
                </div>
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modern Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Statistik Kehadiran</h3>
          </div>
          <div className="p-4">
            {statsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
              </div>
            ) : (
              <div className="h-64">
                <Doughnut data={attendanceChartData} options={chartOptions} />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Tren Mingguan</h3>
          </div>
          <div className="p-4">
            {statsLoading ? (
              <div className="h-64 flex items-end justify-between space-x-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-8`} style={{ height: `${40 + Math.random() * 120}px` }}></div>
                ))}
              </div>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      {/* Modern Recent Activity */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Aktivitas Terbaru</h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {activitiesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                </div>
              ))
            ) : recentActivities && recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600" data-testid={`activity-item-${activity.id}`}>
                  <div className="flex-shrink-0 w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.employeeName} ({activity.employeeId}) telah melakukan absensi
                    </p>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Jam: {activity.time} • Tidur: {activity.jamTidur} jam • {activity.fitToWork}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Belum ada aktivitas absensi hari ini</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Aktivitas absensi akan muncul di sini</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
