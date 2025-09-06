import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSimperMonitoringSchema } from "@shared/schema";
import type { SimperMonitoring, InsertSimperMonitoring } from "@shared/schema";
import { Plus, Search, Edit, Trash2, Upload, AlertCircle, Download, Eye, Calendar, Clock, Users } from "lucide-react";
import { z } from "zod";
import * as XLSX from "xlsx";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const formSchema = insertSimperMonitoringSchema.extend({
  id: z.string().optional(),
});

interface SimperAnalytics {
  totalKaryawan: number;
  bibStats: {
    segera: number;
    mendekati: number;
    menuju: number;
    aktif: number;
  };
  tiaStats: {
    segera: number;
    mendekati: number;
    menuju: number;
    aktif: number;
  };
  criticalList: any[];
  processedData: any[];
}

export default function SimperMonitoring() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSimper, setSelectedSimper] = useState<SimperMonitoring | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch SIMPER data
  const { data: simperData = [], isLoading } = useQuery({
    queryKey: ["/api/simper-monitoring"],
    refetchInterval: 30000,
  });

  // Fetch analytics data
  const { data: analytics } = useQuery<SimperAnalytics>({
    queryKey: ["/api/simper-monitoring/analytics"],
    refetchInterval: 30000,
  });

  // Form for create/edit SIMPER
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeName: "",
      nik: "",
      simperBibExpiredDate: "",
      simperTiaExpiredDate: "",
    },
  });

  // Create/Update SIMPER mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertSimperMonitoring) => {
      const response = await fetch("/api/simper-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create SIMPER");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring/analytics"] });
      setIsEditDialogOpen(false);
      form.reset();
      toast({
        title: "Berhasil",
        description: "Data SIMPER berhasil disimpan",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan data SIMPER",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSimperMonitoring> }) => {
      const response = await fetch(`/api/simper-monitoring/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update SIMPER");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring/analytics"] });
      setIsEditDialogOpen(false);
      setSelectedSimper(null);
      form.reset();
      toast({
        title: "Berhasil",
        description: "Data SIMPER berhasil diperbarui",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui data SIMPER",
        variant: "destructive",
      });
    },
  });

  // Delete SIMPER mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/simper-monitoring/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete SIMPER");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring/analytics"] });
      toast({
        title: "Berhasil",
        description: "Data SIMPER berhasil dihapus",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus data SIMPER",
        variant: "destructive",
      });
    },
  });

  // Delete all SIMPER mutation
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/simper-monitoring", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete all SIMPER");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring/analytics"] });
      toast({
        title: "Berhasil",
        description: "Semua data SIMPER berhasil dihapus",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Gagal menghapus semua data SIMPER",
        variant: "destructive",
      });
    },
  });

  // Excel upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return fetch("/api/simper-monitoring/upload-excel", {
        method: "POST",
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/simper-monitoring/analytics"] });
      setIsUploadDialogOpen(false);
      toast({
        title: "Upload Berhasil",
        description: `${result.success} data berhasil diproses. ${result.errors?.length || 0} error.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Upload",
        description: error.message || "Gagal mengupload file Excel",
        variant: "destructive",
      });
    },
  });

  // Format date to dd-mm-yyyy
  const formatDateToDDMMYYYY = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return "-";
    }
  };

  // Get monitoring days and status
  const getMonitoringStatus = (expiredDate: string | null) => {
    if (!expiredDate) return { days: null, status: "Tidak Ada Data", variant: "outline" as const };
    
    const expired = new Date(expiredDate);
    const today = new Date();
    const diffTime = expired.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { days: diffDays, status: "Segera Perpanjang", variant: "destructive" as const };
    if (diffDays < 7) return { days: diffDays, status: "Mendekati Perpanjangan", variant: "default" as const };
    if (diffDays < 30) return { days: diffDays, status: "Menuju Perpanjangan", variant: "secondary" as const };
    return { days: diffDays, status: "Aktif", variant: "outline" as const };
  };

  // Filter data based on search and status filter
  const filteredData = (simperData as SimperMonitoring[]).filter((item: SimperMonitoring) => {
    const matchesSearch = 
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nik.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (statusFilter === "all") return true;
    
    const bibStatus = getMonitoringStatus(item.simperBibExpiredDate);
    const tiaStatus = getMonitoringStatus(item.simperTiaExpiredDate);
    
    if (statusFilter === "bib") return bibStatus.status !== "Tidak Ada Data";
    if (statusFilter === "tia") return tiaStatus.status !== "Tidak Ada Data";
    
    return true;
  });

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
    if (selectedSimper) {
      updateMutation.mutate({ id: selectedSimper.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (simper: SimperMonitoring) => {
    setSelectedSimper(simper);
    form.reset({
      employeeName: simper.employeeName,
      nik: simper.nik,
      simperBibExpiredDate: simper.simperBibExpiredDate || "",
      simperTiaExpiredDate: simper.simperTiaExpiredDate || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data SIMPER ini?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDeleteAll = () => {
    if (confirm("Apakah Anda yakin ingin menghapus SEMUA data SIMPER? Tindakan ini tidak dapat dibatalkan!")) {
      deleteAllMutation.mutate();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Nama Karyawan": "Contoh Nama",
        "NIK": "C-000000",
        "Tanggal SIMPER BIB Mati": "2024-12-31",
        "Tanggal SIMPER TIA Mati": "2024-12-31"
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template SIMPER");
    XLSX.writeFile(wb, "Template_SIMPER_Monitoring.xlsx");
  };

  // Chart data for analytics
  const chartData = analytics ? {
    labels: ['Segera Perpanjang', 'Mendekati Perpanjangan', 'Menuju Perpanjangan', 'Aktif'],
    datasets: [
      {
        label: 'SIMPER BIB',
        data: [analytics.bibStats.segera, analytics.bibStats.mendekati, analytics.bibStats.menuju, analytics.bibStats.aktif],
        backgroundColor: '#E53935',
        borderColor: '#C62828',
        borderWidth: 1,
      },
      {
        label: 'SIMPER TIA',
        data: [analytics.tiaStats.segera, analytics.tiaStats.mendekati, analytics.tiaStats.menuju, analytics.tiaStats.aktif],
        backgroundColor: '#1E88E5',
        borderColor: '#1565C0',
        borderWidth: 1,
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Status SIMPER BIB vs TIA'
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-[#E53935]">
          Monitoring SIMPER Karyawan
        </h1>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-900">
            {currentTime.toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <p className="text-sm text-gray-500">
            {currentTime.toLocaleTimeString('id-ID')}
          </p>
        </div>
      </div>

      {/* Dashboard Statistics */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Total Karyawan */}
          <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Karyawan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="h-8 w-8 text-gray-600 mr-2" />
                <span className="text-2xl font-bold">{analytics.totalKaryawan}</span>
              </div>
            </CardContent>
          </Card>

          {/* BIB Statistics */}
          <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-red-50 to-red-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700">SIMPER BIB</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-red-600">Segera Perpanjang:</span>
                <Badge variant="destructive" className="text-xs">{analytics.bibStats.segera}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-red-600">Mendekati:</span>
                <Badge variant="default" className="text-xs bg-yellow-500">{analytics.bibStats.mendekati}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-red-600">Menuju:</span>
                <Badge variant="secondary" className="text-xs bg-orange-500">{analytics.bibStats.menuju}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-red-600">Aktif:</span>
                <Badge variant="outline" className="text-xs bg-green-500 text-white">{analytics.bibStats.aktif}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* TIA Statistics */}
          <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">SIMPER TIA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-blue-600">Segera Perpanjang:</span>
                <Badge variant="destructive" className="text-xs">{analytics.tiaStats.segera}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-blue-600">Mendekati:</span>
                <Badge variant="default" className="text-xs bg-yellow-500">{analytics.tiaStats.mendekati}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-blue-600">Menuju:</span>
                <Badge variant="secondary" className="text-xs bg-orange-500">{analytics.tiaStats.menuju}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-blue-600">Aktif:</span>
                <Badge variant="outline" className="text-xs bg-green-500 text-white">{analytics.tiaStats.aktif}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Critical List Card */}
          <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-yellow-50 to-yellow-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-700">Daftar Kritis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {analytics.criticalList.slice(0, 3).map((item, index) => (
                  <div key={index} className="text-xs">
                    <span className="font-semibold">{item.employeeName}</span>
                    <div className="text-gray-600">{item.nik}</div>
                  </div>
                ))}
                {analytics.criticalList.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{analytics.criticalList.length - 3} lainnya
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      {chartData && (
        <Card className="rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle>Grafik Status SIMPER</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control Panel */}
      <Card className="rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Kelola Data SIMPER</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#E53935] hover:bg-[#C62828]" data-testid="button-upload-excel">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Excel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Data SIMPER dari Excel</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Button 
                    onClick={downloadTemplate} 
                    variant="outline"
                    data-testid="button-download-template"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    data-testid="input-excel-file"
                  />
                  <p className="text-sm text-gray-600">
                    Upload file Excel dengan kolom: Nama Karyawan, NIK, Tanggal SIMPER BIB Mati, Tanggal SIMPER TIA Mati
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-simper">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Data
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {selectedSimper ? "Edit Data SIMPER" : "Tambah Data SIMPER"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="employeeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nama Karyawan</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-employee-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nik"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NIK</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-nik" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="simperBibExpiredDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tanggal SIMPER BIB Mati</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-bib-expired" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="simperTiaExpiredDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tanggal SIMPER TIA Mati</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-tia-expired" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditDialogOpen(false);
                          setSelectedSimper(null);
                          form.reset();
                        }}
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        className="bg-[#E53935] hover:bg-[#C62828]"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-save-simper"
                      >
                        {selectedSimper ? "Update" : "Simpan"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Button 
              onClick={handleDeleteAll} 
              variant="destructive"
              data-testid="button-delete-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus Semua Data
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari nama karyawan atau NIK..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="bib">SIMPER BIB</SelectItem>
                <SelectItem value="tia">SIMPER TIA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Tabel Monitoring SIMPER</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Karyawan</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>Tanggal SIMPER BIB Mati</TableHead>
                    <TableHead>Monitoring Hari BIB</TableHead>
                    <TableHead>Status SIMPER BIB</TableHead>
                    <TableHead>Tanggal SIMPER TIA Mati</TableHead>
                    <TableHead>Monitoring Hari TIA</TableHead>
                    <TableHead>Status SIMPER TIA</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((simper: SimperMonitoring) => {
                    const bibStatus = getMonitoringStatus(simper.simperBibExpiredDate);
                    const tiaStatus = getMonitoringStatus(simper.simperTiaExpiredDate);
                    
                    return (
                      <TableRow key={simper.id} className="hover:bg-[#F5F5F5] transition-colors">
                        <TableCell className="font-medium">{simper.employeeName}</TableCell>
                        <TableCell>{simper.nik}</TableCell>
                        <TableCell>
                          {formatDateToDDMMYYYY(simper.simperBibExpiredDate)}
                        </TableCell>
                        <TableCell>
                          {bibStatus.days !== null ? `${bibStatus.days} hari` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={bibStatus.variant}>
                            {bibStatus.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDateToDDMMYYYY(simper.simperTiaExpiredDate)}
                        </TableCell>
                        <TableCell>
                          {tiaStatus.days !== null ? `${tiaStatus.days} hari` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tiaStatus.variant}>
                            {tiaStatus.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(simper)}
                              data-testid={`button-edit-${simper.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(simper.id)}
                              data-testid={`button-delete-${simper.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada data SIMPER yang ditemukan
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Critical List Table */}
      {analytics && analytics.criticalList.length > 0 && (
        <Card className="rounded-2xl shadow-lg border-yellow-200">
          <CardHeader className="bg-yellow-50">
            <CardTitle className="text-yellow-800 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Daftar SIMPER Kritis (10 Terdekat)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Karyawan</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>BIB Status</TableHead>
                    <TableHead>TIA Status</TableHead>
                    <TableHead>Hari Tersisa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.criticalList.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.employeeName}</TableCell>
                      <TableCell>{item.nik}</TableCell>
                      <TableCell>
                        <Badge variant={item.bibStatus === 'Segera Perpanjang' ? 'destructive' : 'secondary'}>
                          {item.bibStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.tiaStatus === 'Segera Perpanjang' ? 'destructive' : 'secondary'}>
                          {item.tiaStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          Math.min(item.bibMonitoringDays || 999, item.tiaMonitoringDays || 999) < 0 
                            ? 'text-red-600' 
                            : Math.min(item.bibMonitoringDays || 999, item.tiaMonitoringDays || 999) < 7
                              ? 'text-yellow-600'
                              : 'text-orange-600'
                        }`}>
                          {Math.min(item.bibMonitoringDays || 999, item.tiaMonitoringDays || 999)} hari
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}