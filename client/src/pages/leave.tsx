import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaveRequestSchema } from "@shared/schema";
import type { Employee, LeaveRequest, InsertLeaveRequest } from "@shared/schema";
import { 
  CalendarDays, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  User, 
  Phone,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
  Users,
  Calendar,
  Target,
  FileText,
  BarChart3,
  Building2,
  Bell,
  Send,
  History,
  MessageSquare
} from "lucide-react";
import { z } from "zod";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
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
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const formSchema = insertLeaveRequestSchema.omit({ employeeName: true });

// Types for upload roster
interface LeaveRosterData {
  nik: string;
  nama: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
}

// Types for analytics
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

// Types for monitoring
interface LeaveReminder {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePhone: string;
  leaveStartDate: string;
  leaveEndDate: string;
  daysUntil: number;
  reminderType: '7_days' | '3_days' | '1_day';
  sent: boolean;
}

interface ReminderHistory {
  id: string;
  leaveRequestId: string;
  employeeId: string;
  reminderType: string;
  sentAt: string;
  phoneNumber: string;
  message: string;
}

export default function Leave() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadedAttachmentPath, setUploadedAttachmentPath] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("pengajuan");
  
  // Upload Roster States
  const [file, setFile] = useState<File | null>(null);
  const [isUploadingRoster, setIsUploadingRoster] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Analytics States
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: leaveRequests = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave"],
  });

  // Analytics queries
  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery<LeaveAnalyticsOverview>({
    queryKey: ["/api/leave-analytics/overview", selectedYear],
    refetchInterval: 60000,
  });

  const { data: departmentData = [], isLoading: loadingDepartments } = useQuery<DepartmentStats[]>({
    queryKey: ["/api/leave-analytics/department", selectedYear],
    refetchInterval: 60000,
  });

  // Monitoring queries
  const { data: upcomingLeaves = [], isLoading: loadingUpcoming } = useQuery<LeaveReminder[]>({
    queryKey: ["/api/leave-monitoring/upcoming"],
    refetchInterval: 30000,
  });

  const { data: reminderHistory = [], isLoading: loadingHistory } = useQuery<ReminderHistory[]>({
    queryKey: ["/api/leave-monitoring/history"],
    refetchInterval: 60000,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      phoneNumber: "",
      startDate: "",
      endDate: "",
      leaveType: "",
      reason: "",
      status: "pending",
    },
  });

  // Auto-fill nomor WhatsApp berdasarkan employee selection
  const selectedEmployeeId = form.watch("employeeId");
  useEffect(() => {
    if (selectedEmployeeId && employees.length > 0) {
      const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
      if (selectedEmployee) {
        form.setValue("phoneNumber", selectedEmployee.phone || "");
      }
    }
  }, [selectedEmployeeId, employees, form]);

  const createMutation = useMutation({
    mutationFn: (data: InsertLeaveRequest) => apiRequest("POST", "/api/leave", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      form.reset();
      setUploadedAttachmentPath("");
      setIsUploading(false);
      toast({
        title: "Berhasil",
        description: "Pengajuan cuti berhasil dibuat",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal membuat pengajuan cuti",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PUT", `/api/leave/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      toast({
        title: "Berhasil",
        description: "Status cuti berhasil diperbarui",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal memperbarui status cuti",
        variant: "destructive",
      });
    },
  });

  // Upload Roster mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: LeaveRosterData[]): Promise<{ success: number; errors: string[] }> => {
      const response = await apiRequest("POST", "/api/leave-roster/bulk-upload", { leaveData: data });
      return await response.json();
    },
    onSuccess: (result: { success: number; errors: string[] }) => {
      setUploadResults(result);
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      
      if (result.errors.length === 0) {
        toast({
          title: "Upload Berhasil",
          description: `${result.success} data roster cuti berhasil diupload`,
        });
      } else {
        toast({
          title: "Upload Selesai dengan Error",
          description: `${result.success} berhasil, ${result.errors.length} gagal`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Upload Gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat upload",
        variant: "destructive",
      });
    },
  });

  // Send reminders mutation
  const sendRemindersMutation = useMutation({
    mutationFn: () => fetch('/api/leave-monitoring/send-reminders', { method: 'POST' }).then(res => res.json()),
    onSuccess: (data) => {
      toast({
        title: "Pengingat Terkirim",
        description: `${data.sent} pengingat berhasil dikirim, ${data.failed} gagal`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-monitoring/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-monitoring/history"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal mengirim pengingat cuti",
        variant: "destructive",
      });
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const selectedEmployee = employees.find(emp => emp.id === values.employeeId);
    if (!selectedEmployee) {
      toast({
        title: "Error",
        description: "Karyawan tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...values,
      employeeName: selectedEmployee.name,
      attachmentPath: uploadedAttachmentPath || undefined
    };
    createMutation.mutate(submitData);
  };

  const handleGetUploadParameters = async () => {
    try {
      setIsUploading(true);
      const response = await apiRequest("POST", "/api/objects/upload");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload service unavailable');
      }
      
      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      setIsUploading(false);
      toast({
        title: "Error", 
        description: error instanceof Error ? error.message : "Layanan upload tidak tersedia saat ini",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    setIsUploading(false);
    if (result.successful && result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      if (uploadURL) {
        try {
          const normalizeResponse = await apiRequest("POST", "/api/objects/normalize", {
            uploadURL: uploadURL
          });
          const normalizeData = await normalizeResponse.json();
          const normalizedPath = normalizeData.objectPath;
          setUploadedAttachmentPath(normalizedPath);
          toast({
            title: "Berhasil",
            description: "File PDF berhasil diupload",
          });
        } catch (normalizeError) {
          setUploadedAttachmentPath(uploadURL);
          toast({
            title: "Berhasil",
            description: "File PDF berhasil diupload",
          });
        }
      }
    } else if (result.failed && result.failed.length > 0) {
      toast({
        title: "Error",
        description: "Gagal mengupload file PDF",
        variant: "destructive",
      });
    }
  };

  const getEmployeeName = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId)?.name || 'Unknown';
  };

  const getLeaveTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'annual': 'Cuti Tahunan',
      'sick': 'Cuti Sakit',
      'personal': 'Cuti Pribadi',
      'maternity': 'Cuti Melahirkan'
    };
    return types[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="status-present">Disetujui</Badge>;
      case 'rejected':
        return <Badge className="status-absent">Ditolak</Badge>;
      default:
        return <Badge className="status-pending">Menunggu</Badge>;
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const convertToProxyPath = (attachmentPath: string): string => {
    if (!attachmentPath || !attachmentPath.startsWith("https://storage.googleapis.com/")) {
      return attachmentPath;
    }
    
    const url = new URL(attachmentPath);
    const pathname = url.pathname;
    
    const uploadsIndex = pathname.indexOf("/.private/uploads/");
    if (uploadsIndex !== -1) {
      const objectId = pathname.substring(uploadsIndex + "/.private/uploads/".length);
      return `/objects/uploads/${objectId}`;
    }
    
    return attachmentPath;
  };

  const filteredLeaveRequests = leaveRequests.filter(request => 
    statusFilter === "all" || request.status === statusFilter
  );

  const handleApprove = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'approved' });
  };

  const handleReject = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'rejected' });
  };

  // Upload Roster functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      
      if (allowedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setUploadResults(null);
      } else {
        toast({
          title: "Format File Tidak Valid",
          description: "Hanya file Excel (.xlsx, .xls) yang diperbolehkan",
          variant: "destructive",
        });
      }
    }
  };

  const processExcelFile = async (file: File): Promise<LeaveRosterData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const dataRows = jsonData.slice(1) as any[][];
          
          const leaveData: LeaveRosterData[] = dataRows
            .filter(row => row.length >= 5 && row[0])
            .map((row, index) => {
              const startDate = parseExcelDate(row[2]);
              const endDate = parseExcelDate(row[3]);
              
              if (!startDate || !endDate) {
                throw new Error(`Baris ${index + 2}: Format tanggal tidak valid`);
              }

              return {
                nik: String(row[0]).trim(),
                nama: "",
                leaveType: String(row[1] || "Cuti Tahunan").trim(),
                startDate: startDate,
                endDate: endDate,
                totalDays: parseInt(String(row[4])) || calculateDaysBetween(startDate, endDate),
                reason: String(row[5] || "Bulk upload roster cuti").trim(),
              };
            });

          resolve(leaveData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Gagal membaca file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    
    if (typeof value === "string") {
      const parts = value.split(/[\/\-]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    
    if (typeof value === "number") {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        const year = date.y;
        const month = String(date.m).padStart(2, '0');
        const day = String(date.d).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    return null;
  };

  const calculateDaysBetween = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleUploadRoster = async () => {
    if (!file) {
      toast({
        title: "File Belum Dipilih",
        description: "Silakan pilih file Excel terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingRoster(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 85));
      }, 1000);

      const leaveData = await processExcelFile(file);
      
      clearInterval(progressInterval);
      setUploadProgress(95);

      await uploadMutation.mutateAsync(leaveData);
      
      setUploadProgress(100);
    } catch (error) {
      toast({
        title: "Error Proses File",
        description: error instanceof Error ? error.message : "Gagal memproses file Excel",
        variant: "destructive",
      });
    } finally {
      setIsUploadingRoster(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/api/leave-roster/template';
    link.download = 'template-roster-cuti.csv';
    link.click();
    
    toast({
      title: "Template Downloaded",
      description: "Template CSV berhasil didownload",
    });
  };

  // Analytics functions
  const generateChartData = () => {
    if (!analyticsData) return {};

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

    const leaveTypeChartData = {
      labels: Object.keys(analyticsData.leaveTypeDistribution),
      datasets: [{
        data: Object.values(analyticsData.leaveTypeDistribution),
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };

    return { monthlyChartData, leaveTypeChartData };
  };

  const { monthlyChartData, leaveTypeChartData } = generateChartData();

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

  // Monitoring functions
  const getReminderTypeText = (type: string) => {
    switch (type) {
      case '7_days': return '7 Hari';
      case '3_days': return '3 Hari';
      case '1_day': return '1 Hari';
      default: return type;
    }
  };

  const getReminderTypeColor = (type: string) => {
    switch (type) {
      case '7_days': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case '3_days': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case '1_day': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Cuti</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Sistem manajemen cuti terpadu dengan analitik dan monitoring</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pengajuan" className="text-xs">📝 Pengajuan</TabsTrigger>
          <TabsTrigger value="upload-roster" className="text-xs">📤 Upload Roster</TabsTrigger>
          <TabsTrigger value="evaluasi" className="text-xs">📊 Evaluasi</TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs">🔔 Monitoring</TabsTrigger>
          <TabsTrigger value="daftar" className="text-xs">📋 Daftar Cuti</TabsTrigger>
        </TabsList>

        <TabsContent value="pengajuan" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Compact Leave Form */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Ajukan Cuti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Karyawan</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" data-testid="leave-employee-select">
                            <SelectValue placeholder="-- Pilih Karyawan --" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.id} - {employee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Nomor WhatsApp</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          className="h-9 bg-gray-50 dark:bg-gray-800"
                          placeholder="Nomor akan terisi otomatis"
                          readOnly
                          data-testid="leave-phone-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Tanggal Mulai</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          className="h-9"
                          data-testid="leave-start-date-input"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Tanggal Selesai</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          className="h-9"
                          data-testid="leave-end-date-input"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Jenis Cuti</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" data-testid="leave-type-select">
                            <SelectValue placeholder="-- Pilih Jenis Cuti --" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="annual">Cuti Tahunan</SelectItem>
                          <SelectItem value="sick">Cuti Sakit</SelectItem>
                          <SelectItem value="personal">Cuti Pribadi</SelectItem>
                          <SelectItem value="maternity">Cuti Melahirkan</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Keterangan</FormLabel>
                      <FormControl>
                        <Textarea 
                          rows={2} 
                          className="resize-none"
                          placeholder="Keterangan cuti..." 
                          {...field}
                          value={field.value || ""} 
                          data-testid="leave-reason-textarea"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Compact File Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Lampiran (Opsional)</label>
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10485760}
                    allowedFileTypes={['.pdf']}
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handleUploadComplete}
                    buttonClassName="w-full h-8 text-xs"
                  >
                    📎 Upload PDF
                  </ObjectUploader>
                  {uploadedAttachmentPath && (
                    <p className="text-xs text-green-600 dark:text-green-400">✓ File uploaded</p>
                  )}
                  {isUploading && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">Uploading...</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-9"
                  disabled={createMutation.isPending}
                  data-testid="submit-leave-button"
                >
                  {createMutation.isPending ? "Mengajukan..." : "Ajukan Cuti"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Compact Leave List */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Daftar Cuti</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9" data-testid="leave-status-filter">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Karyawan</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Tanggal</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Jenis</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Durasi</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Lampiran</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Status</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredLeaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        Tidak ada data cuti
                      </td>
                    </tr>
                  ) : (
                    filteredLeaveRequests.map((request) => (
                      <tr key={request.id} data-testid={`leave-row-${request.id}`}>
                        <td className="py-2 px-2 text-xs text-gray-900 dark:text-white">
                          <div className="font-medium">{getEmployeeName(request.employeeId)}</div>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-900 dark:text-white">
                          <div>{new Date(request.startDate).toLocaleDateString('id-ID')}</div>
                          <div className="text-gray-500">-</div>
                          <div>{new Date(request.endDate).toLocaleDateString('id-ID')}</div>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-900 dark:text-white">
                          {getLeaveTypeLabel(request.leaveType)}
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-900 dark:text-white text-center">
                          <span className="font-medium">{calculateDays(request.startDate, request.endDate)}</span> hari
                        </td>
                        <td className="py-2 px-2 text-xs text-center">
                          {request.attachmentPath ? (
                            <a 
                              href={convertToProxyPath(request.attachmentPath)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-red-600 hover:text-red-700 dark:text-red-400 text-xs"
                              title="Lihat lampiran PDF"
                            >
                              📎
                            </a>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="py-2 px-2">
                          {request.status === 'pending' ? (
                            <div className="flex flex-col space-y-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(request.id)}
                                disabled={updateStatusMutation.isPending}
                                className="text-green-600 hover:text-green-700 h-7 text-xs"
                                data-testid={`approve-leave-${request.id}`}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Setujui
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(request.id)}
                                disabled={updateStatusMutation.isPending}
                                className="text-red-600 hover:text-red-700 h-7 text-xs"
                                data-testid={`reject-leave-${request.id}`}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Tolak
                              </Button>
                            </div>
                          ) : (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 hover:text-blue-700 h-7 text-xs"
                                  data-testid={`detail-leave-${request.id}`}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Detail
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Detail Pengajuan Cuti</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="flex items-center space-x-2">
                                    <User className="w-4 h-4 text-gray-500" />
                                    <div>
                                      <p className="font-medium">{request.employeeName || getEmployeeName(request.employeeId)}</p>
                                      <p className="text-sm text-gray-500">{request.employeeId}</p>
                                    </div>
                                  </div>
                                  
                                  {request.phoneNumber && (
                                    <div className="flex items-center space-x-2">
                                      <Phone className="w-4 h-4 text-gray-500" />
                                      <p className="text-sm">{request.phoneNumber}</p>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center space-x-2">
                                    <CalendarDays className="w-4 h-4 text-gray-500" />
                                    <div>
                                      <p className="text-sm">
                                        {new Date(request.startDate).toLocaleDateString('id-ID', {
                                          weekday: 'long',
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric'
                                        })}
                                      </p>
                                      <p className="text-sm">s/d</p>
                                      <p className="text-sm">
                                        {new Date(request.endDate).toLocaleDateString('id-ID', {
                                          weekday: 'long',
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric'
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <div>
                                      <p className="text-sm font-medium">{getLeaveTypeLabel(request.leaveType)}</p>
                                      <p className="text-sm text-gray-500">
                                        Durasi: {calculateDays(request.startDate, request.endDate)} hari
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {request.reason && (
                                    <div>
                                      <p className="font-medium text-sm mb-1">Keterangan:</p>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        {request.reason}
                                      </p>
                                    </div>
                                  )}

                                  {request.attachmentPath && (
                                    <div>
                                      <p className="font-medium text-sm mb-2">Lampiran Dokumen:</p>
                                      <a 
                                        href={convertToProxyPath(request.attachmentPath)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-red-600 hover:text-red-700 dark:text-red-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                      >
                                        <span>📎</span>
                                        <span className="text-sm">Lihat File PDF</span>
                                      </a>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center justify-between pt-4 border-t">
                                    <span className="text-sm text-gray-500">Status:</span>
                                    {getStatusBadge(request.status)}
                                  </div>
                                  
                                  {request.status === 'pending' && (
                                    <div className="flex space-x-2 pt-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleApprove(request.id)}
                                        disabled={updateStatusMutation.isPending}
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Setujui
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleReject(request.id)}
                                        disabled={updateStatusMutation.isPending}
                                        className="flex-1"
                                      >
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Tolak
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="upload-roster" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Template Download */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Download className="h-5 w-5 text-red-600" />
                  Download Template
                </CardTitle>
                <CardDescription className="text-sm">
                  Template Excel untuk upload roster cuti massal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={downloadTemplate}
                  variant="outline"
                  className="w-full flex items-center gap-2"
                  data-testid="button-download-template"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Download Template
                </Button>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p><strong>Format kolom:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>NIK Karyawan</li>
                    <li>Jenis Cuti</li>
                    <li>Tanggal Mulai</li>
                    <li>Tanggal Selesai</li>
                    <li>Total Hari</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Upload File */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="h-5 w-5 text-red-600" />
                  Upload File Excel
                </CardTitle>
                <CardDescription className="text-sm">
                  Pilih file Excel roster cuti untuk diupload
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="file-upload" className="text-sm">File Excel (.xlsx, .xls)</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    ref={fileInputRef}
                    className="h-9"
                    data-testid="input-file-upload"
                  />
                </div>

                {file && (
                  <Alert>
                    <FileSpreadsheet className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                    </AlertDescription>
                  </Alert>
                )}

                {isUploadingRoster && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Mengupload data...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}

                <Button
                  onClick={handleUploadRoster}
                  disabled={!file || isUploadingRoster || uploadMutation.isPending}
                  className="w-full h-9"
                  data-testid="button-upload"
                >
                  {isUploadingRoster || uploadMutation.isPending ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Mengupload...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Roster
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Upload Results */}
            {uploadResults && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {uploadResults.errors.length === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    Hasil Upload
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        {uploadResults.success}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">
                        Berhasil
                      </div>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-xl font-bold text-red-600 dark:text-red-400">
                        {uploadResults.errors.length}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400">
                        Gagal
                      </div>
                    </div>
                  </div>

                  {uploadResults.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600 dark:text-red-400 text-sm">Error Details:</h4>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {uploadResults.errors.map((error, index) => (
                          <div key={index} className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="evaluasi" className="space-y-4">
          {loadingAnalytics || loadingDepartments ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard Evaluasi Cuti</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Analisis komprehensif manajemen cuti karyawan
                  </p>
                </div>
                
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <TrendingUp className="w-5 h-5 mr-2 text-red-600" />
                      Tren Cuti Bulanan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {monthlyChartData && (
                        <Bar data={monthlyChartData} options={chartOptions} />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <BarChart3 className="w-5 h-5 mr-2 text-red-600" />
                      Distribusi Jenis Cuti
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {leaveTypeChartData && (
                        <Doughnut data={leaveTypeChartData} options={doughnutOptions} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Monitoring Cuti</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sistem monitoring dan pengingat cuti otomatis via WhatsApp
              </p>
            </div>
            <Button
              onClick={() => sendRemindersMutation.mutate()}
              disabled={sendRemindersMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-send-reminders"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendRemindersMutation.isPending ? "Mengirim..." : "Kirim Pengingat"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Upcoming Reminders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="w-5 h-5 text-red-600" />
                  Pengingat Mendatang
                </CardTitle>
                <CardDescription>
                  Pengingat cuti yang akan dikirim dalam 7, 3, atau 1 hari
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingUpcoming ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : upcomingLeaves.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Tidak ada pengingat cuti mendatang</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {upcomingLeaves.map((reminder: LeaveReminder) => (
                      <div key={reminder.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-sm">{reminder.employeeName}</span>
                          </div>
                          <Badge className={getReminderTypeColor(reminder.reminderType)}>
                            {getReminderTypeText(reminder.reminderType)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {format(parseISO(reminder.leaveStartDate), "dd MMM yyyy", { locale: localeId })} - {" "}
                              {format(parseISO(reminder.leaveEndDate), "dd MMM yyyy", { locale: localeId })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>{reminder.daysUntil} hari lagi</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reminder History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="w-5 h-5 text-red-600" />
                  Riwayat Pengingat
                </CardTitle>
                <CardDescription>
                  Daftar pengingat yang telah dikirim via WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : reminderHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Belum ada riwayat pengingat</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {reminderHistory.map((history: ReminderHistory) => (
                      <div key={history.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-sm">ID: {history.employeeId}</span>
                          </div>
                          <Badge className={getReminderTypeColor(history.reminderType)}>
                            {getReminderTypeText(history.reminderType)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>
                              {format(parseISO(history.sentAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" />
                            <span>{history.phoneNumber}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="daftar" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Daftar Permohonan Cuti</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-9" data-testid="leave-status-filter">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="pending">Menunggu</SelectItem>
                    <SelectItem value="approved">Disetujui</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            
            <CardContent className="p-3">
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Karyawan</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Tanggal</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Jenis</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Durasi</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Lampiran</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Status</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white text-xs">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                          Loading...
                        </td>
                      </tr>
                    ) : filteredLeaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                          Tidak ada data cuti
                        </td>
                      </tr>
                    ) : (
                      filteredLeaveRequests.map((request) => (
                        <tr key={request.id} data-testid={`leave-row-${request.id}`}>
                          <td className="py-2 px-2 text-xs text-gray-900 dark:text-white">
                            <div className="font-medium">{getEmployeeName(request.employeeId)}</div>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-900 dark:text-white">
                            <div>{new Date(request.startDate).toLocaleDateString('id-ID')}</div>
                            <div className="text-gray-500">-</div>
                            <div>{new Date(request.endDate).toLocaleDateString('id-ID')}</div>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-900 dark:text-white">
                            {getLeaveTypeLabel(request.leaveType)}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-900 dark:text-white text-center">
                            <span className="font-medium">{calculateDays(request.startDate, request.endDate)}</span> hari
                          </td>
                          <td className="py-2 px-2 text-xs text-center">
                            {request.attachmentPath ? (
                              <a 
                                href={convertToProxyPath(request.attachmentPath)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-red-600 hover:text-red-700 dark:text-red-400 text-xs"
                                title="Lihat lampiran PDF"
                              >
                                📎
                              </a>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {getStatusBadge(request.status)}
                          </td>
                          <td className="py-2 px-2">
                            {request.status === 'pending' ? (
                              <div className="flex flex-col space-y-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApprove(request.id)}
                                  disabled={updateStatusMutation.isPending}
                                  className="text-green-600 hover:text-green-700 h-7 text-xs"
                                  data-testid={`approve-leave-${request.id}`}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Setujui
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReject(request.id)}
                                  disabled={updateStatusMutation.isPending}
                                  className="text-red-600 hover:text-red-700 h-7 text-xs"
                                  data-testid={`reject-leave-${request.id}`}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Tolak
                                </Button>
                              </div>
                            ) : (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-blue-600 hover:text-blue-700 h-7 text-xs"
                                    data-testid={`detail-leave-${request.id}`}
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    Detail
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Detail Pengajuan Cuti</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="flex items-center space-x-2">
                                      <User className="w-4 h-4 text-gray-500" />
                                      <div>
                                        <p className="font-medium">{request.employeeName || getEmployeeName(request.employeeId)}</p>
                                        <p className="text-sm text-gray-500">{request.employeeId}</p>
                                      </div>
                                    </div>
                                    
                                    {request.phoneNumber && (
                                      <div className="flex items-center space-x-2">
                                        <Phone className="w-4 h-4 text-gray-500" />
                                        <p className="text-sm">{request.phoneNumber}</p>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center space-x-2">
                                      <CalendarDays className="w-4 h-4 text-gray-500" />
                                      <div>
                                        <p className="text-sm">
                                          {new Date(request.startDate).toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                          })}
                                        </p>
                                        <p className="text-sm">s/d</p>
                                        <p className="text-sm">
                                          {new Date(request.endDate).toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                          })}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      <Clock className="w-4 h-4 text-gray-500" />
                                      <div>
                                        <p className="text-sm font-medium">{getLeaveTypeLabel(request.leaveType)}</p>
                                        <p className="text-sm text-gray-500">
                                          Durasi: {calculateDays(request.startDate, request.endDate)} hari
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {request.reason && (
                                      <div>
                                        <p className="font-medium text-sm mb-1">Keterangan:</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                          {request.reason}
                                        </p>
                                      </div>
                                    )}

                                    {request.attachmentPath && (
                                      <div>
                                        <p className="font-medium text-sm mb-2">Lampiran Dokumen:</p>
                                        <a 
                                          href={convertToProxyPath(request.attachmentPath)} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="flex items-center space-x-2 text-red-600 hover:text-red-700 dark:text-red-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                          <span>📎</span>
                                          <span className="text-sm">Lihat File PDF</span>
                                        </a>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center justify-between pt-4 border-t">
                                      <span className="text-sm text-gray-500">Status:</span>
                                      {getStatusBadge(request.status)}
                                    </div>
                                    
                                    {request.status === 'pending' && (
                                      <div className="flex space-x-2 pt-2">
                                        <Button
                                          size="sm"
                                          onClick={() => handleApprove(request.id)}
                                          disabled={updateStatusMutation.isPending}
                                          className="flex-1 bg-green-600 hover:bg-green-700"
                                        >
                                          <CheckCircle className="w-4 h-4 mr-1" />
                                          Setujui
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => handleReject(request.id)}
                                          disabled={updateStatusMutation.isPending}
                                          className="flex-1"
                                        >
                                          <XCircle className="w-4 h-4 mr-1" />
                                          Tolak
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}