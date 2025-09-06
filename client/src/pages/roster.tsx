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
import { Plus, Upload, Download, Filter, Calendar, CheckCircle, Clock, Users, Edit, Trash2, AlertCircle, Save, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  // Nomor lambung editing states
  const [editingNomorLambung, setEditingNomorLambung] = useState<{[key: string]: boolean}>({});
  const [tempNomorLambung, setTempNomorLambung] = useState<{[key: string]: string}>({});
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: rosterSchedules = [], isLoading: isLoadingRoster } = useQuery<any[]>({
    queryKey: ["/api/roster", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/roster?date=${selectedDate}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch roster');
      const data = await response.json();
      console.log(`🔄 Fetched ${data.length} roster entries for ${selectedDate}`);
      if (data.length > 0) {
        console.log('📋 Sample roster data:', data.slice(0, 3).map((r: any) => ({
          name: r.employee?.name || 'N/A',
          hariKerja: r.hariKerja,
          shift: r.shift
        })));
      }
      return data;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refresh when window focused
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
      // Invalidate QR validation cache untuk memastikan scan result menggunakan data roster terbaru
      queryClient.invalidateQueries({ queryKey: ["/api/qr/validate"] });
      // Invalidate attendance cache karena roster berubah bisa mempengaruhi validasi shift
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      
      setIsDialogOpen(false);
      form.reset();
      clearDraft(); // Clear auto saved draft after successful save
      toast({
        title: "Berhasil",
        description: "Roster berhasil ditambahkan - QR scan akan menggunakan data terbaru",
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
      // Invalidate QR validation cache untuk memastikan scan result menggunakan data roster terbaru
      queryClient.invalidateQueries({ queryKey: ["/api/qr/validate"] });
      // Invalidate attendance cache karena roster berubah bisa mempengaruhi validasi shift
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      
      setIsEditDialogOpen(false);
      setEditingRoster(null);
      toast({
        title: "Berhasil",
        description: "Roster berhasil diupdate - QR scan akan menggunakan data terbaru",
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
      // Invalidate QR validation cache untuk memastikan scan result menggunakan data roster terbaru
      queryClient.invalidateQueries({ queryKey: ["/api/qr/validate"] });
      // Invalidate attendance cache karena roster berubah bisa mempengaruhi validasi shift
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      
      toast({
        title: "Berhasil",
        description: "Roster berhasil dihapus - QR scan akan menggunakan data terbaru",
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

  const deleteAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/roster/delete-all", "DELETE", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qr/validate"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsDeleteAllDialogOpen(false);
      toast({
        title: "Berhasil",
        description: "Semua data roster berhasil dihapus",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal menghapus semua data roster",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (data: InsertRosterSchedule[]) => apiRequest("/api/roster/bulk", "POST", { rosters: data }),
    onSuccess: () => {
      // Force invalidate all roster related queries
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      queryClient.refetchQueries({ queryKey: ["/api/roster"] }); // Force refetch
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qr/validate"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      // Clear any cached roster data
      queryClient.removeQueries({ queryKey: ["/api/roster"] });
      
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadProgress(0);
      setIsProcessing(false);
      setProcessedCount(0);
      setTotalCount(0);
      toast({
        title: "Berhasil",
        description: `${totalCount} roster berhasil diupload dari Excel dengan nomor lambung terbaru`,
      });
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Gagal upload roster';
      const errorDetails = error.response?.data?.errors || [];
      
      setIsProcessing(false);
      setUploadProgress(0);
      toast({
        title: "Error",
        description: errorDetails.length > 0 ? errorDetails.join(', ') : errorMessage,
        variant: "destructive",
      });
    },
  });

  // Mutation untuk update nomor lambung employee
  const updateNomorLambungMutation = useMutation({
    mutationFn: ({ employeeId, nomorLambung }: { employeeId: string; nomorLambung: string }) => 
      apiRequest(`/api/employees/${employeeId}`, "PUT", { nomorLambung }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qr/validate"] });
      
      // Reset editing state
      setEditingNomorLambung(prev => ({ ...prev, [variables.employeeId]: false }));
      setTempNomorLambung(prev => ({ ...prev, [variables.employeeId]: "" }));
      
      toast({
        title: "Berhasil",
        description: `Nomor lambung berhasil diupdate ke: ${variables.nomorLambung}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal mengupdate nomor lambung",
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
      hariKerja: roster.hariKerja || "",
      status: roster.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (rosterId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus roster ini?")) {
      deleteMutation.mutate(rosterId);
    }
  };

  // Handler functions untuk nomor lambung editing
  const handleEditNomorLambung = (employeeId: string, currentValue: string) => {
    setEditingNomorLambung(prev => ({ ...prev, [employeeId]: true }));
    setTempNomorLambung(prev => ({ ...prev, [employeeId]: currentValue }));
  };

  const handleSaveNomorLambung = (employeeId: string) => {
    const newValue = tempNomorLambung[employeeId];
    if (!newValue || newValue.trim() === '') {
      toast({
        title: "Error",
        description: "Nomor lambung tidak boleh kosong",
        variant: "destructive",
      });
      return;
    }
    
    updateNomorLambungMutation.mutate({ employeeId, nomorLambung: newValue.trim() });
  };

  const handleCancelEditNomorLambung = (employeeId: string) => {
    setEditingNomorLambung(prev => ({ ...prev, [employeeId]: false }));
    setTempNomorLambung(prev => ({ ...prev, [employeeId]: "" }));
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

    setIsProcessing(true);
    setUploadProgress(0);
    setProcessedCount(0);

    try {
      // Phase 1: Read Excel file (20% progress)
      setUploadProgress(10);
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Read from "Template Roster" sheet specifically (like pandas)
      const sheetName = workbook.SheetNames.includes('Template Roster') 
        ? 'Template Roster' 
        : workbook.SheetNames[0];
      
      console.log('📋 Reading from sheet:', sheetName);
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log(`Excel file loaded with ${jsonData.length} rows`);
      console.log('=== RAW EXCEL DATA (first 3 rows) ===');
      console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));
      setUploadProgress(20);
      setTotalCount(jsonData.length);

      // Phase 2: Process data in chunks (20% to 80% progress)
      const rosterData: InsertRosterSchedule[] = [];
      const chunkSize = 500; // Process 500 rows at a time for better performance
      
      for (let i = 0; i < jsonData.length; i += chunkSize) {
        const chunk = jsonData.slice(i, i + chunkSize);
        
        const processedChunk = chunk.map((row: any) => {
          // Parse jam kerja format "08:00 - 16:00"
          const jamKerja = row['Jam Kerja'] || row.jamKerja || '';
          const jamKerjaParts = jamKerja.split(' - ');
          const shift = row.Shift || row.shift || 'Shift 1';
          
          // Set default times based on shift if jam kerja is not provided
          let defaultStartTime = '06:00';
          let defaultEndTime = '16:00';
          
          if (shift === 'Shift 2') {
            defaultStartTime = '16:30';
            defaultEndTime = '20:00';
          }
          
          const startTime = jamKerjaParts[0] ? jamKerjaParts[0].trim() : defaultStartTime;
          const endTime = jamKerjaParts[1] ? jamKerjaParts[1].trim() : defaultEndTime;

          // Handle date formatting - use correct Tanggal column
          let rosterDate = row.Tanggal || row.tanggal || row.Date || row.date || selectedDate;
          
          // If the date is an Excel serial number, convert it to a proper date
          if (typeof rosterDate === 'number') {
            const excelEpoch = new Date(1900, 0, 1);
            const convertedDate = new Date(excelEpoch.getTime() + (rosterDate - 2) * 24 * 60 * 60 * 1000);
            rosterDate = convertedDate.toISOString().split('T')[0];
          } else if (rosterDate && typeof rosterDate === 'string') {
            // Ensure the date is in YYYY-MM-DD format
            const dateObj = new Date(rosterDate);
            if (!isNaN(dateObj.getTime())) {
              rosterDate = dateObj.toISOString().split('T')[0];
            }
          }

          const processedRow = {
            employeeId: row.NIK || row.nik || row['Employee ID'] || row.employeeId || '',
            employeeName: row.Nama || row.nama || row.Name || row.name || '',
            nomorLambung: row['Nomor Lambung'] || row.nomorLambung || row.nomor_lambung || '',
            date: rosterDate,
            shift: row.Shift || row.shift || 'SHIFT 1',
            startTime: startTime,
            endTime: endTime,
            jamTidur: String(row['Jam Tidur'] || row.jamTidur || ''),
            fitToWork: row['Fit To Work'] || row.fitToWork || 'Fit To Work',
            hariKerja: String(row['Hari Kerja'] || row.hariKerja || ''),
            status: row.status || 'scheduled'
          };
          
          // Debug log untuk melihat mapping data (seperti pandas)
          if (i < 3) { // Log first 3 rows untuk debug
            console.log(`=== PANDAS-STYLE MAPPING ROW ${i + 1} ===`);
            console.log('📊 Raw Excel row:', row);
            console.log('🔍 Available columns:', Object.keys(row));
            console.log('📅 Tanggal (Excel serial):', row.Tanggal, 'type:', typeof row.Tanggal);
            console.log('⚡ Shift:', row.Shift, 'type:', typeof row.Shift);
            console.log('🎯 Hari Kerja (EXACT):', row['Hari Kerja'], 'type:', typeof row['Hari Kerja']);
            console.log('✅ Processed result:', processedRow);
            console.log('===================');
          }
          
          return processedRow;
        }).filter(row => row.employeeId && row.shift && row.startTime && row.endTime);

        rosterData.push(...processedChunk);
        
        // Update progress (20% to 80%)
        const processProgress = 20 + (60 * (i + chunkSize)) / jsonData.length;
        setUploadProgress(Math.min(processProgress, 80));
        setProcessedCount(i + chunkSize);
        
        // Reduce delay for faster processing
        if ((i + chunkSize) % 2000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }

      console.log(`Processed ${rosterData.length} valid rows out of ${jsonData.length} total rows`);
      setUploadProgress(80);

      if (rosterData.length === 0) {
        setIsProcessing(false);
        toast({
          title: "Error",
          description: "Tidak ada data valid ditemukan. Pastikan format Excel sesuai template",
          variant: "destructive",
        });
        return;
      }

      // Phase 3: Upload to server (80% to 100%)
      setUploadProgress(90);
      uploadMutation.mutate(rosterData);
      setUploadProgress(100);

    } catch (error) {
      console.error('Excel processing error:', error);
      setIsProcessing(false);
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
        Tanggal: '2025-08-30',
        Shift: 'Shift 1',
        'Jam Kerja': '08:00 - 16:00',
        'Jam Tidur': '6',
        'Fit To Work': 'Fit To Work',
        'Hari Kerja': 'Senin',
        Status: 'scheduled'
      },
      {
        NIK: 'C-004764',
        Nama: 'SAHRUL HELMI',
        'Nomor Lambung': 'GECL 9002',
        Tanggal: '2025-08-30',
        Shift: 'Shift 2',
        'Jam Kerja': '18:00 - 06:00',
        'Jam Tidur': '6',
        'Fit To Work': 'Fit To Work',
        'Hari Kerja': 'Senin',
        Status: 'scheduled'
      }
    ];

    // Add instructions and empty rows
    const instructionData = [
      {},
      {},
      { NIK: "INSTRUKSI:", Nama: "", 'Nomor Lambung': "", Tanggal: "", Shift: "", 'Jam Kerja': "", 'Jam Tidur': "", 'Fit To Work': "", 'Hari Kerja': "", Status: "" },
      { NIK: "1. Format Tanggal: YYYY-MM-DD (contoh: 2025-08-30)", Nama: "", 'Nomor Lambung': "", Tanggal: "", Shift: "", 'Jam Kerja': "", 'Jam Tidur': "", 'Fit To Work': "", 'Hari Kerja': "", Status: "" },
      { NIK: "2. Shift: Shift 1 atau Shift 2", Nama: "", 'Nomor Lambung': "", Tanggal: "", Shift: "", 'Jam Kerja': "", 'Jam Tidur': "", 'Fit To Work': "", 'Hari Kerja': "", Status: "" },
      { NIK: "3. Jam Kerja: 08:00 - 16:00 (opsional)", Nama: "", 'Nomor Lambung': "", Tanggal: "", Shift: "", 'Jam Kerja': "", 'Jam Tidur': "", 'Fit To Work': "", 'Hari Kerja': "", Status: "" },
      { NIK: "4. Jam Tidur: angka (contoh: 6, 7, 8)", Nama: "", 'Nomor Lambung': "", Tanggal: "", Shift: "", 'Jam Kerja': "", 'Jam Tidur': "", 'Fit To Work': "", 'Hari Kerja': "", Status: "" },
      { NIK: "5. Fit To Work: Fit To Work atau Not Fit", Nama: "", 'Nomor Lambung': "", Tanggal: "", Shift: "", 'Jam Kerja': "", 'Jam Tidur': "", 'Fit To Work': "", 'Hari Kerja': "", Status: "" },
      { NIK: "6. Hari Kerja: nama hari (contoh: Senin, Selasa)", Nama: "", 'Nomor Lambung': "", Tanggal: "", Shift: "", 'Jam Kerja': "", 'Jam Tidur': "", 'Fit To Work': "", 'Hari Kerja': "", Status: "" }
    ];

    const allData = [...templateData, ...instructionData];
    const worksheet = XLSX.utils.json_to_sheet(allData);
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
    if (shiftFilter === "SHIFT 1") return roster.shift === "SHIFT 1";
    if (shiftFilter === "SHIFT 2") return roster.shift === "SHIFT 2";
    return roster.shift === shiftFilter;
  });

  const rosterWithAttendance = filteredRosterSchedules.map(roster => ({
    ...roster,
    employee: roster.employee || employees.find(emp => emp.id === roster.employeeId), // Use API employee data first
    attendance: {
      status: roster.hasAttended ? 'present' : 'absent',
      time: roster.attendanceTime
    }
  }));

  // Calculate statistics based on filtered data (by date and shift)
  const filteredAttendance = attendance.filter(att => {
    // Match with filtered roster schedules
    const matchingRoster = filteredRosterSchedules.find(roster => roster.employeeId === att.employeeId);
    return !!matchingRoster;
  });

  const cutiCount = filteredRosterSchedules.filter(roster => roster.shift === 'CUTI').length;

  const stats = {
    scheduled: filteredRosterSchedules.length,
    present: filteredAttendance.length, 
    absent: filteredRosterSchedules.length - filteredAttendance.length - cutiCount,
    onLeave: cutiCount
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
                <SelectItem value="SHIFT 1">SHIFT 1</SelectItem>
                <SelectItem value="SHIFT 2">SHIFT 2</SelectItem>
                <SelectItem value="OVER SHIFT">OVER SHIFT</SelectItem>
                <SelectItem value="CUTI">CUTI</SelectItem>
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

            {/* Delete All Button */}
            <Button 
              onClick={() => setIsDeleteAllDialogOpen(true)}
              variant="destructive"
              data-testid="delete-all-roster-button"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus Semua
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
                      disabled={isProcessing}
                      data-testid="excel-file-input"
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      File dipilih: {selectedFile.name}
                    </p>
                  )}
                  
                  {/* Progress Bar Section */}
                  {isProcessing && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Memproses Excel...
                        </span>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {uploadProgress.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={uploadProgress} className="w-full" />
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {processedCount > 0 && totalCount > 0 && (
                          <span>Diproses: {processedCount.toLocaleString()} dari {totalCount.toLocaleString()} baris</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <Button 
                      onClick={processExcelFile}
                      disabled={!selectedFile || isProcessing || uploadMutation.isPending}
                      data-testid="process-excel-button"
                      className="flex-1"
                    >
                      {isProcessing ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Memproses...</span>
                        </div>
                      ) : uploadMutation.isPending ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Mengupload...</span>
                        </div>
                      ) : (
                        "Upload"
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      disabled={isProcessing}
                      onClick={() => {
                        setIsUploadDialogOpen(false);
                        setSelectedFile(null);
                        setUploadProgress(0);
                        setIsProcessing(false);
                        setProcessedCount(0);
                        setTotalCount(0);
                      }}
                    >
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
                                  {employee.id} - {employee.name} ({employee.position || 'No ID'})
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
                              <SelectItem value="Shift 1">Shift 1 (06:00 - 18:00)</SelectItem>
                              <SelectItem value="Shift 2">Shift 2 (18:00 - 06:00)</SelectItem>
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
                                  {employee.id} - {employee.name} ({employee.position || 'No ID'})
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
                              <SelectItem value="Shift 1">Shift 1 (06:00 - 18:00)</SelectItem>
                              <SelectItem value="Shift 2">Shift 2 (18:00 - 06:00)</SelectItem>
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
                    <FormField
                      control={editForm.control}
                      name="hariKerja"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hari Kerja</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Contoh: Senin, Selasa"
                              {...field}
                              value={field.value || ""}
                              data-testid="edit-roster-hari-kerja-input"
                            />
                          </FormControl>
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
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Tanggal</th>
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
                  <td colSpan={12} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rosterWithAttendance.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-gray-500 dark:text-gray-400">
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
                      {roster.employee?.nomorLambung === "SPARE" ? (
                        editingNomorLambung[roster.employeeId] ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium text-orange-600">SPARE</span>
                            <Input
                              value={tempNomorLambung[roster.employeeId] || ""}
                              onChange={(e) => setTempNomorLambung(prev => ({ ...prev, [roster.employeeId]: e.target.value }))}
                              placeholder="Masukkan nomor lambung"
                              className="w-32 h-8 text-xs"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveNomorLambung(roster.employeeId);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditNomorLambung(roster.employeeId);
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveNomorLambung(roster.employeeId)}
                              disabled={updateNomorLambungMutation.isPending}
                              className="h-6 w-6 p-0"
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelEditNomorLambung(roster.employeeId)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="secondary" 
                              className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-800"
                              onClick={() => handleEditNomorLambung(roster.employeeId, "SPARE")}
                            >
                              SPARE
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditNomorLambung(roster.employeeId, "SPARE")}
                              className="h-6 w-6 p-0"
                              title="Edit nomor lambung"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        )
                      ) : roster.employee?.nomorLambung && roster.employee.nomorLambung !== '-' && 
                          roster.employee.nomorLambung !== 'null' && roster.employee.nomorLambung.trim() !== '' ? (
                        // Cek apakah ini karyawan SPARE yang sudah update nomor lambung
                        roster.employee.nomorLambung.includes('GECL') ? (
                          // Untuk karyawan SPARE yang sudah update dengan GECL, tampilkan badge SPARE
                          <div className="flex items-center space-x-1">
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs">
                              SPARE
                            </Badge>
                            <span className="text-sm font-medium">{roster.employee.nomorLambung}</span>
                          </div>
                        ) : (
                          // Untuk nomor lambung lainnya, tampilkan apa adanya
                          roster.employee.nomorLambung
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {new Date(roster.date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.shift}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.hariKerja || '-'}
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
      
      {/* Delete All Confirmation Dialog */}
      <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Semua Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Apakah Anda yakin ingin menghapus <strong>SEMUA</strong> data roster? 
              Tindakan ini tidak dapat dibatalkan dan akan menghapus semua jadwal kerja yang ada.
            </p>
            <div className="flex space-x-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteAllDialogOpen(false)}
                disabled={deleteAllMutation.isPending}
              >
                Batal
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending}
                data-testid="confirm-delete-all-button"
              >
                {deleteAllMutation.isPending ? "Menghapus..." : "Ya, Hapus Semua"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}