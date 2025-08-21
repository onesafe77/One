import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { CalendarDays, Clock, CheckCircle, XCircle, Eye, User, Phone } from "lucide-react";
import { z } from "zod";

const formSchema = insertLeaveRequestSchema.omit({ employeeName: true });

export default function Leave() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadedAttachmentPath, setUploadedAttachmentPath] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: leaveRequests = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave"],
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Find the selected employee to get their name
    const selectedEmployee = employees.find(emp => emp.id === values.employeeId);
    if (!selectedEmployee) {
      toast({
        title: "Error",
        description: "Karyawan tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    // Add attachment path and employee name
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
      console.log('Upload parameters response:', data);
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      setIsUploading(false);
      console.error('Error getting upload parameters:', error);
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
        // Send the upload URL to server to normalize and set ACL
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
          console.error("Error normalizing path:", normalizeError);
          // Fallback to direct URL if normalize fails
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
    
    // Extract the object ID from the Google Storage URL
    const url = new URL(attachmentPath);
    const pathname = url.pathname;
    
    // Find the uploads path
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

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Cuti</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Kelola permohonan cuti karyawan</p>
        </div>
      </div>

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
  );
}
