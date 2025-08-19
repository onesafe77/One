import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface LeaveRosterData {
  nik: string;
  nama: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
}

export default function LeaveRosterUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (data: LeaveRosterData[]): Promise<{ success: number; errors: string[] }> => {
      return apiRequest("/api/leave-roster/bulk-upload", "POST", { leaveData: data });
    },
    onSuccess: (result: { success: number; errors: string[] }) => {
      setUploadResults(result);
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-history"] });
      
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

          // Skip header row
          const dataRows = jsonData.slice(1) as any[][];
          
          const leaveData: LeaveRosterData[] = dataRows
            .filter(row => row.length >= 6 && row[0]) // Pastikan ada data NIK
            .map((row, index) => {
              // Validasi format tanggal
              const startDate = parseExcelDate(row[3]);
              const endDate = parseExcelDate(row[4]);
              
              if (!startDate || !endDate) {
                throw new Error(`Baris ${index + 2}: Format tanggal tidak valid`);
              }

              return {
                nik: String(row[0]).trim(),
                nama: String(row[1] || "").trim(),
                leaveType: String(row[2] || "Cuti Tahunan").trim(),
                startDate: startDate,
                endDate: endDate,
                totalDays: parseInt(String(row[5])) || calculateDaysBetween(startDate, endDate),
                reason: String(row[6] || "").trim(),
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
    
    // Jika sudah dalam format string YYYY-MM-DD
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    
    // Jika dalam format DD/MM/YYYY atau DD-MM-YYYY
    if (typeof value === "string") {
      const parts = value.split(/[\/\-]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    
    // Jika berupa Excel date number
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

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "File Belum Dipilih",
        description: "Silakan pilih file Excel terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulasi progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

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
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ["NIK", "Nama Karyawan", "Jenis Cuti", "Tanggal Mulai", "Tanggal Selesai", "Total Hari", "Keterangan"],
      ["C-00001", "John Doe", "Cuti Tahunan", "2024-08-20", "2024-08-22", 3, "Liburan keluarga"],
      ["C-00002", "Jane Smith", "Cuti Sakit", "2024-08-21", "2024-08-21", 1, "Sakit demam"],
      ["C-00003", "Bob Johnson", "Cuti Tahunan", "2024-08-25", "2024-08-27", 3, "Urusan pribadi"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Roster Cuti");
    XLSX.writeFile(wb, "template_roster_cuti.xlsx");

    toast({
      title: "Template Downloaded",
      description: "Template Excel berhasil didownload",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upload Roster Cuti</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Upload data cuti karyawan secara massal menggunakan file Excel
          </p>
        </div>
      </div>

      {/* Template Download Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Template
          </CardTitle>
          <CardDescription>
            Download template Excel untuk format data roster cuti yang benar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={downloadTemplate}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="button-download-template"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download Template Excel
          </Button>
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload File Excel
          </CardTitle>
          <CardDescription>
            Pilih file Excel yang berisi data roster cuti karyawan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">File Excel (.xlsx, .xls)</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              ref={fileInputRef}
              data-testid="input-file-upload"
            />
          </div>

          {file && (
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                File terpilih: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </AlertDescription>
            </Alert>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Mengupload data...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || isUploading || uploadMutation.isPending}
            className="w-full"
            data-testid="button-upload"
          >
            {isUploading || uploadMutation.isPending ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Mengupload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Roster Cuti
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Upload Results */}
      {uploadResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {uploadResults.errors.length === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              Hasil Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {uploadResults.success}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Data Berhasil
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {uploadResults.errors.length}
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  Data Gagal
                </div>
              </div>
            </div>

            {uploadResults.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600 dark:text-red-400">Error Details:</h4>
                <div className="max-h-40 overflow-y-auto">
                  {uploadResults.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Petunjuk Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><strong>Format Excel yang diperlukan:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Kolom A: NIK Karyawan (wajib, contoh: C-00001)</li>
              <li>Kolom B: Nama Karyawan</li>
              <li>Kolom C: Jenis Cuti (Cuti Tahunan, Cuti Sakit, dll)</li>
              <li>Kolom D: Tanggal Mulai (format: YYYY-MM-DD atau DD/MM/YYYY)</li>
              <li>Kolom E: Tanggal Selesai (format: YYYY-MM-DD atau DD/MM/YYYY)</li>
              <li>Kolom F: Total Hari Cuti</li>
              <li>Kolom G: Keterangan (opsional)</li>
            </ul>
            <p className="mt-4"><strong>Catatan:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Baris pertama adalah header, akan diabaikan saat import</li>
              <li>NIK karyawan harus sudah terdaftar di sistem</li>
              <li>Format tanggal harus konsisten</li>
              <li>Total hari akan dihitung otomatis jika kosong</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}