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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
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
  Check,
  ChevronsUpDown,
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
import { cn } from "@/lib/utils";
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
  const [openCombobox, setOpenCombobox] = useState(false);
  const [employeeSearchValue, setEmployeeSearchValue] = useState("");
  
  // Search and filter states
  const [searchName, setSearchName] = useState("");
  const [searchNIK, setSearchNIK] = useState("");
  
  // HR PDF Upload states
  const [hrUploadingFiles, setHrUploadingFiles] = useState<{[key: string]: boolean}>({});
  const [hrUploadedFiles, setHrUploadedFiles] = useState<{[key: string]: string}>({});
  
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

  // Query for pending leave requests from monitoring
  const { data: pendingFromMonitoring = [], isLoading: loadingPendingMonitoring } = useQuery({
    queryKey: ["/api/leave/pending-from-monitoring"],
    refetchInterval: 30000,
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
    mutationFn: (data: InsertLeaveRequest) => apiRequest("/api/leave", "POST", data),
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
      apiRequest(`/api/leave/${id}`, "PUT", { status }),
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

  // Mutation for processing leave from monitoring
  const processMonitoringMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/leave/process-from-monitoring", "POST", data),
    onSuccess: (data, variables) => {
      toast({
        title: "Berhasil",
        description: variables.action === "approve" ? "Cuti berhasil disetujui" : "Cuti berhasil ditolak",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/pending-from-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
    },
    onError: (error: any) => {
      toast({
        title: "Gagal",
        description: error.message || "Gagal memproses cuti",
        variant: "destructive",
      });
    },
  });

  // Upload Roster mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: LeaveRosterData[]): Promise<{ success: number; errors: string[] }> => {
      const response = await apiRequest("/api/leave-roster/bulk-upload", "POST", { leaveData: data });
      return response;
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
      const response = await apiRequest("/api/objects/upload", "POST");
      
      const data = response;
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
          const normalizeResponse = await apiRequest("/api/objects/normalize", "POST", {
            uploadURL: uploadURL
          });
          const normalizeData = normalizeResponse;
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

  const filteredLeaveRequests = leaveRequests.filter(request => {
    // Status filter
    let statusMatch = false;
    
    if (statusFilter === "all") {
      statusMatch = true;
    } else if (statusFilter === "overdue") {
      // Filter untuk yang lewat satu hari atau lebih menunggu cuti
      const today = new Date();
      const startDate = new Date(request.startDate);
      const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      statusMatch = request.status === "pending" && daysDiff >= 1;
    } else {
      statusMatch = request.status === statusFilter;
    }
    
    // Name search (case insensitive)
    const nameMatch = searchName === "" || 
      getEmployeeName(request.employeeId).toLowerCase().includes(searchName.toLowerCase());
    
    // NIK search (case insensitive)
    const nikMatch = searchNIK === "" || 
      request.employeeId.toLowerCase().includes(searchNIK.toLowerCase());
    
    return statusMatch && nameMatch && nikMatch;
  });

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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pengajuan" className="text-xs">📝 Pengajuan</TabsTrigger>
          <TabsTrigger value="manajemen-hr" className="text-xs">🏢 Manajemen HR</TabsTrigger>
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
                  render={({ field }) => {
                    const selectedEmployee = employees.find(emp => emp.id === field.value);
                    const filteredEmployees = employees.filter((employee) =>
                      employee.name.toLowerCase().includes(employeeSearchValue.toLowerCase()) ||
                      employee.id.toLowerCase().includes(employeeSearchValue.toLowerCase())
                    );
                    
                    return (
                      <FormItem>
                        <FormLabel className="text-sm">Karyawan</FormLabel>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCombobox}
                                className={cn(
                                  "h-9 w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="leave-employee-select"
                              >
                                {selectedEmployee ? `${selectedEmployee.id} - ${selectedEmployee.name}` : "-- Pilih Karyawan --"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command>
                              <CommandInput 
                                placeholder="Cari nama atau NIK karyawan..." 
                                value={employeeSearchValue}
                                onValueChange={setEmployeeSearchValue}
                              />
                              <CommandEmpty>Tidak ada karyawan yang ditemukan.</CommandEmpty>
                              <CommandGroup className="max-h-60 overflow-auto">
                                {filteredEmployees.map((employee) => (
                                  <CommandItem
                                    key={employee.id}
                                    value={employee.id}
                                    onSelect={(currentValue) => {
                                      field.onChange(currentValue === field.value ? "" : currentValue);
                                      setOpenCombobox(false);
                                      setEmployeeSearchValue("");
                                      
                                      // Auto-fill phone number
                                      const selectedEmp = employees.find(emp => emp.id === currentValue);
                                      if (selectedEmp) {
                                        form.setValue("phoneNumber", selectedEmp.phone);
                                      }
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === employee.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{employee.name}</span>
                                      <span className="text-sm text-muted-foreground">{employee.id}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
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

        <TabsContent value="manajemen-hr" className="space-y-6">
          {/* Section Proses HR - Persetujuan Cuti dari Monitoring */}
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-xl text-orange-800 dark:text-orange-200">Proses HR - Persetujuan Cuti dari Monitoring</CardTitle>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    Karyawan dengan status "Menunggu Cuti" dari monitoring roster otomatis muncul di sini untuk diproses HR
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-4">
              {loadingPendingMonitoring ? (
                <div className="text-center py-8">
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="w-8 h-8 bg-orange-200 dark:bg-orange-800 rounded-full mb-2"></div>
                    <div className="text-orange-600 dark:text-orange-400">Loading data monitoring...</div>
                  </div>
                </div>
              ) : (!Array.isArray(pendingFromMonitoring) || pendingFromMonitoring.length === 0) ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8 text-orange-400" />
                  </div>
                  <p className="text-orange-600 dark:text-orange-400 font-medium">Tidak ada karyawan yang perlu diproses HR saat ini</p>
                  <p className="text-orange-500 dark:text-orange-500 text-sm mt-1">Semua pengajuan cuti sudah ditangani</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(pendingFromMonitoring) && pendingFromMonitoring.map((request: any) => (
                    <Card key={request.id} className="border-2 border-orange-200 dark:border-orange-700 shadow-lg hover:shadow-xl transition-shadow duration-200">
                      <CardContent className="p-5">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{request.employeeName}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">NIK: {request.employeeId}</p>
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg space-y-2">
                              <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Investor Group:</span> <span className="text-blue-600 dark:text-blue-400">{request.investorGroup}</span></p>
                              <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Monitoring:</span> <span className="font-bold text-orange-600 dark:text-orange-400">{request.monitoringDays} hari</span></p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg space-y-2">
                              <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Jenis Cuti:</span> <span className="text-green-600 dark:text-green-400 font-medium">{request.leaveType}</span></p>
                              <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Tanggal Mulai:</span> {request.startDate || 'Belum ditentukan'}</p>
                              <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Terakhir Cuti:</span> {request.lastLeaveDate || 'Belum pernah'}</p>
                              <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">WhatsApp:</span> {request.phoneNumber || 'Tidak ada'}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                              <p className="text-sm text-gray-700 dark:text-gray-300">{request.reason}</p>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            {/* PDF Upload Section */}
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">📄 Upload Form Cuti (PDF)</Label>
                              {!hrUploadedFiles[request.id] ? (
                                <ObjectUploader
                                  maxNumberOfFiles={1}
                                  maxFileSize={10485760} // 10MB
                                  onGetUploadParameters={async () => {
                                    try {
                                      const response = await apiRequest("/api/objects/upload", "POST");
                                      return {
                                        method: "PUT" as const,
                                        url: response.uploadURL
                                      };
                                    } catch (error) {
                                      console.error("Error getting upload parameters:", error);
                                      toast({
                                        title: "Error",
                                        description: "Gagal mendapatkan URL upload. Silakan coba lagi.",
                                        variant: "destructive"
                                      });
                                      throw error;
                                    }
                                  }}
                                  onComplete={(result) => {
                                    if (result.successful && result.successful.length > 0) {
                                      const uploadUrl = result.successful[0].uploadURL;
                                      setHrUploadedFiles(prev => ({
                                        ...prev,
                                        [request.id]: uploadUrl
                                      }));
                                      setHrUploadingFiles(prev => ({
                                        ...prev,
                                        [request.id]: false
                                      }));
                                      toast({
                                        title: "Upload berhasil",
                                        description: "Form PDF telah berhasil diupload"
                                      });
                                    }
                                  }}
                                  buttonClassName="w-full h-10 bg-blue-600 hover:bg-blue-700"
                                >
                                  {hrUploadingFiles[request.id] ? (
                                    <>
                                      <Upload className="w-4 h-4 mr-2 animate-spin" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 mr-2" />
                                      Upload PDF Form
                                    </>
                                  )}
                                </ObjectUploader>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20">
                                    <FileText className="w-4 h-4 mr-1" />
                                    PDF Terupload
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setHrUploadedFiles(prev => {
                                        const newFiles = { ...prev };
                                        delete newFiles[request.id];
                                        return newFiles;
                                      });
                                    }}
                                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    ❌ Hapus
                                  </Button>
                                </div>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 gap-2">
                              <Button
                                onClick={() => {
                                  // Calculate end date (assuming 7 days for now)
                                  const startDate = request.startDate || new Date().toISOString().split('T')[0];
                                  const endDate = new Date(new Date(startDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                  
                                  processMonitoringMutation.mutate({
                                    monitoringId: request.monitoringId,
                                    employeeId: request.employeeId,
                                    employeeName: request.employeeName,
                                    phoneNumber: request.phoneNumber,
                                    startDate,
                                    endDate,
                                    leaveType: request.leaveType,
                                    reason: request.reason,
                                    attachmentPath: hrUploadedFiles[request.id] || null,
                                    action: "approve"
                                  });
                                }}
                                disabled={processMonitoringMutation.isPending}
                                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white h-10 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                              >
                                ✅ Setujui Cuti
                              </Button>
                              
                              <Button
                                variant="outline"
                                onClick={() => {
                                  processMonitoringMutation.mutate({
                                    monitoringId: request.monitoringId,
                                    action: "reject"
                                  });
                                }}
                                disabled={processMonitoringMutation.isPending}
                                className="border-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 h-10 font-medium shadow-md hover:shadow-lg transition-all duration-200"
                              >
                                ❌ Tolak Cuti
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section Daftar Permohonan Cuti */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-blue-800 dark:text-blue-200">Daftar Permohonan Cuti</CardTitle>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Kelola semua pengajuan cuti karyawan dengan mudah
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Cari nama..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      className="w-40 h-10 border-2 border-blue-200 dark:border-blue-700"
                      data-testid="search-name-input"
                    />
                    <Input
                      placeholder="Cari NIK..."
                      value={searchNIK}
                      onChange={(e) => setSearchNIK(e.target.value)}
                      className="w-40 h-10 border-2 border-blue-200 dark:border-blue-700"
                      data-testid="search-nik-input"
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40 h-10 border-2 border-blue-200 dark:border-blue-700" data-testid="leave-status-filter">
                        <SelectValue placeholder="Semua Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🌐 Semua Status</SelectItem>
                        <SelectItem value="pending">⏳ Menunggu</SelectItem>
                        <SelectItem value="approved">✅ Disetujui</SelectItem>
                        <SelectItem value="rejected">❌ Ditolak</SelectItem>
                        <SelectItem value="overdue">🚨 Terlambat Cuti</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchName("");
                        setSearchNIK("");
                        setStatusFilter("all");
                      }}
                      className="h-10 border-2 border-blue-200 dark:border-blue-700"
                      data-testid="clear-filters-button"
                    >
                      🗑️ Clear
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-100 dark:bg-blue-900/30">
                      <tr>
                        <th className="text-left py-4 px-4 font-semibold text-blue-800 dark:text-blue-200 text-sm">👤 Karyawan</th>
                        <th className="text-left py-4 px-4 font-semibold text-blue-800 dark:text-blue-200 text-sm">📅 Tanggal</th>
                        <th className="text-left py-4 px-4 font-semibold text-blue-800 dark:text-blue-200 text-sm">📋 Jenis</th>
                        <th className="text-left py-4 px-4 font-semibold text-blue-800 dark:text-blue-200 text-sm">⏱️ Durasi</th>
                        <th className="text-left py-4 px-4 font-semibold text-blue-800 dark:text-blue-200 text-sm">📎 Lampiran</th>
                        <th className="text-left py-4 px-4 font-semibold text-blue-800 dark:text-blue-200 text-sm">🏷️ Status</th>
                        <th className="text-left py-4 px-4 font-semibold text-blue-800 dark:text-blue-200 text-sm">⚙️ Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100 dark:divide-blue-800">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mb-2"></div>
                              <div className="text-blue-600 dark:text-blue-400 font-medium">Loading data cuti...</div>
                            </div>
                          </td>
                        </tr>
                      ) : filteredLeaveRequests.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
                                <FileText className="w-8 h-8 text-blue-400" />
                              </div>
                              <p className="text-blue-600 dark:text-blue-400 font-medium">Tidak ada data cuti</p>
                              <p className="text-blue-500 dark:text-blue-500 text-sm mt-1">Belum ada pengajuan cuti yang masuk</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredLeaveRequests.map((request) => (
                          <tr key={request.id} data-testid={`leave-row-${request.id}`} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-white">{getEmployeeName(request.employeeId)}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{request.employeeId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{new Date(request.startDate).toLocaleDateString('id-ID')}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">s/d</div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{new Date(request.endDate).toLocaleDateString('id-ID')}</div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <Badge variant="outline" className="bg-gray-50 dark:bg-gray-800">
                                {getLeaveTypeLabel(request.leaveType)}
                              </Badge>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="bg-orange-100 dark:bg-orange-900/30 px-3 py-1 rounded-full">
                                <span className="font-bold text-orange-700 dark:text-orange-300">{calculateDays(request.startDate, request.endDate)}</span>
                                <span className="text-xs text-orange-600 dark:text-orange-400 ml-1">hari</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {request.attachmentPath ? (
                                <a 
                                  href={convertToProxyPath(request.attachmentPath)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 hover:text-red-700 dark:text-red-400 transition-colors"
                                  title="Lihat lampiran PDF"
                                >
                                  📎
                                </a>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">—</span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              {getStatusBadge(request.status)}
                            </td>
                            <td className="py-4 px-4">
                              {request.status === 'pending' ? (
                                <div className="flex flex-col space-y-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(request.id)}
                                    disabled={updateStatusMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs font-medium"
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
                                    className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 h-8 text-xs font-medium"
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
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 text-xs font-medium border-blue-300 dark:border-blue-700"
                                      data-testid={`detail-leave-${request.id}`}
                                    >
                                      <Eye className="w-3 h-3 mr-1" />
                                      Detail
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-md">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        Detail Pengajuan Cuti
                                      </DialogTitle>
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
              </div>
            </CardContent>
          </Card>
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