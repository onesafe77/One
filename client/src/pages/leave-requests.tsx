import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaveRequestSchema } from "@shared/schema";
import type { Employee, InsertLeaveRequest } from "@shared/schema";

interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
  status: string;
}
import { Plus, Calendar, CheckCircle, XCircle, Clock, AlertCircle, Users, TrendingUp, FileCheck, Zap } from "lucide-react";
import { z } from "zod";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = insertLeaveRequestSchema;

export default function LeaveRequests() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: leaveRequests = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      startDate: "",
      endDate: "",
      leaveType: "",
      reason: "",
      status: "pending",
    },
  });

  // Auto save hook for leave request form
  const { saveStatus, clearDraft, hasDraft } = useAutoSave({
    key: 'leave_request_new',
    form,
    exclude: [], // Save all fields for leave request
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertLeaveRequest) => apiRequest("/api/leave-requests", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      setIsDialogOpen(false);
      form.reset();
      clearDraft(); // Clear auto saved draft after successful save
      toast({
        title: "Berhasil",
        description: "Permohonan cuti berhasil diajukan",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal mengajukan permohonan cuti",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/leave-requests/${id}`, "PUT", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      toast({
        title: "Berhasil",
        description: "Status permohonan cuti berhasil diperbarui",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal memperbarui status permohonan cuti",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate(values);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Disetujui</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" />Ditolak</Badge>;
      default:
        return <Badge className="bg-yellow-500 text-white"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
    }
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : employeeId;
  };

  // Calculate leave analytics
  const totalRequests = leaveRequests.length;
  const pendingRequests = leaveRequests.filter(req => req.status === 'pending').length;
  const approvedRequests = leaveRequests.filter(req => req.status === 'approved').length;
  const rejectedRequests = leaveRequests.filter(req => req.status === 'rejected').length;
  const approvalRate = totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/10 opacity-30"></div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-6 lg:space-y-0">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">
                    Leave Management
                  </h1>
                  <p className="text-lg text-white/90 font-medium">
                    Kelola permohonan cuti karyawan dengan mudah dan efisien
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Clock className="w-4 h-4" />
                  <span>Real-time Updates</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>{approvalRate}% Approval Rate</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Users className="w-4 h-4" />
                  <span>{totalRequests} Total Requests</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <XCircle className="w-4 h-4" />
                  <span>{rejectedRequests} Rejected</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-200" />
                  <span>Auto-save enabled</span>
                </div>
                <p className="text-xs text-green-200 mt-1">Forms protected</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Requests Card */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:shadow-lg transition-all duration-200">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <Zap className="w-5 h-5 text-blue-500 opacity-60" />
            </div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total Requests</p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1" data-testid="stats-total-requests">{totalRequests}</p>
          </div>
        </div>

        {/* Pending Requests Card */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:shadow-lg transition-all duration-200">
          <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <AlertCircle className="w-5 h-5 text-yellow-500 opacity-60" />
            </div>
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Pending</p>
            <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100 mt-1" data-testid="stats-pending-requests">{pendingRequests}</p>
          </div>
        </div>

        {/* Approved Requests Card */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:shadow-lg transition-all duration-200">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500 opacity-60" />
            </div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Approved</p>
            <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1" data-testid="stats-approved-requests">{approvedRequests}</p>
          </div>
        </div>

        {/* Approval Rate Card */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:shadow-lg transition-all duration-200">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <Users className="w-5 h-5 text-purple-500 opacity-60" />
            </div>
            <p className="text-sm font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Approval Rate</p>
            <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1" data-testid="stats-approval-rate">{approvalRate}%</p>
          </div>
        </div>
      </div>

      {/* Enhanced Leave Requests Management */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Leave Requests Management</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Kelola dan proses permohonan cuti karyawan</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-leave-request-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajukan Cuti
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Ajukan Permohonan Cuti</span>
                  <AutoSaveIndicator status={saveStatus} />
                </DialogTitle>
              </DialogHeader>
              
              {hasDraft() && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Draft tersimpan otomatis akan dipulihkan. Data yang belum disimpan akan tetap aman.
                  </AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Karyawan</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="leave-employee-select">
                              <SelectValue placeholder="Pilih karyawan" />
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
                    name="leaveType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jenis Cuti</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="leave-type-select">
                              <SelectValue placeholder="Pilih jenis cuti" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="annual">Cuti Tahunan</SelectItem>
                            <SelectItem value="sick">Cuti Sakit</SelectItem>
                            <SelectItem value="emergency">Cuti Darurat</SelectItem>
                            <SelectItem value="maternity">Cuti Melahirkan</SelectItem>
                            <SelectItem value="paternity">Cuti Ayah</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal Mulai</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
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
                        <FormLabel>Tanggal Selesai</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            data-testid="leave-end-date-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alasan</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Jelaskan alasan pengajuan cuti..." 
                            {...field} 
                            value={field.value || ""}
                            data-testid="leave-reason-textarea"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="cancel-leave-request-button">
                      Batal
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="submit-leave-request-button">
                      {createMutation.isPending ? "Menyimpan..." : "Ajukan Cuti"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </div>
        <div className="p-6">
          {/* Enhanced Leave Requests Table */}
          <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-600">
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Karyawan</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Jenis Cuti</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Tanggal</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Alasan</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Status</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-600 bg-white dark:bg-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : leaveRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada permohonan cuti
                  </td>
                </tr>
              ) : (
                leaveRequests.map((request) => (
                  <tr key={request.id} data-testid={`leave-request-row-${request.id}`}>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {getEmployeeName(request.employeeId)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {request.leaveType}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {request.startDate} - {request.endDate}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                      {request.reason}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="py-3 px-4">
                      {request.status === 'pending' && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: request.id, status: 'approved' })}
                            className="bg-green-500 hover:bg-green-600 text-white"
                            data-testid={`approve-leave-${request.id}`}
                          >
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: request.id, status: 'rejected' })}
                            className="border-red-500 text-red-500 hover:bg-red-50"
                            data-testid={`reject-leave-${request.id}`}
                          >
                            Tolak
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
        </div>
      </div>
    </div>
  );
}