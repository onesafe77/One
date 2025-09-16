import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Plus, Search, Edit, Trash2, Upload, AlertCircle, Download, Eye, QrCode } from "lucide-react";
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Data Karyawan</CardTitle>
          <div className="flex gap-2">
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
            >
              <QrCode className="w-4 h-4 mr-2" />
              Update QR URL
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleNewEmployee} data-testid="add-employee-button">
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
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dashboard" data-testid="dashboard-tab">Dashboard</TabsTrigger>
            <TabsTrigger value="list" data-testid="list-tab">List</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* Dashboard Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Select value={dashboardDepartmentFilter} onValueChange={setDashboardDepartmentFilter}>
                <SelectTrigger data-testid="dashboard-department-filter">
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
                <SelectTrigger data-testid="dashboard-position-filter">
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
                <SelectTrigger data-testid="dashboard-status-filter">
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
              >
                Reset Filter
              </Button>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <div className="w-4 h-4 bg-blue-600 rounded"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Karyawan</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="card-total-employees">
                        {dashboardStats.totalEmployees}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <div className="w-4 h-4 bg-green-600 rounded"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Aktif</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="card-active">
                        {dashboardStats.activeEmployees}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                      <div className="w-4 h-4 bg-red-600 rounded"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Tidak Aktif</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="card-inactive">
                        {dashboardStats.inactiveEmployees}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <div className="w-4 h-4 bg-purple-600 rounded"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Posisi</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="card-unique-positions">
                        {dashboardStats.uniquePositions}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                      <div className="w-4 h-4 bg-orange-600 rounded"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Dept</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="card-unique-departments">
                        {dashboardStats.uniqueDepartments}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Position and Department Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Position Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Berdasarkan Posisi</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Posisi</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(dashboardStats.positionCounts)
                        .sort(([,a], [,b]) => b - a)
                        .map(([position, count]) => (
                        <TableRow 
                          key={position}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => handlePositionClick(position)}
                          data-testid={`position-row-${position}`}
                        >
                          <TableCell className="font-medium">{position}</TableCell>
                          <TableCell className="text-right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              {/* Department Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Berdasarkan Department</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(dashboardStats.departmentCounts)
                        .sort(([,a], [,b]) => b - a)
                        .map(([department, count]) => (
                        <TableRow 
                          key={department}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => handleDepartmentClick(department)}
                          data-testid={`department-row-${department}`}
                        >
                          <TableCell className="font-medium">{department}</TableCell>
                          <TableCell className="text-right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
            
            {/* Investor Group Table */}
            <Card>
              <CardHeader>
                <CardTitle>Berdasarkan Investor Group</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Investor Group</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(dashboardStats.investorGroupCounts)
                      .sort(([,a], [,b]) => b - a)
                      .map(([group, count]) => (
                      <TableRow 
                        key={group}
                        data-testid={`investor-group-row-${group}`}
                      >
                        <TableCell className="font-medium">{group}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="list" className="mt-6">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Cari karyawan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-employees-input"
            />
          </div>
          <div className="w-full sm:w-[180px]">
            <Input
              placeholder="Cari NIK..."
              value={nikFilter}
              onChange={(e) => setNikFilter(e.target.value)}
              data-testid="filter-nik-input"
            />
          </div>
        </div>
        
        {/* Employee Table */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">NIK</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Nama</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Position</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Department</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Investor Group</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">WhatsApp</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">QR Code</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data karyawan
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} data-testid={`employee-row-${employee.id}`}>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.id}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.position || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.department || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.investorGroup || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.phone}</td>
                    <td className="py-3 px-4">
                      {employee.qrCode ? (
                        <QRCodeDisplay qrData={employee.qrCode} employeeName={employee.name} />
                      ) : (
                        <Badge variant="secondary">
                          No QR
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge 
                        variant={employee.status === 'active' ? 'default' : 'secondary'}
                        className={employee.status === 'active' ? 'status-present' : 'status-pending'}
                      >
                        {employee.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(employee)}
                          data-testid={`edit-employee-${employee.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(employee.id)}
                          className="text-red-600 hover:text-red-700"
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
        
        {/* Pagination Info and Upload Excel Button */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Menampilkan {filteredEmployees.length} dari {employees.length} karyawan
          </p>
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="ml-auto" data-testid="upload-excel-button">
                <Upload className="w-4 h-4 mr-2" />
                Upload Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Data Karyawan dari Excel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Upload file Excel dengan format: NIK, Nama, Posisi, Departemen, Investor Group, No. WhatsApp
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  data-testid="select-excel-file"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Pilih File Excel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={downloadTemplate}
                  className="w-full"
                  data-testid="download-template"
                >
                  Download Template Excel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
