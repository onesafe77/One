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
import { Plus, Search, Edit, Trash2, Upload, AlertCircle, Download, Eye, QrCode, Image, ExternalLink, Trash } from "lucide-react";
import { z } from "zod";
import * as XLSX from "xlsx";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import QRCode from "qrcode";

// Helper function to convert Google Drive URL to direct image URL
const convertGoogleDriveUrl = (url: string): string => {
  if (!url) return url;
  
  // Check if it's a Google Drive sharing URL
  const driveRegex = /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)\/view/;
  const match = url.match(driveRegex);
  
  if (match) {
    const fileId = match[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  
  // Return original URL if it's not Google Drive or already direct
  return url;
};

// Component untuk preview foto profil
function ProfileImagePreview({ imageUrl }: { imageUrl: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  if (!imageUrl) return null;
  
  const directImageUrl = convertGoogleDriveUrl(imageUrl);
  
  return (
    <div className="mt-2">
      <p className="text-sm text-gray-600 mb-2">Preview Foto:</p>
      <div className="relative w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}
        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <Image className="h-8 w-8" />
          </div>
        ) : (
          <img
            src={directImageUrl}
            alt="Preview foto profil"
            className="w-full h-full object-cover"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Component untuk menampilkan foto profil di tabel
function TableProfileImage({ imageUrl, employeeName }: { imageUrl: string | null; employeeName: string }) {
  const [hasError, setHasError] = useState(false);
  
  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
        <Image className="w-5 h-5 text-gray-400" />
      </div>
    );
  }
  
  const directImageUrl = convertGoogleDriveUrl(imageUrl);
  
  return (
    <div className="flex items-center justify-center">
      {hasError ? (
        <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
          <Image className="w-5 h-5 text-gray-400" />
        </div>
      ) : (
        <img
          src={directImageUrl}
          alt={`Foto ${employeeName}`}
          className="w-10 h-10 object-cover rounded-full border-2 border-gray-200"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

const formSchema = insertEmployeeSchema.extend({
  id: z.string().optional(), // NIK akan digenerate otomatis
  position: z.string().optional(),
  department: z.string().optional(),
  investorGroup: z.string().optional(),
  profileImageUrl: z.string().optional(), // URL foto profil dari Google Drive atau lainnya
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
      profileImageUrl: "",
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

  const deleteAllMutation = useMutation<void, Error, void>({
    mutationFn: () => apiRequest("/api/employees/delete-all", "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDeleteAllDialogOpen(false);
      toast({
        title: "Berhasil",
        description: "Semua data karyawan berhasil dihapus",
      });
    },
    onError: (error: Error) => {
      setIsDeleteAllDialogOpen(false);
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus semua data karyawan",
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
      department: employee.department || "",
      investorGroup: employee.investorGroup || "",
      phone: employee.phone,
      profileImageUrl: employee.profileImageUrl || "",
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
      profileImageUrl: "",
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
          .filter(row => row.length >= 6 && row[0] && row[1]) // Check required fields (keeping minimum 6 for backward compatibility)
          .map(row => ({
            id: row[0]?.toString() || "",
            name: row[1]?.toString() || "",
            position: row[2]?.toString() || "",
            department: row[3]?.toString() || "",
            investorGroup: row[4]?.toString() || "",
            phone: row[5]?.toString() || "",
            profileImageUrl: row[6]?.toString() || "", // URL Foto dari kolom ke-7
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
      ["NIK", "Nama", "Posisi", "Departemen", "Investor Group", "No. WhatsApp", "URL Foto"],
      ["C-00001", "John Doe", "Manager", "IT", "Group A", "+628123456789", "https://drive.google.com/file/d/ABC123/view?usp=sharing"],
      ["C-00002", "Jane Smith", "Staff", "HR", "Group B", "+628123456790", "https://drive.google.com/file/d/XYZ789/view?usp=sharing"],
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
                    name="profileImageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          URL Foto Profil
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Input 
                              placeholder="https://drive.google.com/file/d/ABC123/view?usp=sharing" 
                              {...field} 
                              data-testid="employee-photo-url-input"
                            />
                            <p className="text-xs text-gray-500">
                              Paste URL Google Drive dengan permission "Anyone with the link can view"
                            </p>
                            <ProfileImagePreview imageUrl={field.value || ""} />
                          </div>
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
                <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Foto</th>
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
                  <td colSpan={10} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data karyawan
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} data-testid={`employee-row-${employee.id}`}>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.id}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{employee.name}</td>
                    <td className="py-3 px-4">
                      <TableProfileImage 
                        imageUrl={employee.profileImageUrl || null} 
                        employeeName={employee.name} 
                      />
                    </td>
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
        
        {/* Pagination Info and Action Buttons */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Menampilkan {filteredEmployees.length} dari {employees.length} karyawan
          </p>
          <div className="flex gap-2">
            <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300" 
                  data-testid="delete-all-button"
                  disabled={employees.length === 0}
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Hapus Semua
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    Konfirmasi Hapus Semua Data
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800 font-medium mb-2">
                      ⚠️ PERINGATAN: Tindakan ini tidak dapat dibatalkan!
                    </p>
                    <p className="text-sm text-red-700">
                      Anda akan menghapus <strong>SEMUA {employees.length} data karyawan</strong> dari database. 
                      Semua data termasuk roster, absensi, dan riwayat akan ikut terhapus.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    Fitur ini berguna untuk mengupload data fresh dari Excel. 
                    Pastikan Anda sudah membackup data penting sebelum melanjutkan.
                  </p>
                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDeleteAllDialogOpen(false)}
                      className="flex-1"
                      data-testid="cancel-delete-all"
                    >
                      Batal
                    </Button>
                    <Button 
                      onClick={() => deleteAllMutation.mutate()}
                      disabled={deleteAllMutation.isPending}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      data-testid="confirm-delete-all"
                    >
                      {deleteAllMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Menghapus...
                        </>
                      ) : (
                        <>
                          <Trash className="w-4 h-4 mr-2" />
                          Ya, Hapus Semua
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="upload-excel-button">
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
                  Upload file Excel dengan format: NIK, Nama, Posisi, Departemen, Investor Group, No. WhatsApp, URL Foto
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
        </div>
      </CardContent>
    </Card>
  );
}
