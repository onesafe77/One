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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { PDFViewer } from '@/components/PDFViewer';
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
  MessageSquare,
  Edit2,
  Trash2
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
  Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

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

// Helper functions for status styling
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'monitoring':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const getStatusText = (status: string): string => {
  switch (status) {
    case 'approved':
      return 'Disetujui';
    case 'rejected':
      return 'Ditolak';
    case 'pending':
      return 'Menunggu';
    case 'monitoring':
      return 'Monitoring';
    default:
      return status;
  }
};

export default function Leave() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadedAttachmentPath, setUploadedAttachmentPath] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [employeeSearchValue, setEmployeeSearchValue] = useState("");
  
  // Search and filter states
  const [searchName, setSearchName] = useState("");
  const [searchNIK, setSearchNIK] = useState("");
  
  // HR PDF Upload states
  const [hrUploadingFiles, setHrUploadingFiles] = useState<{[key: string]: boolean}>({});
  const [hrUploadedFiles, setHrUploadedFiles] = useState<{[key: string]: string}>({});
  
  // PDF Upload states  
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  
  // Action PDF Upload states
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string>('');
  const [actionPdfFile, setActionPdfFile] = useState<File | null>(null);
  const [actionPdfUploading, setActionPdfUploading] = useState(false);
  const [actionPdfPath, setActionPdfPath] = useState<string>('');
  
  // Upload Roster States
  const [file, setFile] = useState<File | null>(null);
  const [isUploadingRoster, setIsUploadingRoster] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Analytics States
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Edit and Delete States
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: leaveRequests = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave"],
    refetchInterval: 30000, // Refresh every 30 seconds
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

  // Fill form when editing request is selected
  useEffect(() => {
    if (editingRequest) {
      form.reset({
        employeeId: editingRequest.employeeId,
        phoneNumber: editingRequest.phoneNumber || "",
        startDate: editingRequest.startDate,
        endDate: editingRequest.endDate,
        leaveType: editingRequest.leaveType,
        reason: editingRequest.reason,
        status: editingRequest.status,
      });
      setUploadedAttachmentPath(editingRequest.attachmentPath || "");
    }
  }, [editingRequest, form]);

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
    mutationFn: ({ id, status, actionAttachment }: { id: string; status: string; actionAttachment?: string }) =>
      apiRequest(`/api/leave/${id}`, "PUT", { status, actionAttachmentPath: actionAttachment }),
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

  // Update leave request mutation
  const updateLeaveMutation = useMutation({
    mutationFn: (data: { id: string; request: Partial<InsertLeaveRequest> }) => 
      apiRequest(`/api/leave/${data.id}`, "PUT", data.request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      setEditingRequest(null);
      toast({
        title: "Berhasil",
        description: "Data cuti berhasil diperbarui",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal memperbarui data cuti",
        variant: "destructive",
      });
    },
  });

  // Delete leave request mutation
  const deleteLeaveMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/leave/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      setShowDeleteDialog(false);
      setRequestToDelete(null);
      toast({
        title: "Berhasil",
        description: "Data cuti berhasil dihapus",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal menghapus data cuti",
        variant: "destructive",
      });
    },
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

  // PDF Upload handlers
  const handlePdfFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate PDF file
      if (file.type !== 'application/pdf') {
        toast({
          title: "Error",
          description: "Hanya file PDF yang diperbolehkan",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error", 
          description: "Ukuran file maksimal 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedPdfFile(file);
    }
  };

  const handleUploadPdf = async () => {
    if (!selectedPdfFile) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('pdf', selectedPdfFile);
    
    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      setUploadedAttachmentPath(result.fileName);
      
      toast({
        title: "Upload berhasil",
        description: "PDF berhasil diupload",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal upload PDF",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Action PDF Upload handlers
  const handleActionPdfFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate PDF file
      if (file.type !== 'application/pdf') {
        toast({
          title: "Error",
          description: "Hanya file PDF yang diperbolehkan",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error", 
          description: "Ukuran file maksimal 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setActionPdfFile(file);
    }
  };

  const handleActionPdfUpload = async () => {
    if (!actionPdfFile) return;
    
    setActionPdfUploading(true);
    const formData = new FormData();
    formData.append('pdf', actionPdfFile);
    
    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      setActionPdfPath(result.fileName);
      
      toast({
        title: "Upload berhasil",
        description: "PDF berhasil diupload",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal upload PDF",
        variant: "destructive",
      });
    } finally {
      setActionPdfUploading(false);
    }
  };

  const handleActionConfirm = () => {
    if (actionType === 'approve') {
      handleApproveWithPdf(actionRequestId, actionPdfPath || undefined);
    } else if (actionType === 'reject') {
      handleRejectWithPdf(actionRequestId, actionPdfPath || undefined);
    }
  };

  const getEmployeeName = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId)?.name || 'Unknown';
  };

  const getNomorLambung = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId)?.nomorLambung || '-';
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
    if (!attachmentPath) return attachmentPath;
    
    // Handle local uploaded files (PDF from local uploads/pdf directory)
    if (attachmentPath.startsWith('/uploads/pdf/') || attachmentPath.includes('/uploads/pdf/')) {
      const filename = attachmentPath.split('/').pop();
      return `/api/files/download/${filename}`;
    }
    
    // Handle filename-only paths (from local /api/upload-pdf endpoint)
    // Check if it's just a filename (no path separators and ends with .pdf)
    if (!attachmentPath.includes('/') && attachmentPath.endsWith('.pdf')) {
      return `/api/files/download/${attachmentPath}`;
    }
    
    // Handle object storage files
    if (attachmentPath.startsWith("https://storage.googleapis.com/")) {
      const url = new URL(attachmentPath);
      const pathname = url.pathname;
      
      const uploadsIndex = pathname.indexOf("/.private/uploads/");
      if (uploadsIndex !== -1) {
        const objectId = pathname.substring(uploadsIndex + "/.private/uploads/".length);
        return `/objects/uploads/${objectId}`;
      }
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
    
    // Comprehensive search (case insensitive) - search across multiple fields
    let searchMatch = true;
    if (searchName !== "") {
      const searchTerm = searchName.toLowerCase();
      const employeeName = getEmployeeName(request.employeeId).toLowerCase();
      const employeeId = request.employeeId.toLowerCase();
      const leaveType = getLeaveTypeLabel(request.leaveType).toLowerCase();
      const reason = (request.reason || "").toLowerCase();
      const startDate = new Date(request.startDate).toLocaleDateString('id-ID');
      const endDate = new Date(request.endDate).toLocaleDateString('id-ID');
      
      searchMatch = employeeName.includes(searchTerm) ||
                   employeeId.includes(searchTerm) ||
                   leaveType.includes(searchTerm) ||
                   reason.includes(searchTerm) ||
                   startDate.includes(searchTerm) ||
                   endDate.includes(searchTerm);
    }
    
    return statusMatch && searchMatch;
  });

  const handleApprove = (id: string) => {
    // Open action dialog for PDF upload
    setActionType('approve');
    setActionRequestId(id);
    setActionPdfFile(null);
    setActionPdfPath('');
    setShowActionDialog(true);
  };

  const handleApproveWithPdf = (id: string, pdfPath?: string) => {
    // Check if this is a monitoring request (starts with "monitoring-")
    if (id.startsWith("monitoring-")) {
      // Extract the actual monitoring ID 
      const monitoringId = id.replace("monitoring-", "");
      
      // Find the monitoring request data
      const monitoringRequest = Array.isArray(pendingFromMonitoring) ? pendingFromMonitoring.find((req: any) => req.id === id) : undefined;
      if (monitoringRequest) {
        processMonitoringMutation.mutate({
          monitoringId: monitoringId,
          employeeId: monitoringRequest.employeeId,
          employeeName: monitoringRequest.employeeName,
          phoneNumber: monitoringRequest.phoneNumber || "",
          startDate: monitoringRequest.startDate || new Date().toISOString().split('T')[0],
          endDate: monitoringRequest.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 7 days
          leaveType: monitoringRequest.leaveType,
          reason: monitoringRequest.reason,
          attachmentPath: pdfPath || monitoringRequest.attachmentPath,
          action: "approve"
        });
      }
    } else {
      // Regular leave request
      updateStatusMutation.mutate({ 
        id, 
        status: 'approved',
        actionAttachment: pdfPath 
      });
    }
    setShowActionDialog(false);
  };

  const handleReject = (id: string) => {
    // Open action dialog for PDF upload
    setActionType('reject');
    setActionRequestId(id);
    setActionPdfFile(null);
    setActionPdfPath('');
    setShowActionDialog(true);
  };

  const handleRejectWithPdf = (id: string, pdfPath?: string) => {
    // Check if this is a monitoring request (starts with "monitoring-")
    if (id.startsWith("monitoring-")) {
      // Extract the actual monitoring ID 
      const monitoringId = id.replace("monitoring-", "");
      
      processMonitoringMutation.mutate({
        monitoringId: monitoringId,
        action: "reject",
        actionAttachment: pdfPath
      });
    } else {
      // Regular leave request
      updateStatusMutation.mutate({ 
        id, 
        status: 'rejected',
        actionAttachment: pdfPath 
      });
    }
    setShowActionDialog(false);
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
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Cuti</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Sistem manajemen cuti terpadu dengan analitik dan monitoring</p>
        </div>
      </div>

      {/* Form Pengajuan Cuti */}
      <div className="space-y-4">
        <Card>
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

                {/* PDF File Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Lampiran PDF (Opsional)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handlePdfFileSelect}
                      className="hidden"
                      id="pdf-upload"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="pdf-upload"
                      className={`flex-1 h-8 px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded cursor-pointer flex items-center justify-center gap-2 
                        ${isUploading ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'}
                        text-gray-700 dark:text-gray-300`}
                    >
                      <FileText className="w-3 h-3" />
                      {selectedPdfFile ? selectedPdfFile.name : 'Pilih file PDF'}
                    </label>
                    {selectedPdfFile && !isUploading && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleUploadPdf}
                        className="h-8 px-3 text-xs"
                        disabled={isUploading}
                      >
                        Upload
                      </Button>
                    )}
                  </div>
                  {uploadedAttachmentPath && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-green-600 dark:text-green-400">✓ PDF uploaded successfully</p>
                      <a 
                        href={`/api/files/download/${uploadedAttachmentPath.split('/').pop()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Lihat PDF
                      </a>
                    </div>
                  )}
                  {isUploading && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">Uploading PDF...</p>
                  )}
                  {selectedPdfFile && !uploadedAttachmentPath && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      File size: {(selectedPdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Daftar Cuti</CardTitle>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Cari nama karyawan atau NIK..."
                  value={searchName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchName(value);
                    setSearchNIK(value); // Use same search for both name and NIK
                  }}
                  className="w-64 h-9"
                  data-testid="leave-search-input"
                />
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
                            <div className="flex flex-col space-y-1">
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
                                      <div className="flex gap-2">
                                        <PDFViewer 
                                          pdfPath={convertToProxyPath(request.attachmentPath)}
                                          title="Lampiran Permohonan Cuti"
                                          trigger={
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="flex items-center space-x-2 text-red-600 hover:text-red-700 dark:text-red-400"
                                              data-testid={`preview-pdf-${request.id}`}
                                            >
                                              <FileText className="w-4 h-4" />
                                              <span className="text-sm">Preview PDF</span>
                                            </Button>
                                          }
                                        />
                                        <a 
                                          href={convertToProxyPath(request.attachmentPath)} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center space-x-1 text-red-600 hover:text-red-700 dark:text-red-400 text-sm underline"
                                          data-testid={`download-pdf-${request.id}`}
                                        >
                                          <span>📎</span>
                                          <span>Download</span>
                                        </a>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* HR Action Attachment */}
                                  {(request as any).actionAttachmentPath && (
                                    <div>
                                      <p className="font-medium text-sm mb-2">Dokumen HR:</p>
                                      <div className="flex gap-2">
                                        <PDFViewer 
                                          pdfPath={convertToProxyPath((request as any).actionAttachmentPath)}
                                          title="Dokumen Keputusan HR"
                                          trigger={
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                              data-testid={`preview-hr-pdf-${request.id}`}
                                            >
                                              <FileText className="w-4 h-4" />
                                              <span className="text-sm">Preview Keputusan HR</span>
                                            </Button>
                                          }
                                        />
                                        <a 
                                          href={convertToProxyPath((request as any).actionAttachmentPath)} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm underline"
                                          data-testid={`download-hr-pdf-${request.id}`}
                                        >
                                          <span>📎</span>
                                          <span>Download</span>
                                        </a>
                                      </div>
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
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingRequest(request)}
                                className="text-orange-600 hover:text-orange-700 h-7 text-xs"
                                data-testid={`edit-leave-${request.id}`}
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRequestToDelete(request.id);
                                  setShowDeleteDialog(true);
                                }}
                                className="text-red-600 hover:text-red-700 h-7 text-xs"
                                data-testid={`delete-leave-${request.id}`}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Hapus
                              </Button>
                            </div>
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

        {/* Daftar Permohonan Cuti Terpadu */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Semua Permohonan Cuti</CardTitle>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Cari nama karyawan atau NIK..."
                  value={searchName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchName(value);
                    setSearchNIK(value); // Use same search for both name and NIK
                  }}
                  className="w-64 h-9"
                  data-testid="leave-search-input-all"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-9" data-testid="leave-status-filter">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📋 Semua Status</SelectItem>
                    <SelectItem value="pending">⏳ Menunggu</SelectItem>
                    <SelectItem value="approved">✅ Disetujui</SelectItem>
                    <SelectItem value="rejected">❌ Ditolak</SelectItem>
                    <SelectItem value="monitoring">🔍 Monitoring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
            
          <CardContent className="space-y-3">
            {loadingPendingMonitoring ? (
                <div className="text-center py-8">
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full mb-2"></div>
                    <div className="text-gray-600 dark:text-gray-400">Loading permohonan cuti...</div>
                  </div>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Karyawan</th>
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Tanggal</th>
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Jenis</th>
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Status</th>
                      <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Data dari Monitoring */}
                    {Array.isArray(pendingFromMonitoring) && pendingFromMonitoring
                      .filter((request: any) => {
                        // Status filter for monitoring
                        const statusMatch = statusFilter === "all" || statusFilter === "monitoring";
                        
                        // Search filter for monitoring
                        let searchMatch = true;
                        if (searchName !== "") {
                          const searchTerm = searchName.toLowerCase();
                          const employeeName = (request.employeeName || "").toLowerCase();
                          const employeeId = (request.employeeId || "").toLowerCase();
                          const leaveType = (request.leaveType || "").toLowerCase();
                          const startDate = (request.startDate || "").toLowerCase();
                          
                          searchMatch = employeeName.includes(searchTerm) ||
                                       employeeId.includes(searchTerm) ||
                                       leaveType.includes(searchTerm) ||
                                       startDate.includes(searchTerm);
                        }
                        
                        return statusMatch && searchMatch;
                      })
                      .map((request: any) => (
                      <tr key={`monitoring-${request.id}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{request.employeeName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">NIK: {request.employeeId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <div>{request.startDate || 'Belum ditentukan'}</div>
                            <div className="text-xs text-gray-500">{request.monitoringDays} hari lagi</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-green-600 dark:text-green-400 font-medium">{request.leaveType}</span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                            🔍 Monitoring
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={updateStatusMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(request.id)}
                              disabled={updateStatusMutation.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Tolak
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Data dari Manual Request */}
                    {filteredLeaveRequests.map((request: any) => (
                      <tr key={`manual-${request.id}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{request.employeeName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">NIK: {request.employeeId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <div>{request.startDate}</div>
                            <div className="text-xs text-gray-500">{request.duration} hari</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{request.leaveType}</span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            {getStatusText(request.status)}
                          </span>
                        </td>
                        <td className="p-3">
                          {request.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(request.id)}
                                disabled={updateStatusMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Setujui
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(request.id)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Tolak
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Empty State */}
                    {(!Array.isArray(pendingFromMonitoring) || pendingFromMonitoring.length === 0) && 
                     filteredLeaveRequests.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <FileText className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">Tidak ada permohonan cuti</p>
                          <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Gunakan form di atas untuk mengajukan cuti baru</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* End of unified leave requests */}
      </div>

      {/* Action Dialog with PDF Upload */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Setujui Permohonan Cuti' : 'Tolak Permohonan Cuti'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Anda akan {actionType === 'approve' ? 'menyetujui' : 'menolak'} permohonan cuti ini.
              Anda dapat melampirkan dokumen pendukung (opsional).
            </p>
            
            {/* PDF Upload Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Lampiran Dokumen Aksi (Opsional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleActionPdfFileSelect}
                  className="hidden"
                  id="action-pdf-upload"
                  disabled={actionPdfUploading}
                />
                <label
                  htmlFor="action-pdf-upload"
                  className={`flex-1 h-10 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded cursor-pointer flex items-center justify-center gap-2 
                    ${actionPdfUploading ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'}
                    text-gray-700 dark:text-gray-300`}
                >
                  <FileText className="w-4 h-4" />
                  {actionPdfFile ? actionPdfFile.name : 'Pilih file PDF'}
                </label>
                {actionPdfFile && !actionPdfUploading && !actionPdfPath && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleActionPdfUpload}
                    className="h-10"
                    disabled={actionPdfUploading}
                  >
                    Upload
                  </Button>
                )}
              </div>
              
              {actionPdfPath && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-green-600 dark:text-green-400">✓ PDF uploaded successfully</p>
                  <a 
                    href={`/api/files/download/${actionPdfPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Lihat PDF
                  </a>
                </div>
              )}
              
              {actionPdfUploading && (
                <p className="text-sm text-blue-600 dark:text-blue-400">Uploading PDF...</p>
              )}
              
              {actionPdfFile && !actionPdfPath && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  File size: {(actionPdfFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowActionDialog(false)}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                onClick={handleActionConfirm}
                disabled={updateStatusMutation.isPending || processMonitoringMutation.isPending}
                className={`flex-1 ${
                  actionType === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionType === 'approve' ? 'Setujui' : 'Tolak'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Leave Request Dialog */}
      {editingRequest && (
        <Dialog open={!!editingRequest} onOpenChange={() => setEditingRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Pengajuan Cuti</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => {
                const submitData = {
                  ...values,
                  employeeName: employees.find(emp => emp.id === values.employeeId)?.name || "",
                  attachmentPath: uploadedAttachmentPath || editingRequest.attachmentPath,
                };
                updateLeaveMutation.mutate({ id: editingRequest.id, request: submitData });
              })} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Karyawan</FormLabel>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCombobox}
                                className="justify-between"
                              >
                                {field.value
                                  ? employees.find((emp) => emp.id === field.value)?.name
                                  : "Pilih karyawan..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="p-0">
                            <Command>
                              <CommandInput 
                                placeholder="Cari karyawan..." 
                                value={employeeSearchValue}
                                onValueChange={setEmployeeSearchValue}
                              />
                              <CommandEmpty>Karyawan tidak ditemukan.</CommandEmpty>
                              <CommandGroup>
                                {employees
                                  .filter(emp => 
                                    employeeSearchValue === "" || 
                                    emp.name.toLowerCase().includes(employeeSearchValue.toLowerCase()) ||
                                    emp.id.toLowerCase().includes(employeeSearchValue.toLowerCase())
                                  )
                                  .slice(0, 10)
                                  .map((emp) => (
                                  <CommandItem
                                    key={emp.id}
                                    value={emp.id}
                                    onSelect={() => {
                                      field.onChange(emp.id);
                                      setOpenCombobox(false);
                                      setEmployeeSearchValue("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === emp.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div>
                                      <div className="font-medium">{emp.name}</div>
                                      <div className="text-sm text-gray-500">{emp.id}</div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor WhatsApp</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="628xxxxxxxxxx" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal Mulai</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                        <FormLabel>Tanggal Selesai</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jenis Cuti</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih jenis cuti" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Cuti Tahunan">Cuti Tahunan</SelectItem>
                          <SelectItem value="Cuti Sakit">Cuti Sakit</SelectItem>
                          <SelectItem value="Cuti Khusus">Cuti Khusus</SelectItem>
                          <SelectItem value="Cuti Melahirkan">Cuti Melahirkan</SelectItem>
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
                      <FormLabel>Alasan Cuti</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} placeholder="Jelaskan alasan pengajuan cuti..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setEditingRequest(null)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={updateLeaveMutation.isPending}>
                    {updateLeaveMutation.isPending ? "Memperbarui..." : "Perbarui"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Apakah Anda yakin ingin menghapus data cuti ini? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => requestToDelete && deleteLeaveMutation.mutate(requestToDelete)}
              disabled={deleteLeaveMutation.isPending}
            >
              {deleteLeaveMutation.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
