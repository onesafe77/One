import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, CheckCircle, Clock, FileText, Calendar, RefreshCw, TrendingUp, Activity, BarChart3 } from "lucide-react";
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
    <div className="space-y-8">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-8 md:p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 to-white/10"></div>
        </div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Dashboard Kehadiran
              </h1>
              <p className="text-blue-100 text-lg">
                Monitor real-time kehadiran karyawan dan analytics
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <Calendar className="w-5 h-5" />
                <div className="space-y-1">
                  <label htmlFor="date-filter" className="text-sm font-medium text-blue-100">
                    Filter Tanggal
                  </label>
                  <Input
                    id="date-filter"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-white/20 border-white/20 text-white placeholder:text-blue-100 focus:bg-white/30 focus:border-white/40"
                    data-testid="date-filter"
                  />
                </div>
              </div>
              <Button 
                onClick={handleRefresh} 
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/20 text-white h-auto py-4 px-6 rounded-xl transition-all duration-200"
                data-testid="refresh-button"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                <span className="font-medium">Refresh Data</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"></div>
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md hover:shadow-blue-500/10 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Karyawan</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight" data-testid="stats-total-employees">{stats?.totalEmployees || 0}</p>
                  <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <TrendingUp className="w-3 h-3" />
                    <span className="font-medium">Aktif</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            
            <div className="group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md hover:shadow-emerald-500/10 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Hadir Hari Ini</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight" data-testid="stats-present-today">{stats?.presentToday || 0}</p>
                  <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    <span className="font-medium">Terkonfirmasi</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            
            <div className="group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md hover:shadow-amber-500/10 hover:border-amber-200 dark:hover:border-amber-800 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Belum Hadir</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight" data-testid="stats-absent-today">{stats?.absentToday || 0}</p>
                  <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    <span className="font-medium">Menunggu</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            
            <div className="group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md hover:shadow-purple-500/10 hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cuti</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight" data-testid="stats-on-leave">{stats?.onLeaveToday || 0}</p>
                  <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                    <FileText className="w-3 h-3" />
                    <span className="font-medium">Disetujui</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <FileText className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Enhanced Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Statistik Kehadiran</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Distribusi status kehadiran hari ini</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
          <div className="p-6">
            {statsLoading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="w-36 h-36 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 animate-pulse"></div>
              </div>
            ) : (
              <div className="h-72">
                <Doughnut data={attendanceChartData} options={{
                  ...chartOptions,
                  cutout: '65%',
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      position: 'bottom',
                      labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                          size: 12,
                          weight: '500'
                        }
                      }
                    }
                  }
                }} />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tren Mingguan</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Persentase kehadiran 7 hari terakhir</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="p-6">
            {statsLoading ? (
              <div className="h-72 flex items-end justify-between space-x-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className={`bg-gradient-to-t from-blue-200 to-blue-300 dark:from-blue-700 dark:to-blue-600 rounded-lg animate-pulse w-8`} style={{ height: `${60 + Math.random() * 140}px` }}></div>
                ))}
              </div>
            ) : (
              <div className="h-72">
                <Bar 
                  data={{
                    ...weeklyTrendData,
                    datasets: [{
                      ...weeklyTrendData.datasets[0],
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      borderColor: 'rgb(59, 130, 246)',
                      borderWidth: 2,
                      borderRadius: 8,
                      borderSkipped: false,
                    }]
                  }} 
                  options={{
                    ...chartOptions,
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                          color: 'rgba(0, 0, 0, 0.05)',
                        },
                        ticks: {
                          callback: function(value) {
                            return value + '%';
                          }
                        }
                      },
                      x: {
                        grid: {
                          display: false
                        }
                      }
                    },
                    plugins: {
                      ...chartOptions.plugins,
                      legend: {
                        display: false
                      }
                    }
                  }} 
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Recent Activity */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Aktivitas Terbaru</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Real-time absensi karyawan hari ini</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {activitiesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-600">
                  <div className="flex-shrink-0 w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                    <div className="h-3 w-4/5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                  <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                </div>
              ))
            ) : recentActivities && recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="group flex items-start space-x-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-200" data-testid={`activity-item-${activity.id}`}>
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      {activity.employeeName} 
                      <span className="text-gray-500 dark:text-gray-400 font-normal">({activity.employeeId})</span>
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Jam: <span className="font-medium">{activity.time}</span> • 
                      Tidur: <span className="font-medium">{activity.jamTidur} jam</span> • 
                      <span className={`font-medium ${
                        activity.fitToWork === 'Fit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {activity.fitToWork}
                      </span>
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                      Hadir
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Belum Ada Aktivitas</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Belum ada aktivitas absensi hari ini</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">Real-time absensi akan muncul di sini</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
