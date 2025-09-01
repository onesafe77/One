import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar, 
  Filter, 
  Plus, 
  Trash2, 
  Edit, 
  Download,
  Upload,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface LeaveRosterMonitoring {
  id: string;
  nik: string;
  name: string;
  investorGroup: string;
  lastLeaveDate: string | null;
  leaveOption: string; // "70" atau "35"
  monitoringDays: number;
  nextLeaveDate: string | null;
  status: string; // Aktif, Menunggu Cuti, Sedang Cuti, Selesai Cuti
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  id: string;
  name: string;
  investorGroup: string | null;
}

const statusColors = {
  "Aktif": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Menunggu Cuti": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Sedang Cuti": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Selesai Cuti": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
};

export default function LeaveRosterMonitoringPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [investorGroupFilter, setInvestorGroupFilter] = useState("all");
  const [leaveOptionFilter, setLeaveOptionFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  
  // States for add/edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeaveRosterMonitoring | null>(null);
  
  // States for Excel upload
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    nik: "",
    name: "",
    month: new Date().toISOString().slice(0, 7), // Default: current month
    investorGroup: "",
    lastLeaveDate: "",
    leaveOption: "70", // default 70 hari kerja
    nextLeaveDate: "",
    onSite: "",
    status: "Aktif"
  });

  // Fetch leave roster monitoring data
  const { data: monitoringData = [], isLoading, refetch } = useQuery<LeaveRosterMonitoring[]>({
    queryKey: ["/api/leave-roster-monitoring"],
    staleTime: 30000, // 30 seconds
  });

  // Fetch employees for dropdown
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    staleTime: 300000, // 5 minutes
  });

  // Create monitoring entry
  const createMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("/api/leave-roster-monitoring", "POST", data),
    onSuccess: () => {
      toast({
        title: "Berhasil",
        description: "Data monitoring roster cuti berhasil ditambahkan",
      });
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/leave-roster-monitoring"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update monitoring entry
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/leave-roster-monitoring/${id}`, "PUT", data),
    onSuccess: () => {
      toast({
        title: "Berhasil",
        description: "Data monitoring roster cuti berhasil diperbarui",
      });
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/leave-roster-monitoring"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete monitoring entry
  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/leave-roster-monitoring/${id}`, "DELETE"),
    onSuccess: () => {
      toast({
        title: "Berhasil",
        description: "Data monitoring roster cuti berhasil dihapus",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-roster-monitoring"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update status automatically
  const updateStatusMutation = useMutation({
    mutationFn: () => apiRequest("/api/leave-roster-monitoring/update-status", "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-roster-monitoring"] });
    },
  });

  // Excel upload mutation
  const uploadExcelMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/leave-roster-monitoring/upload-excel", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Upload Berhasil",
        description: `${result.success} data berhasil diupload, ${result.errors?.length || 0} error`,
      });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setUploadProgress(0);
      queryClient.invalidateQueries({ queryKey: ["/api/leave-roster-monitoring"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Gagal",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  // Delete all data mutation
  const deleteAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/leave-roster-monitoring/delete-all", "DELETE"),
    onSuccess: () => {
      toast({
        title: "Berhasil",
        description: "Semua data monitoring roster cuti berhasil dihapus",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-roster-monitoring"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-update status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      updateStatusMutation.mutate();
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [updateStatusMutation]);

  // Calculate next leave date based on leave option
  const calculateNextLeaveDate = (lastLeaveDate: string, leaveOption: string) => {
    if (!lastLeaveDate) return "";
    
    const workDays = leaveOption === "70" ? 70 : 35;
    const lastDate = parseISO(lastLeaveDate);
    const nextDate = addDays(lastDate, workDays);
    return format(nextDate, "yyyy-MM-dd");
  };

  // Calculate monitoring days
  const calculateMonitoringDays = (lastLeaveDate: string) => {
    if (!lastLeaveDate) return 0;
    
    const lastDate = parseISO(lastLeaveDate);
    const today = new Date();
    return differenceInDays(today, lastDate);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      nik: "",
      name: "",
      month: new Date().toISOString().slice(0, 7), // Default: current month
      investorGroup: "",
      lastLeaveDate: "",
      leaveOption: "70",
      nextLeaveDate: "",
      onSite: "",
      status: "Aktif"
    });
    setEditingItem(null);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nik || !formData.name || !formData.investorGroup) {
      toast({
        title: "Error",
        description: "NIK, Nama, dan Investor Group harus diisi",
        variant: "destructive",
      });
      return;
    }

    // Calculate monitoring days and auto-determine status
    const monitoringDays = formData.lastLeaveDate ? 
      calculateMonitoringDays(formData.lastLeaveDate) : 0;
    
    const workDaysThreshold = formData.leaveOption === "70" ? 70 : 35;
    let autoStatus = "Aktif";
    
    // Auto determine status based on monitoring days
    if (monitoringDays >= workDaysThreshold - 5 && monitoringDays < workDaysThreshold) {
      autoStatus = "Menunggu Cuti";
    } else if (monitoringDays >= workDaysThreshold) {
      autoStatus = "Menunggu Cuti"; // Ready for leave
    }

    // Calculate next leave date and monitoring days
    const processedData = {
      ...formData,
      status: autoStatus, // Use auto-calculated status
      nextLeaveDate: formData.lastLeaveDate ? 
        calculateNextLeaveDate(formData.lastLeaveDate, formData.leaveOption) : undefined,
      monitoringDays
    };

    if (editingItem) {
      updateMutation.mutate({ 
        id: editingItem.id, 
        data: {
          nik: processedData.nik,
          name: processedData.name,
          investorGroup: processedData.investorGroup,
          lastLeaveDate: processedData.lastLeaveDate,
          leaveOption: processedData.leaveOption,
          status: processedData.status,
          monitoringDays: processedData.monitoringDays,
          nextLeaveDate: processedData.nextLeaveDate,
          onSite: processedData.onSite
        }
      });
    } else {
      createMutation.mutate({
        nik: processedData.nik,
        name: processedData.name,
        investorGroup: processedData.investorGroup,
        lastLeaveDate: processedData.lastLeaveDate || "",
        leaveOption: processedData.leaveOption,
        status: processedData.status,
        monitoringDays: processedData.monitoringDays,
        nextLeaveDate: processedData.nextLeaveDate || "",
        onSite: processedData.onSite || ""
      });
    }
  };

  // Handle edit
  const handleEdit = (item: LeaveRosterMonitoring) => {
    setEditingItem(item);
    setFormData({
      nik: item.nik,
      name: item.name,
      month: (item as any).month || new Date().toISOString().slice(0, 7),
      investorGroup: item.investorGroup,
      lastLeaveDate: item.lastLeaveDate || "",
      leaveOption: item.leaveOption,
      nextLeaveDate: item.nextLeaveDate || "",
      onSite: (item as any).onSite || "",
      status: item.status
    });
    setIsDialogOpen(true);
  };

  // Handle employee selection
  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (employee) {
      setFormData(prev => ({
        ...prev,
        nik: employee.id,
        name: employee.name,
        investorGroup: employee.investorGroup || ""
      }));
    }
  };

  // Handle Excel file upload
  const handleExcelUpload = () => {
    if (!uploadFile) {
      toast({
        title: "Error",
        description: "Pilih file Excel terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setUploadProgress(25);
    uploadExcelMutation.mutate(uploadFile);
  };

  // Download Excel template
  const downloadTemplate = () => {
    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const templateData = [
      ["NIK", "Nama", "Nomor Lambung", "Bulan", "Tanggal Terakhir Cuti", "Pilihan Cuti", "OnSite"],
      ["C-015001", "CONTOH NAMA 1", "GECL 001", currentMonth, "2024-01-15", "70", "Ya"],
      ["C-025002", "CONTOH NAMA 2", "GECL 002", currentMonth, "2024-02-20", "35", "Tidak"],
      ["C-035003", "CONTOH NAMA 3", "SPARE", currentMonth, "", "70", ""],
      ["C-045004", "CONTOH NAMA 4", "GECL 004", currentMonth, "2024-03-10", "35", "Ya"],
    ];

    const csvContent = templateData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_monitoring_roster_cuti_dengan_nomor_lambung.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter data
  const filteredData = monitoringData.filter((item) => {
    const matchesSearch = 
      item.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesInvestorGroup = investorGroupFilter === "all" || item.investorGroup === investorGroupFilter;
    const matchesLeaveOption = leaveOptionFilter === "all" || item.leaveOption === leaveOptionFilter;
    
    return matchesSearch && matchesStatus && matchesInvestorGroup && matchesLeaveOption;
  });

  // Get unique investor groups for filter
  const investorGroups = Array.from(new Set(monitoringData.map((item) => item.investorGroup)));

  // Dashboard stats
  const stats = {
    total: monitoringData.length,
    aktif: monitoringData.filter((item) => item.status === "Aktif").length,
    menungguCuti: monitoringData.filter((item) => item.status === "Menunggu Cuti").length,
    sedangCuti: monitoringData.filter((item) => item.status === "Sedang Cuti").length,
    selesaiCuti: monitoringData.filter((item) => item.status === "Selesai Cuti").length,
  };

  // Chart data for status distribution
  const statusChartData = {
    labels: ["Aktif", "Menunggu Cuti", "Sedang Cuti", "Selesai Cuti"],
    datasets: [
      {
        label: "Jumlah Karyawan",
        data: [stats.aktif, stats.menungguCuti, stats.sedangCuti, stats.selesaiCuti],
        backgroundColor: ["#10b981", "#f59e0b", "#3b82f6", "#6b7280"],
        borderColor: ["#059669", "#d97706", "#2563eb", "#4b5563"],
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Distribusi Status Monitoring Cuti",
      },
    },
  };

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="leave-roster-monitoring-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Monitoring Roster Cuti
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sistem monitoring otomatis roster cuti karyawan berdasarkan siklus 70/35 hari kerja
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="bg-red-600 hover:bg-red-700"
            data-testid="button-add-monitoring"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Monitoring
          </Button>
          <Button 
            onClick={() => setIsUploadDialogOpen(true)}
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50"
            data-testid="button-upload-excel"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Excel
          </Button>
          <Button 
            onClick={downloadTemplate}
            variant="outline"
            data-testid="button-download-template"
          >
            <Download className="h-4 w-4 mr-2" />
            Template Sederhana
          </Button>
          <Button 
            onClick={() => {
              if (window.confirm("Apakah Anda yakin ingin menghapus SEMUA data monitoring roster cuti? Tindakan ini tidak dapat dibatalkan.")) {
                deleteAllMutation.mutate();
              }
            }}
            variant="destructive"
            disabled={deleteAllMutation.isPending}
            data-testid="button-delete-all"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleteAllMutation.isPending ? "Menghapus..." : "Hapus Semua Data"}
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Karyawan</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.aktif}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Menunggu Cuti</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.menungguCuti}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sedang Cuti</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.sedangCuti}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selesai Cuti</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.selesaiCuti}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Analitik</CardTitle>
          <CardDescription>
            Visualisasi distribusi status monitoring cuti karyawan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Bar data={statusChartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Pencarian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Cari NIK/Nama</Label>
              <Input
                placeholder="Cari NIK atau nama..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="Aktif">Aktif</SelectItem>
                  <SelectItem value="Menunggu Cuti">Menunggu Cuti</SelectItem>
                  <SelectItem value="Sedang Cuti">Sedang Cuti</SelectItem>
                  <SelectItem value="Selesai Cuti">Selesai Cuti</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Investor Group</Label>
              <Select value={investorGroupFilter} onValueChange={setInvestorGroupFilter}>
                <SelectTrigger data-testid="select-investor-group-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Investor Group</SelectItem>
                  {investorGroups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pilihan Cuti</Label>
              <Select value={leaveOptionFilter} onValueChange={setLeaveOptionFilter}>
                <SelectTrigger data-testid="select-leave-option-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pilihan</SelectItem>
                  <SelectItem value="70">70 Hari Kerja</SelectItem>
                  <SelectItem value="35">35 Hari Kerja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setInvestorGroupFilter("all");
                  setLeaveOptionFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Monitoring Roster Cuti</CardTitle>
          <CardDescription>
            Total: {filteredData.length} dari {monitoringData.length} karyawan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Memuat data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NIK</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Bulan</TableHead>
                    <TableHead>Investor Group</TableHead>
                    <TableHead>Terakhir Cuti</TableHead>
                    <TableHead>Pilihan Cuti</TableHead>
                    <TableHead>Monitoring (Hari)</TableHead>
                    <TableHead>OnSite</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                        Tidak ada data monitoring roster cuti
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((item) => {
                      // Find employee data to get Nomor Lambung
                      const employee = employees.find(emp => emp.id === item.nik);
                      return (
                        <TableRow key={item.id} data-testid={`row-monitoring-${item.nik}`}>
                          <TableCell className="font-medium">{item.nik}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {item.month || "2024-08"}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.investorGroup}</TableCell>
                          <TableCell>
                            {item.lastLeaveDate ? 
                              format(parseISO(item.lastLeaveDate), "dd/MM/yyyy") : 
                              "-"
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.leaveOption === "70" ? "70 Hari Kerja" : "35 Hari Kerja"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{item.monitoringDays}</span> hari
                            <div className="text-xs text-gray-500 mt-1">
                              {item.monitoringDays < 0 ? 
                                `${Math.abs(item.monitoringDays)} hari sejak cuti terakhir` : 
                                `${item.monitoringDays} hari ke depan`
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.onSite ? (
                              <Badge variant={item.onSite === "Ya" ? "default" : "secondary"}>
                                {item.onSite}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[item.status as keyof typeof statusColors]}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(item)}
                                data-testid={`button-edit-${item.nik}`}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="text-red-600 hover:bg-red-50"
                                data-testid={`button-delete-${item.nik}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Monitoring Roster Cuti" : "Tambah Monitoring Roster Cuti"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Pilih Karyawan</Label>
              <Select value={formData.nik} onValueChange={handleEmployeeSelect}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Pilih karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.id} - {employee.name} ({employee.investorGroup})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>NIK</Label>
              <Input
                value={formData.nik}
                onChange={(e) => setFormData(prev => ({ ...prev, nik: e.target.value }))}
                placeholder="NIK karyawan"
                required
                data-testid="input-nik"
              />
            </div>

            <div>
              <Label>Nama</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nama karyawan"
                required
                data-testid="input-name"
              />
            </div>

            <div>
              <Label>Bulan Monitoring</Label>
              <Input
                type="month"
                value={formData.month}
                onChange={(e) => setFormData(prev => ({ ...prev, month: e.target.value }))}
                data-testid="input-month"
              />
            </div>

            <div>
              <Label>Investor Group</Label>
              <Input
                value={formData.investorGroup}
                onChange={(e) => setFormData(prev => ({ ...prev, investorGroup: e.target.value }))}
                placeholder="Investor Group"
                required
                data-testid="input-investor-group"
              />
            </div>

            <div>
              <Label>Tanggal Terakhir Cuti</Label>
              <Input
                type="date"
                value={formData.lastLeaveDate}
                onChange={(e) => setFormData(prev => ({ ...prev, lastLeaveDate: e.target.value }))}
                data-testid="input-last-leave-date"
              />
            </div>

            <div>
              <Label>Pilihan Cuti</Label>
              <Select 
                value={formData.leaveOption} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, leaveOption: value }))}
              >
                <SelectTrigger data-testid="select-leave-option">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="70">70 Hari Kerja (14 hari cuti)</SelectItem>
                  <SelectItem value="35">35 Hari Kerja (7 hari cuti)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>OnSite</Label>
              <Select 
                value={formData.onSite || "none"} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, onSite: value === "none" ? "" : value }))}
              >
                <SelectTrigger data-testid="select-onsite">
                  <SelectValue placeholder="Pilih status OnSite..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Tidak dipilih --</SelectItem>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status (Otomatis berdasarkan monitoring hari)</Label>
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                {formData.lastLeaveDate ? (() => {
                  const monitoringDays = calculateMonitoringDays(formData.lastLeaveDate);
                  const workDaysThreshold = formData.leaveOption === "70" ? 70 : 35;
                  let status = "Aktif";
                  
                  if (monitoringDays >= workDaysThreshold - 5 && monitoringDays < workDaysThreshold) {
                    status = "Menunggu Cuti";
                  } else if (monitoringDays >= workDaysThreshold) {
                    status = "Menunggu Cuti";
                  }
                  
                  return (
                    <div className="text-sm">
                      <span className={`px-2 py-1 rounded ${statusColors[status as keyof typeof statusColors]}`}>
                        {status}
                      </span>
                      <span className="ml-2 text-gray-600">
                        ({monitoringDays} hari dari {workDaysThreshold} hari kerja)
                      </span>
                    </div>
                  );
                })() : (
                  <span className="text-gray-500 text-sm">Pilih tanggal terakhir cuti untuk auto status</span>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                className="bg-red-600 hover:bg-red-700"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : 
                 editingItem ? "Update" : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Excel Monitoring Roster Cuti</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>File Excel (.xlsx, .csv)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    setUploadProgress(0);
                  }
                }}
                data-testid="input-excel-file"
              />
              {uploadFile && (
                <p className="text-sm text-gray-600 mt-1">
                  File dipilih: {uploadFile.name}
                </p>
              )}
            </div>

            {uploadProgress > 0 && (
              <div>
                <Label>Progress Upload</Label>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">{uploadProgress}%</p>
              </div>
            )}

            <div className="bg-green-50 p-4 rounded-md">
              <p className="text-sm text-green-800">
                <strong>Format Excel dengan Bulan:</strong><br/>
                • Kolom 1: <strong>NIK</strong> (wajib)<br/>
                • Kolom 2: <strong>Nama</strong> (wajib)<br/>
                • Kolom 3: <strong>Tanggal Terakhir Cuti</strong> (opsional, format: YYYY-MM-DD)<br/>
                • Kolom 4: <strong>Pilihan Cuti</strong> (opsional, 70 atau 35, default: 70)<br/>
                • Kolom 5: <strong>Bulan</strong> (opsional, format: YYYY-MM, default: bulan ini)<br/><br/>
                
                📅 <strong>Fitur Baru - Per Bulan:</strong><br/>
                ✓ Setiap NIK bisa ada di berbagai bulan<br/>
                ✓ Upload roster per bulan untuk tracking berkala<br/>
                ✓ Monitoring hari dan status per periode bulanan<br/><br/>
                
                <strong>OTOMATIS DIHITUNG:</strong><br/>
                ✓ Investor Group: Berdasarkan range NIK<br/>
                ✓ Monitoring Hari: Dari tanggal terakhir cuti<br/>
                ✓ Status: Berdasarkan threshold monitoring hari<br/>
                ✓ Tanggal Cuti Berikutnya: Auto calculate
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setUploadFile(null);
                  setUploadProgress(0);
                }}
                data-testid="button-cancel-upload"
              >
                Batal
              </Button>
              <Button 
                onClick={handleExcelUpload}
                className="bg-red-600 hover:bg-red-700"
                disabled={!uploadFile || uploadExcelMutation.isPending}
                data-testid="button-start-upload"
              >
                {uploadExcelMutation.isPending ? "Mengupload..." : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}