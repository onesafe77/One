import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema } from "@shared/schema";
import type { Employee, InsertEmployee } from "@shared/schema";
import { Plus, Search, Edit, Trash2, Upload, AlertCircle } from "lucide-react";
import { z } from "zod";
import * as XLSX from "xlsx";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = insertEmployeeSchema.extend({
  id: z.string().optional(), // NIK akan digenerate otomatis
  position: z.string().optional(),
  nomorLambung: z.string().optional(),
  department: z.string().optional(),
  investorGroup: z.string().optional(),
});

export default function Employees() {
  const [searchTerm, setSearchTerm] = useState("");
  const [nikFilter, setNikFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
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
      nomorLambung: "",
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

  const createMutation = useMutation({
    mutationFn: (data: InsertEmployee) => apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDialogOpen(false);
      form.reset();
      clearDraft(); // Clear auto saved draft after successful save
      toast({
        title: "Berhasil",
        description: "Karyawan berhasil ditambahkan",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal menambahkan karyawan",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertEmployee> }) =>
      apiRequest("PUT", `/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDialogOpen(false);
      setEditingEmployee(null);
      form.reset();
      clearDraft(); // Clear auto saved draft after successful save
      toast({
        title: "Berhasil",
        description: "Data karyawan berhasil diperbarui",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal memperbarui data karyawan",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Berhasil",
        description: "Karyawan berhasil dihapus",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal menghapus karyawan",
        variant: "destructive",
      });
    },
  });

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
      nomorLambung: employee.nomorLambung || "",
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
      nomorLambung: "",
      department: "",
      investorGroup: "",
      phone: "",
      status: "active",
    });
    setIsDialogOpen(true);
  };

  const uploadExcelMutation = useMutation({
    mutationFn: (employeeData: InsertEmployee[]) => 
      apiRequest("POST", "/api/employees/bulk", { employees: employeeData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsUploadDialogOpen(false);
      toast({
        title: "Berhasil",
        description: "Data karyawan berhasil diupload",
      });
    },
    onError: (error: any) => {
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
          .filter(row => row.length >= 7 && row[0] && row[1]) // Check required fields
          .map(row => ({
            id: row[0]?.toString() || "",
            name: row[1]?.toString() || "",
            position: row[2]?.toString() || "",
            nomorLambung: row[3]?.toString() || "",
            department: row[4]?.toString() || "",
            investorGroup: row[5]?.toString() || "",
            phone: row[6]?.toString() || "",
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
      ["NIK", "Nama", "Posisi", "Nomor Lambung", "Departemen", "Investor Group", "No. WhatsApp"],
      ["C-00001", "John Doe", "Manager", "L-001", "IT", "Group A", "+628123456789"],
      ["C-00002", "Jane Smith", "Staff", "L-002", "HR", "Group B", "+628123456790"],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Karyawan");
    XLSX.writeFile(workbook, "Template_Karyawan.xlsx");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Data Karyawan</CardTitle>
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
                    name="nomorLambung"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Lambung</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="L-001, L-002, dll" 
                            {...field} 
                            data-testid="employee-nomor-lambung-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nomorLambung"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Lambung</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="L-001, L-002, dll" 
                            {...field} 
                            data-testid="employee-nomor-lambung-input"
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
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="submit-employee-button"
                  >
                    {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : "Simpan"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
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
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Nomor Lambung</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Department</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Investor Group</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">WhatsApp</th>
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
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.nomorLambung || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.department || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.investorGroup || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.phone}</td>
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
                  Upload file Excel dengan format: NIK, Nama, Posisi, Nomor Lambung, Departemen, Investor Group, No. WhatsApp
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
      </CardContent>
    </Card>
  );
}
