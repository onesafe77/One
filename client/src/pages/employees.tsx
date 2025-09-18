import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema } from "@shared/schema";
import type { Employee, InsertEmployee } from "@shared/schema";
import { Plus, Search, Edit, Trash2, Upload, AlertCircle, Download, Eye, QrCode, Users, CheckCircle, Clock, User, FileText, Building2, TrendingUp, BarChart3, Shield, Zap, Target } from "lucide-react";
import { z } from "zod";
import * as XLSX from "xlsx";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import QRCode from "qrcode";

const formSchema = insertEmployeeSchema.extend({
  id: z.string().optional(), // NIK akan digenerate otomatis
  position: z.string().optional(),
  department: z.string().optional(),
  investorGroup: z.string().optional(),
});

// Component untuk menampilkan QR Code di kolom
function QRCodeDisplay({ qrData, employeeName }: { qrData: string; employeeName: string }) {
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const generateQRImage = async () => {
    try {
      const url = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrImageUrl(url);
      return url;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  };

  const downloadQRCode = async () => {
    const url = qrImageUrl || await generateQRImage();
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_${employeeName.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const viewQRCode = async () => {
    if (!qrImageUrl) {
      await generateQRImage();
    }
    setIsViewDialogOpen(true);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={viewQRCode}
        className="h-8 w-8 p-0"
        data-testid={`view-qr-${employeeName}`}
      >
        <Eye className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={downloadQRCode}
        className="h-8 w-8 p-0"
        data-testid={`download-qr-${employeeName}`}
      >
        <Download className="w-4 h-4" />
      </Button>
      
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code - {employeeName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {qrImageUrl && (
              <img 
                src={qrImageUrl} 
                alt={`QR Code for ${employeeName}`}
                className="w-64 h-64 border rounded-lg"
              />
            )}
            <div className="flex gap-2">
              <Button onClick={downloadQRCode} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download QR Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Employees() {
  const [searchTerm, setSearchTerm] = useState("");
  const [nikFilter, setNikFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  // Dashboard filters
  const [dashboardDepartmentFilter, setDashboardDepartmentFilter] = useState("all");
  const [dashboardPositionFilter, setDashboardPositionFilter] = useState("all");
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: "", // NIK akan digenerate otomatis di server
      name: "",
      position: "",
      department: "",
      investorGroup: "",
      phone: "",
      status: "active",
    },
  });

  // Auto save hook
  const { saveStatus, clearDraft, hasDraft } = useAutoSave({
    key: editingEmployee ? `employee_edit_${editingEmployee.id}` : 'employee_new',
    form,
    exclude: ['id'], // Don't auto save ID field
  });

  const createMutation = useMutation<Employee, Error, InsertEmployee>({
    mutationFn: (data: InsertEmployee) => apiRequest("/api/employees", "POST", data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDialogOpen(false);
      setEditingEmployee(null);
      form.reset();
      clearDraft(); // Clear auto saved draft after successful save
      toast({
        title: "Berhasil",
        description: `Karyawan ${result.name} (${result.id}) berhasil ditambahkan`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Gagal menambahkan karyawan",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation<Employee, Error, { id: string; data: Partial<InsertEmployee> }>({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertEmployee> }) =>
      apiRequest(`/api/employees/${id}`, "PUT", data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDialogOpen(false);
      setEditingEmployee(null);
      form.reset();
      clearDraft(); // Clear auto saved draft after successful save
      toast({
        title: "Berhasil",
        description: `Data karyawan ${result.name} (${result.id}) berhasil diperbarui`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui data karyawan",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => apiRequest(`/api/employees/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Berhasil",
        description: "Karyawan berhasil dihapus",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus karyawan",
        variant: "destructive",
      });
    },
  });

  const deleteAllMutation = useMutation<void, Error>({
    mutationFn: () => apiRequest("/api/employees", "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Berhasil",
        description: "Semua data karyawan berhasil dihapus",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus semua data karyawan",
        variant: "destructive",
      });
    },
  });

  // Dashboard statistics
  const dashboardStats = useMemo(() => {
    const filteredData = employees.filter((employee) => {
      const matchesDepartment = dashboardDepartmentFilter === "" || dashboardDepartmentFilter === "all" || employee.department === dashboardDepartmentFilter;
      const matchesPosition = dashboardPositionFilter === "" || dashboardPositionFilter === "all" || employee.position === dashboardPositionFilter;
      const matchesStatus = dashboardStatusFilter === "" || dashboardStatusFilter === "all" || employee.status === dashboardStatusFilter;
      return matchesDepartment && matchesPosition && matchesStatus;
    });

    const totalEmployees = filteredData.length;
    const activeEmployees = filteredData.filter(emp => emp.status === 'active').length;
    const inactiveEmployees = filteredData.filter(emp => emp.status === 'inactive').length;
    
    // Position statistics
    const positionCounts = filteredData.reduce((acc, employee) => {
      const position = employee.position || 'Unknown';
      acc[position] = (acc[position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Department statistics
    const departmentCounts = filteredData.reduce((acc, employee) => {
      const department = employee.department || 'Unknown';
      acc[department] = (acc[department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Investor Group statistics
    const investorGroupCounts = filteredData.reduce((acc, employee) => {
      const group = employee.investorGroup || 'Unknown';
      acc[group] = (acc[group] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const uniquePositions = Object.keys(positionCounts).length;
    const uniqueDepartments = Object.keys(departmentCounts).length;
    
    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      uniquePositions,
      uniqueDepartments,
      positionCounts,
      departmentCounts,
      investorGroupCounts,
    };
  }, [employees, dashboardDepartmentFilter, dashboardPositionFilter, dashboardStatusFilter]);
  
  // Get unique values for filters
  const uniquePositionsForFilter = useMemo(() => {
    const positions = Array.from(new Set(employees.map(emp => emp.position).filter((pos): pos is string => Boolean(pos))));
    return positions.sort();
  }, [employees]);
  
  const uniqueDepartmentsForFilter = useMemo(() => {
    const departments = Array.from(new Set(employees.map(emp => emp.department).filter((dept): dept is string => Boolean(dept))));
    return departments.sort();
  }, [employees]);

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (employee.position?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                         (employee.department?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    
    const matchesNik = nikFilter === "" || employee.id.toLowerCase().includes(nikFilter.toLowerCase());
    
    return matchesSearch && matchesNik;
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: values });
    } else {
      // NIK akan digenerate di server, jadi kita kirim tanpa id
      const { id, ...employeeData } = values;
      createMutation.mutate(employeeData as InsertEmployee);
    }
  };

  const handleDeleteAll = () => {
    setIsDeleteAllDialogOpen(true);
  };

  const confirmDeleteAll = () => {
    deleteAllMutation.mutate();
    setIsDeleteAllDialogOpen(false);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    form.reset({
      id: employee.id,
      name: employee.name,
      position: employee.position || "",
      department: employee.department || "",
      investorGroup: employee.investorGroup || "",
      phone: employee.phone,
      status: employee.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus karyawan ini?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleNewEmployee = () => {
    setEditingEmployee(null);
    form.reset({
      id: "",
      name: "",
      position: "",
      department: "",
      investorGroup: "",
      phone: "",
      status: "active",
    });
    setIsDialogOpen(true);
  };

  const uploadExcelMutation = useMutation<void, Error, InsertEmployee[]>({
    mutationFn: (employeeData: InsertEmployee[]) => 
      apiRequest("/api/employees/bulk", "POST", { employees: employeeData }).then(() => {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsUploadDialogOpen(false);
      toast({
        title: "Berhasil",
        description: "Data karyawan berhasil diupload",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Gagal mengupload data karyawan",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Skip header row
        const rows = jsonData.slice(1) as any[][];
        const employeeData: InsertEmployee[] = rows
          .filter(row => row.length >= 6 && row[0] && row[1]) // Check required fields
          .map(row => ({
            id: row[0]?.toString() || "",
            name: row[1]?.toString() || "",
            position: row[2]?.toString() || "",
            department: row[3]?.toString() || "",
            investorGroup: row[4]?.toString() || "",
            phone: row[5]?.toString() || "",
            status: "active",
          }));

        if (employeeData.length === 0) {
          toast({
            title: "Error",
            description: "File Excel tidak memiliki data yang valid",
            variant: "destructive",
          });
          return;
        }

        uploadExcelMutation.mutate(employeeData);
      } catch (error) {
        toast({
          title: "Error",
          description: "Gagal membaca file Excel",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const templateData = [
      ["NIK", "Nama", "Posisi", "Departemen", "Investor Group", "No. WhatsApp"],
      ["C-00001", "John Doe", "Manager", "IT", "Group A", "+628123456789"],
      ["C-00002", "Jane Smith", "Staff", "HR", "Group B", "+628123456790"],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Karyawan");
    XLSX.writeFile(workbook, "Template_Karyawan.xlsx");
  };

  // Dashboard functions
  const handlePositionClick = (position: string) => {
    setSearchTerm(position);
    setActiveTab("list");
  };
  
  const handleDepartmentClick = (department: string) => {
    setSearchTerm(department);
    setActiveTab("list");
  };
  
  const clearDashboardFilters = () => {
    setDashboardDepartmentFilter("all");
    setDashboardPositionFilter("all");
    setDashboardStatusFilter("all");
  };

  return (
    <div className="space-y-8">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 text-white p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/10 opacity-30"></div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-6 lg:space-y-0">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight">
                    Manajemen Karyawan
                  </h1>
                  <p className="text-xl text-blue-100 mt-2">
                    Kelola data karyawan dan QR code dengan mudah
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Users className="w-4 h-4" />
                  <span>Total: {employees.length} Karyawan</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Aktif: {employees.filter(emp => emp.status === 'active').length}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Clock className="w-4 h-4" />
                  <span>Tidak Aktif: {employees.filter(emp => emp.status === 'inactive').length}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={async () => {
                  try {
                    const response = await apiRequest("/api/qr/update-all", "POST", {});
                    toast({
                      title: "QR Code Update",
                      description: response.message || "Semua QR Code berhasil diupdate ke format URL",
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Gagal mengupdate QR Code",
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                size="sm"
                data-testid="update-qr-button"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Update QR URL
              </Button>
              <Button 
                onClick={handleDeleteAll}
                size="sm"
                data-testid="delete-all-button"
                disabled={employees.length === 0}
                className="bg-red-500/20 border-red-300/30 text-red-100 hover:bg-red-500/30 backdrop-blur-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Hapus Semua
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleNewEmployee} 
                    data-testid="add-employee-button"
                    className="bg-white text-blue-600 hover:bg-gray-100 shadow-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Karyawan
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{editingEmployee ? "Edit Karyawan" : "Tambah Karyawan"}</span>
                  <AutoSaveIndicator status={saveStatus} />
                </DialogTitle>
              </DialogHeader>
              
              {!editingEmployee && hasDraft() && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Draft tersimpan otomatis akan dipulihkan. Data yang belum disimpan akan tetap aman.
                  </AlertDescription>
                </Alert>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {editingEmployee && (
                    <FormField
                      control={form.control}
                      name="id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NIK</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="C-00001" 
                              {...field} 
                              disabled={true}
                              data-testid="employee-id-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Lengkap</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Nama karyawan" 
                            {...field} 
                            data-testid="employee-name-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posisi</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Manager, Staff, dll" 
                            {...field} 
                            data-testid="employee-position-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departemen</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="HR, IT, Finance, dll" 
                            {...field} 
                            data-testid="employee-department-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="investorGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Investor Group</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Group A, Group B, dll" 
                            {...field} 
                            data-testid="employee-investor-group-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. WhatsApp</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+628123456789" 
                            {...field} 
                            data-testid="employee-phone-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="employee-status-select">
                              <SelectValue placeholder="Pilih status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="inactive">Tidak Aktif</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setEditingEmployee(null);
                        form.reset();
                      }}
                      className="flex-1"
                      data-testid="cancel-employee-button"
                    >
                      Batal
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="submit-employee-button"
                    >
                      {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : (editingEmployee ? "Update" : "Simpan")}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Tab Container */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/10 border-b border-gray-100 dark:border-gray-700 p-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/50 dark:bg-gray-700/50 rounded-2xl p-1 backdrop-blur-sm">
              <TabsTrigger 
                value="dashboard" 
                data-testid="dashboard-tab" 
                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all duration-200"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="list" 
                data-testid="list-tab" 
                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all duration-200"
              >
                <Users className="w-4 h-4 mr-2" />
                List
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="dashboard" className="space-y-8 p-6">
            {/* Enhanced Dashboard Filters */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filter & Analytics</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Analisis data karyawan berdasarkan kategori</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={dashboardDepartmentFilter} onValueChange={setDashboardDepartmentFilter}>
                  <SelectTrigger data-testid="dashboard-department-filter" className="bg-white/50 border-blue-200 dark:border-blue-700">
                    <SelectValue placeholder="Semua Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Department</SelectItem>
                    {uniqueDepartmentsForFilter.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={dashboardPositionFilter} onValueChange={setDashboardPositionFilter}>
                  <SelectTrigger data-testid="dashboard-position-filter" className="bg-white/50 border-blue-200 dark:border-blue-700">
                    <SelectValue placeholder="Semua Posisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Posisi</SelectItem>
                    {uniquePositionsForFilter.map(pos => (
                      <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={dashboardStatusFilter} onValueChange={setDashboardStatusFilter}>
                  <SelectTrigger data-testid="dashboard-status-filter" className="bg-white/50 border-blue-200 dark:border-blue-700">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Tidak Aktif</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button 
                  variant="outline" 
                  onClick={clearDashboardFilters}
                  data-testid="clear-dashboard-filters"
                  className="bg-white/50 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Reset Filter
                </Button>
              </div>
            </div>
            
            {/* Premium Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-blue-500 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total Karyawan</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1" data-testid="card-total-employees">
                    {dashboardStats.totalEmployees}
                  </p>
                </div>
              </div>
              
              <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-900/20 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800 hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <Zap className="w-5 h-5 text-emerald-500 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Karyawan Aktif</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mt-1" data-testid="card-active">
                    {dashboardStats.activeEmployees}
                  </p>
                </div>
              </div>
              
              <div className="group relative overflow-hidden bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20 rounded-2xl p-6 border border-red-200 dark:border-red-800 hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <AlertCircle className="w-5 h-5 text-red-500 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Tidak Aktif</p>
                  <p className="text-3xl font-bold text-red-900 dark:text-red-100 mt-1" data-testid="card-inactive">
                    {dashboardStats.inactiveEmployees}
                  </p>
                </div>
              </div>
              
              <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800 hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <Shield className="w-5 h-5 text-purple-500 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Total Posisi</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1" data-testid="card-unique-positions">
                    {dashboardStats.uniquePositions}
                  </p>
                </div>
              </div>
              
              <div className="group relative overflow-hidden bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-800 hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <BarChart3 className="w-5 h-5 text-orange-500 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">Total Dept</p>
                  <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1" data-testid="card-unique-departments">
                    {dashboardStats.uniqueDepartments}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Enhanced Analytics Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Position Analytics */}
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Analisis Posisi</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Distribusi karyawan berdasarkan jabatan</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center">
                      <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {Object.entries(dashboardStats.positionCounts)
                      .sort(([,a], [,b]) => b - a)
                      .map(([position, count]) => (
                      <div 
                        key={position}
                        className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-purple-50 dark:from-gray-700/30 dark:to-purple-900/10 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-md transition-all duration-200"
                        onClick={() => handlePositionClick(position)}
                        data-testid={`position-row-${position}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">{position}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{count}</span>
                          <TrendingUp className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Department Analytics */}
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Analisis Departemen</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Distribusi karyawan berdasarkan divisi</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {Object.entries(dashboardStats.departmentCounts)
                      .sort(([,a], [,b]) => b - a)
                      .map(([department, count]) => (
                      <div 
                        key={department}
                        className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-orange-50 dark:from-gray-700/30 dark:to-orange-900/10 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-md transition-all duration-200"
                        onClick={() => handleDepartmentClick(department)}
                        data-testid={`department-row-${department}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span className="font-medium text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">{department}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{count}</span>
                          <BarChart3 className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Premium Investor Group Analytics */}
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/10 dark:to-cyan-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Investor Group Analytics</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Distribusi karyawan berdasarkan grup investor</p>
                  </div>
                  <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/20 rounded-2xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(dashboardStats.investorGroupCounts)
                    .sort(([,a], [,b]) => b - a)
                    .map(([group, count]) => (
                    <div 
                      key={group}
                      data-testid={`investor-group-row-${group}`}
                      className="bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-teal-200 dark:border-teal-800 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide">{group}</p>
                          <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">{count}</p>
                        </div>
                        <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="list" className="space-y-8 p-6">
        {/* Enhanced Search and Filter */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pencarian Karyawan</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cari berdasarkan nama, NIK, posisi, atau departemen</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center">
              <Search className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Cari nama, posisi, atau departemen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-white/50 border-indigo-200 dark:border-indigo-700 rounded-xl"
                data-testid="search-employees-input"
              />
            </div>
            <div className="w-full sm:w-[200px] relative">
              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Filter NIK..."
                value={nikFilter}
                onChange={(e) => setNikFilter(e.target.value)}
                className="pl-12 h-12 bg-white/50 border-indigo-200 dark:border-indigo-700 rounded-xl"
                data-testid="filter-nik-input"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">
              {filteredEmployees.length} dari {employees.length} karyawan ditemukan
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-gray-400">Hasil real-time</span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Employee Table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-gradient-to-r from-gray-50 to-indigo-50 dark:from-gray-800 dark:to-indigo-900/10">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">NIK</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">Nama</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">Position</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">Department</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">Investor Group</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">WhatsApp</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">QR Code</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="space-y-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
                          <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Memuat data karyawan...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="space-y-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto">
                          <Search className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        </div>
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium mb-1">Tidak ada karyawan ditemukan</p>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">Coba ubah kata kunci pencarian atau tambah karyawan baru</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee, index) => (
                    <tr 
                      key={employee.id} 
                      data-testid={`employee-row-${employee.id}`}
                      className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/10 dark:hover:to-indigo-900/10 transition-all duration-200 ${
                        index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/30 dark:bg-gray-700/20'
                      }`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{employee.id}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{employee.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{employee.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200">
                          {employee.position || "-"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200">
                          {employee.department || "-"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-100 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200">
                          {employee.investorGroup || "-"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900 dark:text-white font-mono">{employee.phone}</td>
                      <td className="py-4 px-6">
                        {employee.qrCode ? (
                          <QRCodeDisplay qrData={employee.qrCode} employeeName={employee.name} />
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700">
                            No QR
                          </Badge>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <Badge 
                          variant={employee.status === 'active' ? 'default' : 'secondary'}
                          className={employee.status === 'active' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }
                        >
                          {employee.status === 'active' ? '✓ Aktif' : '⏸ Tidak Aktif'}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(employee)}
                            data-testid={`edit-employee-${employee.id}`}
                            className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(employee.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-700"
                            data-testid={`delete-employee-${employee.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Enhanced Footer with Upload */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/10 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {filteredEmployees.length} dari {employees.length} karyawan
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Data diperbarui secara real-time
                </p>
              </div>
            </div>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg" data-testid="upload-excel-button">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center">
                      <Upload className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Upload Data Karyawan</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                      📄 Format File Excel:
                    </p>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• NIK, Nama, Posisi, Departemen</li>
                      <li>• Investor Group, No. WhatsApp</li>
                    </ul>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <div className="space-y-3">
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                      data-testid="select-excel-file"
                    >
                      <Upload className="w-5 h-5 mr-3" />
                      Pilih File Excel
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={downloadTemplate}
                      className="w-full h-12 border-2 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                      data-testid="download-template"
                    >
                      <Download className="w-5 h-5 mr-3" />
                      Download Template Excel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Delete All Confirmation Dialog */}
      <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Semua Data</DialogTitle>
            <DialogDescription>
              ⚠️ PERINGATAN: Anda akan menghapus semua data karyawan ({employees.length} karyawan). 
              Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data yang terkait.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Operasi ini akan menghapus:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc ml-6">
              <li>Semua data karyawan</li>
              <li>QR Code yang terkait</li>
              <li>Riwayat kehadiran (jika ada)</li>
            </ul>
            <p className="text-sm text-red-600 font-semibold">
              Pastikan Anda sudah membackup data jika diperlukan!
            </p>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteAllDialogOpen(false)}
                data-testid="cancel-delete-all"
              >
                Batal
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteAll}
                disabled={deleteAllMutation.isPending}
                data-testid="confirm-delete-all"
              >
                {deleteAllMutation.isPending ? "Menghapus..." : "Ya, Hapus Semua"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
