import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Clock, FileText } from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
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

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const attendanceChartData = {
    labels: ['Hadir', 'Belum Hadir', 'Cuti'],
    datasets: [{
      data: [
        stats?.presentToday || 0,
        stats?.absentToday || 0,
        stats?.onLeaveToday || 0
      ],
      backgroundColor: ['#10B981', '#EF4444', '#8B5CF6'],
      borderWidth: 0
    }]
  };

  const weeklyTrendData = {
    labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
    datasets: [{
      label: 'Kehadiran (%)',
      data: [85, 89, 92, 88, 85, 78, 82],
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: '#3B82F6',
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

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                icon: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-300" />,
                message: "Budi Santoso (EMP001) telah melakukan absensi",
                time: "2 menit yang lalu",
                color: "bg-green-100 dark:bg-green-900"
              },
              {
                icon: <Users className="w-4 h-4 text-blue-600 dark:text-blue-300" />,
                message: "QR Code baru dihasilkan untuk Siti Aisyah (EMP025)",
                time: "5 menit yang lalu",
                color: "bg-blue-100 dark:bg-blue-900"
              },
              {
                icon: <FileText className="w-4 h-4 text-purple-600 dark:text-purple-300" />,
                message: "Ahmad Fauzi mengajukan cuti tanggal 15-17 Desember",
                time: "10 menit yang lalu",
                color: "bg-purple-100 dark:bg-purple-900"
              }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className={`flex-shrink-0 w-8 h-8 ${activity.color} rounded-full flex items-center justify-center`}>
                  {activity.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.message}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
