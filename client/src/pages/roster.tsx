import { useState } from "react";
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
import { insertRosterSchema } from "@shared/schema";
import type { Employee, RosterSchedule, AttendanceRecord, InsertRosterSchedule } from "@shared/schema";
import { Plus, Upload, Download, Filter, Calendar, CheckCircle, Clock, Users, Edit, Trash2, AlertCircle } from "lucide-react";
import { z } from "zod";
import * as XLSX from 'xlsx';
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveAs } from 'file-saver';

const formSchema = insertRosterSchema;

export default function Roster() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRoster, setEditingRoster] = useState<RosterSchedule | null>(null);
  const [shiftFilter, setShiftFilter] = useState("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: rosterSchedules = [], isLoading: isLoadingRoster } = useQuery<any[]>({
    queryKey: ["/api/roster", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/roster?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch roster');
      return response.json();
    },
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/attendance?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return response.json();
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      date: selectedDate,
      shift: "",
      startTime: "",
      endTime: "",
      jamTidur: "",
      fitToWork: "Fit To Work",
      status: "scheduled",
    },
  });

  // Auto save hook for roster form
  const { saveStatus, clearDraft, hasDraft } = useAutoSave({
    key: 'roster_new',
    form,
    exclude: [], // Save all fields for roster
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      date: selectedDate,
      shift: "",
      startTime: "",
      endTime: "",
      jamTidur: "",
      fitToWork: "Fit To Work",
      status: "scheduled",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertRosterSchedule) => apiRequest("/api/roster", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      setIsDialogOpen(false);
      form.reset();
      clearDraft(); // Clear auto saved draft after successful save
      toast({
        title: "Berhasil",
        description: "Roster berhasil ditambahkan",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal menambahkan roster",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertRosterSchedule> }) => 
      apiRequest(`/api/roster/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      setIsEditDialogOpen(false);
      setEditingRoster(null);
      toast({
        title: "Berhasil",
        description: "Roster berhasil diupdate",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal mengupdate roster",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/roster/${id}`, "DELETE", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      toast({
        title: "Berhasil",
        description: "Roster berhasil dihapus",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal menghapus roster",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (data: InsertRosterSchedule[]) => apiRequest("/api/roster/bulk", "POST", { rosters: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      toast({
        title: "Berhasil",
        description: "Roster berhasil diupload dari Excel",
      });
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Gagal upload roster';
      const errorDetails = error.response?.data?.errors || [];
      
      toast({
        title: "Error",
        description: errorDetails.length > 0 ? errorDetails.join(', ') : errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({
      ...values,
      date: selectedDate, // Always use the selected date from date picker
    });
  };

  const onEditSubmit = (values: z.infer<typeof formSchema>) => {
    if (!editingRoster) return;
    updateMutation.mutate({
      id: editingRoster.id,
      data: { ...values, date: selectedDate } // Always use the selected date from date picker
    });
  };

  const handleEdit = (roster: RosterSchedule) => {
    setEditingRoster(roster);
    editForm.reset({
      employeeId: roster.employeeId,
      date: roster.date,
      shift: roster.shift,
      startTime: roster.startTime,
      endTime: roster.endTime,
      jamTidur: roster.jamTidur || "",
      fitToWork: roster.fitToWork || "Fit To Work",
      status: roster.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (rosterId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus roster ini?")) {
      deleteMutation.mutate(rosterId);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const processExcelFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Pilih file Excel terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Excel data parsed:', jsonData);

      const rosterData: InsertRosterSchedule[] = jsonData.map((row: any, index: number) => {
        console.log(`Processing row ${index + 1}:`, row);

        // Parse jam kerja format "08:00 - 16:00"
        const jamKerja = row['Jam Kerja'] || row.jamKerja || '';
        const jamKerjaParts = jamKerja.split(' - ');
        const startTime = jamKerjaParts[0] ? jamKerjaParts[0].trim() : '08:00';
        const endTime = jamKerjaParts[1] ? jamKerjaParts[1].trim() : '16:00';

        const rosterData = {
          employeeId: row.NIK || row.nik || row['Employee ID'] || row.employeeId || '',
          date: selectedDate, // This will use the currently selected date in the UI
          shift: row.Shift || row.shift || 'Shift 1',
          startTime: startTime,
          endTime: endTime,
          jamTidur: String(row['Jam Tidur'] || row.jamTidur || ''),
          fitToWork: row['Fit To Work'] || row.fitToWork || 'Fit To Work',
          status: row.Status || row.status || 'scheduled'
        };

        console.log(`Mapped data for row ${index + 1} with date ${selectedDate}:`, rosterData);
        return rosterData;
      }).filter(row => row.employeeId && row.shift && row.startTime && row.endTime);

      console.log('Final roster data to upload:', rosterData);

      if (rosterData.length === 0) {
        toast({
          title: "Error",
          description: "Tidak ada data valid ditemukan. Pastikan format Excel sesuai template",
          variant: "destructive",
        });
        return;
      }

      uploadMutation.mutate(rosterData);
    } catch (error) {
      console.error('Excel processing error:', error);
      toast({
        title: "Error",
        description: "Format file Excel tidak valid",
        variant: "destructive",
      });
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        NIK: 'C-015227',
        Nama: 'SYAHRIAL H',
        'Nomor Lambung': 'GECL 9001',
        Shift: 'Shift 1',
        'Jam Kerja': '06:00 - 07:30',
        'Jam Tidur': '6',
        'Fit To Work': 'Fit To Work',
        Status: 'scheduled'
      },
      {
        NIK: 'C-004764',
        Nama: 'SAHRUL HELMI',
        'Nomor Lambung': 'GECL 9002',
        Shift: 'Shift 1',
        'Jam Kerja': '06:00 - 07:30',
        'Jam Tidur': '6',
        'Fit To Work': 'Fit To Work',
        Status: 'scheduled'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Roster');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'template-roster.xlsx');
  };

  const getEmployeeName = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId)?.name || 'Unknown';
  };

  const filteredRosterSchedules = rosterSchedules.filter(roster => {
    if (shiftFilter === "all") return true;
    return roster.shift === shiftFilter;
  });

  const rosterWithAttendance = filteredRosterSchedules.map(roster => ({
    ...roster,
    employee: employees.find(emp => emp.id === roster.employeeId),
    attendance: {
      status: roster.hasAttended ? 'present' : 'absent',
      time: roster.attendanceTime
    }
  }));

  const stats = {
    scheduled: rosterSchedules.length,
    present: attendance.length,
    absent: rosterSchedules.length - attendance.length,
    onLeave: 0 // This would need to be calculated from leave data
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Roster Kerja</CardTitle>
          </div>
          
          <div className="flex items-center space-x-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
              data-testid="roster-date-input"
            />
            
            {/* Shift Filter */}
            <Select value={shiftFilter} onValueChange={setShiftFilter}>
              <SelectTrigger className="w-48" data-testid="shift-filter-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Shift</SelectItem>
                <SelectItem value="Shift 1">Shift 1 saja</SelectItem>
                <SelectItem value="Shift 2">Shift 2 saja</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={downloadTemplate}
              variant="outline"
              data-testid="download-template-button"
            >
              <Download className="w-4 h-4 mr-2" />
              Template Excel
            </Button>

            {/* Upload Excel Dialog */}
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" data-testid="upload-excel-button">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Excel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Excel Roster</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      data-testid="excel-file-input"
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      File dipilih: {selectedFile.name}
                    </p>
                  )}
                  <div className="flex space-x-2">
                    <Button 
                      onClick={processExcelFile}
                      disabled={!selectedFile || uploadMutation.isPending}
                      data-testid="process-excel-button"
                    >
                      {uploadMutation.isPending ? "Mengupload..." : "Upload"}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsUploadDialogOpen(false);
                      setSelectedFile(null);
                    }}>
                      Batal
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Add Roster Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-roster-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Roster
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>Tambah Roster</span>
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
                              <SelectTrigger data-testid="roster-employee-select">
                                <SelectValue placeholder="Pilih karyawan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id}>
                                  {employee.id} - {employee.name} ({employee.nomorLambung || employee.position || 'No ID'})
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
                      name="shift"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shift</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="roster-shift-select">
                                <SelectValue placeholder="Pilih shift" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Shift 1">Shift 1 (04:00 - 18:00)</SelectItem>
                              <SelectItem value="Shift 2">Shift 2 (16:00 - 08:00)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jam Mulai</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="roster-start-time-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jam Selesai</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="roster-end-time-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="jamTidur"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jam Tidur (contoh: 6 atau 5)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="1"
                              max="12"
                              placeholder="6"
                              {...field}
                              value={field.value || ""}
                              data-testid="roster-jam-tidur-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fitToWork"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status Fit To Work</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="roster-fit-to-work-select">
                                <SelectValue placeholder="Pilih status fit to work" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Fit To Work">Fit To Work</SelectItem>
                              <SelectItem value="Not Fit To Work">Not Fit To Work</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createMutation.isPending}
                      data-testid="submit-roster-button"
                    >
                      {createMutation.isPending ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            
            {/* Edit Roster Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Edit Roster</DialogTitle>
                </DialogHeader>
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="employeeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Karyawan</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="edit-roster-employee-select">
                                <SelectValue placeholder="Pilih karyawan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id}>
                                  {employee.id} - {employee.name} ({employee.nomorLambung || employee.position || 'No ID'})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="shift"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shift</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="edit-roster-shift-select">
                                <SelectValue placeholder="Pilih shift" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Shift 1">Shift 1 (04:00 - 18:00)</SelectItem>
                              <SelectItem value="Shift 2">Shift 2 (16:00 - 08:00)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jam Mulai</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="edit-roster-start-time-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jam Selesai</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="edit-roster-end-time-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="jamTidur"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jam Tidur (contoh: 6 atau 5)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="1"
                              max="12"
                              placeholder="6"
                              {...field}
                              value={field.value || ""}
                              data-testid="edit-roster-jam-tidur-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="fitToWork"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status Fit To Work</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="edit-roster-fit-to-work-select">
                                <SelectValue placeholder="Pilih status fit to work" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Fit To Work">Fit To Work</SelectItem>
                              <SelectItem value="Not Fit To Work">Not Fit To Work</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex space-x-2">
                      <Button 
                        type="submit" 
                        className="flex-1"
                        disabled={updateMutation.isPending}
                        data-testid="update-roster-button"
                      >
                        {updateMutation.isPending ? "Menyimpan..." : "Update"}
                      </Button>
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditDialogOpen(false);
                          setEditingRoster(null);
                        }}
                      >
                        Batal
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
        {/* Roster Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" data-testid="stats-scheduled">
            <Calendar className="w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.scheduled}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Dijadwalkan</p>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900 rounded-lg" data-testid="stats-present">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
            <p className="text-2xl font-semibold text-green-600 dark:text-green-300">{stats.present}</p>
            <p className="text-sm text-green-600 dark:text-green-400">Hadir</p>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900 rounded-lg" data-testid="stats-absent">
            <Clock className="w-6 h-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
            <p className="text-2xl font-semibold text-red-600 dark:text-red-300">{stats.absent}</p>
            <p className="text-sm text-red-600 dark:text-red-400">Belum Hadir</p>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900 rounded-lg" data-testid="stats-leave">
            <Users className="w-6 h-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
            <p className="text-2xl font-semibold text-purple-600 dark:text-purple-300">{stats.onLeave}</p>
            <p className="text-sm text-purple-600 dark:text-purple-400">Cuti</p>
          </div>
        </div>
        
        {/* Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">NIK</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Nama</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Position</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Nomor Lambung</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Shift</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Hari Kerja</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Jam Tidur</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Fit To Work</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Jam Absensi</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingRoster ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rosterWithAttendance.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada roster untuk tanggal ini
                  </td>
                </tr>
              ) : (
                rosterWithAttendance.map((roster) => (
                  <tr key={roster.id} data-testid={`roster-row-${roster.employeeId}`}>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.employeeId}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.employee?.name || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.employee?.position || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.employee?.nomorLambung || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.shift}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs">
                        {(roster as any).workDays !== null && (roster as any).workDays !== undefined ? `${(roster as any).workDays} Hari` : '-'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.actualJamTidur || roster.jamTidur || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge 
                        variant={(roster.actualFitToWork || roster.fitToWork) === "Fit To Work" ? "default" : "destructive"}
                        data-testid={`roster-fit-to-work-${roster.employeeId}`}
                      >
                        {roster.actualFitToWork || roster.fitToWork || "Fit To Work"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge 
                        className={roster.hasAttended ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}
                      >
                        {roster.hasAttended ? 'Hadir' : 'Belum Hadir'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.attendanceTime || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEdit(roster)}
                          data-testid={`edit-roster-${roster.employeeId}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDelete(roster.id)}
                          data-testid={`delete-roster-${roster.employeeId}`}
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
      </CardContent>
    </Card>
  );
}