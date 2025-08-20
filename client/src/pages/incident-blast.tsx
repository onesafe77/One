import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Employee } from "@shared/schema";
import { 
  AlertTriangle,
  Send,
  Users,
  Clock,
  MapPin,
  FileText,
  Camera,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
  Eye,
  Download,
  Upload,
  X,
  Image,
  BarChart3,
  Calendar,
  TrendingUp,
  Wifi
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// Schema untuk incident notification (form mode)
const incidentSchema = z.object({
  incidentType: z.string().min(1, "Jenis insiden harus diisi"),
  location: z.string().min(1, "Lokasi kejadian harus diisi"),
  description: z.string().min(1, "Deskripsi harus diisi"),
  currentStatus: z.string().min(1, "Status terkini harus diisi"),
  instructions: z.string().min(1, "Instruksi untuk karyawan harus diisi"),
  mediaPath: z.string().optional(),
  provider: z.enum(['notif']).optional(),
});

// Schema untuk JSON manual mode
const jsonBlastSchema = z.object({
  apikey: z.string().min(1, "API key harus diisi"),
  receiver: z.string().min(1, "Receiver harus diisi (contoh: 120363043283436111@g.us)"),
  mtype: z.enum(['text', 'image'], { required_error: "Pilih text atau image" }),
  text: z.string().min(1, "Text pesan harus diisi"),
  url: z.string().url("URL harus valid").optional(),
});

type IncidentForm = z.infer<typeof incidentSchema>;
type JsonBlastForm = z.infer<typeof jsonBlastSchema>;

interface BlastResult {
  employeeId: string;
  employeeName: string;
  phoneNumber: string;
  status: 'terkirim' | 'gagal';
  errorMessage?: string;
  sentAt?: string;
}

interface BlastReport {
  id: string;
  incidentType: string;
  location: string;
  description: string;
  totalEmployees: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  results: BlastResult[];
  mediaPath?: string;
}

export default function IncidentBlast() {
  const [uploadedMediaPath, setUploadedMediaPath] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [lastBlastResult, setLastBlastResult] = useState<BlastReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'notif'>('notif');
  const [connectionStatus, setConnectionStatus] = useState<{success: boolean; message: string} | null>(null);
  const [inputMode, setInputMode] = useState<'form' | 'json'>('form'); // Toggle between form and JSON input
  const { toast } = useToast();

  // Query untuk mengambil data karyawan - optimized loading
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    staleTime: 300000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Query untuk blast history - optimized loading
  const { data: blastHistory = [], isLoading: loadingHistory } = useQuery<BlastReport[]>({
    queryKey: ["/api/incident-blast/history"],
    refetchInterval: 60000, // Reduced from 30s to 60s
    staleTime: 30000, // Cache for 30 seconds
  });

  const form = useForm<IncidentForm>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      incidentType: "",
      location: "",
      description: "",
      currentStatus: "",
      instructions: "",
      mediaPath: "",
    },
  });

  // Form untuk mode JSON manual
  const jsonForm = useForm<JsonBlastForm>({
    resolver: zodResolver(jsonBlastSchema),
    defaultValues: {
      apikey: "U7tu87RGNgXcvdpgqNDXuGYEI6u9j8wh1719260547002", // Pre-fill dengan API key yang ada
      receiver: "6281234567890@c.us", // Format contoh Indonesia
      mtype: "text",
      text: "",
      url: "",
    },
  });

  // Mutation untuk mengirim blast WhatsApp (mode form)
  const sendBlastMutation = useMutation({
    mutationFn: async (data: IncidentForm & { mediaPath?: string }): Promise<BlastReport> => {
      const response = await apiRequest("POST", "/api/incident-blast/send", data);
      return await response.json();
    },
    onSuccess: (result: BlastReport) => {
      setLastBlastResult(result);
      setShowReport(true);
      queryClient.invalidateQueries({ queryKey: ["/api/incident-blast/history"] });
      
      toast({
        title: "Blast WhatsApp Selesai",
        description: `${result.successCount} dari ${result.totalEmployees} karyawan berhasil diterima notifikasi`,
      });
      
      form.reset();
      setUploadedMediaPath("");
    },
    onError: (error) => {
      toast({
        title: "Gagal Mengirim Blast",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat mengirim blast",
        variant: "destructive",
      });
    },
  });

  // Mutation untuk mengirim blast JSON manual
  const sendJsonBlastMutation = useMutation({
    mutationFn: async (data: JsonBlastForm): Promise<any> => {
      const response = await apiRequest("POST", "/api/incident-blast/send-json", data);
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Blast JSON Berhasil",
        description: `Response: ${result.message || 'Success'}`,
      });
      
      jsonForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Gagal Mengirim Blast JSON",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat mengirim blast",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/incident-blast/test-connection"),
    onSuccess: (data: any) => {
      setConnectionStatus(data);
      toast({
        title: data.success ? "Koneksi Berhasil" : "Koneksi Gagal",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Test koneksi gagal";
      setConnectionStatus({
        success: false,
        message: errorMessage
      });
      toast({
        title: "Test Gagal",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: IncidentForm) => {
    if (employees.length === 0) {
      toast({
        title: "Tidak Ada Data Karyawan",
        description: "Tidak ada karyawan yang ditemukan untuk dikirim notifikasi",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setSendingProgress(0);

    try {
      // Simulasi progress
      const progressInterval = setInterval(() => {
        setSendingProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      await sendBlastMutation.mutateAsync({
        ...data,
        mediaPath: uploadedMediaPath,
        provider: selectedProvider,
      });

      clearInterval(progressInterval);
      setSendingProgress(100);
    } catch (error) {
      // Error handling sudah ditangani oleh mutation
    } finally {
      setIsSending(false);
      setSendingProgress(0);
    }
  };

  // Handle media upload
  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload");
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      throw new Error("Gagal mendapatkan URL upload");
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const uploadURL = uploadedFile.uploadURL as string;
      
      setIsUploading(true);
      
      try {
        // Set ACL untuk media incident
        const response = await apiRequest("PUT", "/api/incident-media", { 
          mediaURL: uploadURL 
        });
        const data = await response.json();
        
        setUploadedMediaPath(data.objectPath);
        
        toast({
          title: "Foto Berhasil Diupload",
          description: "Foto sudah siap. Isi form dan klik 'Kirim Blast' untuk mengirim notifikasi.",
        });
      } catch (error) {
        toast({
          title: "Gagal Menyimpan Foto",
          description: "Foto berhasil diupload tapi gagal disimpan. Coba lagi.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const downloadReport = (report: BlastReport) => {
    const csvContent = [
      "Nama Karyawan,Nomor WhatsApp,Status,Waktu Terkirim,Error Message",
      ...report.results.map(result => 
        `"${result.employeeName}","${result.phoneNumber}","${result.status}","${result.sentAt || ''}","${result.errorMessage || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `incident-blast-report-${report.id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Report Downloaded",
      description: "Laporan blast berhasil didownload sebagai CSV",
    });
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            Blast WhatsApp Insiden
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sistem notifikasi darurat untuk seluruh karyawan via WhatsApp menggunakan Notif.my.id
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Users className="h-4 w-4" />
          <span>{employees.length} Karyawan Terdaftar</span>
        </div>
      </div>

      {/* Provider Info */}
      <Alert className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-sm text-green-700 dark:text-green-300">
          <strong>✅ Notif.my.id API v2 - Siap Digunakan</strong><br/>
          API endpoint v2 dikonfigurasi dengan format yang benar. Sistem siap mengirim pesan blast ke {employees.length} karyawan.
        </AlertDescription>
      </Alert>

      {/* Mode Toggle */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant={inputMode === 'form' ? 'default' : 'outline'}
              onClick={() => setInputMode('form')}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Form Mode
            </Button>
            <Button
              variant={inputMode === 'json' ? 'default' : 'outline'}
              onClick={() => setInputMode('json')}
              className="flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              JSON Manual Mode
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form Incident atau JSON Manual */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-red-600" />
              {inputMode === 'form' ? 'Form Notifikasi Insiden' : 'JSON Manual Blast'}
            </CardTitle>
            <CardDescription>
              {inputMode === 'form' 
                ? 'Isi detail insiden yang akan dikirim ke seluruh karyawan'
                : 'Input manual dalam format JSON sesuai API notif.my.id'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inputMode === 'form' ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="incidentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Jenis Insiden *</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-incident-type">
                              <SelectValue placeholder="Pilih jenis insiden" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kebakaran">🔥 Kebakaran</SelectItem>
                              <SelectItem value="gempa">🌍 Gempa Bumi</SelectItem>
                              <SelectItem value="banjir">🌊 Banjir</SelectItem>
                              <SelectItem value="kecelakaan-kerja">⚠️ Kecelakaan Kerja</SelectItem>
                              <SelectItem value="gangguan-keamanan">🚨 Gangguan Keamanan</SelectItem>
                              <SelectItem value="pemadaman-listrik">⚡ Pemadaman Listrik</SelectItem>
                              <SelectItem value="sistem-down">💻 Sistem Down</SelectItem>
                              <SelectItem value="lainnya">📋 Lainnya</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Lokasi Kejadian *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Contoh: Gedung A Lantai 3"
                            className="h-9"
                            data-testid="input-location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Deskripsi Singkat *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Jelaskan secara singkat apa yang terjadi..."
                          rows={3}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Status Terkini *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Contoh: Situasi terkendali, tim emergency response sudah di lokasi"
                          rows={2}
                          data-testid="textarea-status"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Instruksi untuk Karyawan *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Contoh: Harap tetap tenang dan ikuti prosedur evakuasi yang sudah ditetapkan"
                          rows={2}
                          data-testid="textarea-instructions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Media Upload */}
                <div className="space-y-3">
                  <Label className="text-sm">Foto Insiden (Opsional)</Label>
                  
                  {/* Show current uploaded photo preview */}
                  {uploadedMediaPath && (
                    <div className="relative border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center">
                            <Image className="h-8 w-8 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                              Foto berhasil diupload
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                              ✅ Foto akan disertakan saat Anda klik "Kirim Blast"
                            </p>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-green-600 hover:text-green-700"
                              onClick={() => window.open(uploadedMediaPath!, '_blank')}
                            >
                              Lihat foto
                            </Button>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadedMediaPath('');
                            toast({
                              title: "Foto dihapus",
                              description: "Foto telah dihapus dari form",
                            });
                          }}
                          className="h-8 w-8 p-0 text-green-600 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Upload button */}
                  {!uploadedMediaPath && (
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880} // 5MB
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="w-full h-32 border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                        {isUploading ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="font-medium">Mengupload foto...</p>
                            <p className="text-xs">Jangan tutup halaman ini</p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8" />
                            <div className="text-center">
                              <p className="font-medium">Upload Foto Insiden (Opsional)</p>
                              <p className="text-xs">JPG, PNG, atau GIF (maksimal 5MB)</p>
                              <p className="text-xs text-blue-600 font-medium">📋 Hanya upload foto, tidak akan auto-blast</p>
                            </div>
                          </>
                        )}
                      </div>
                    </ObjectUploader>
                  )}
                  
                  {/* Replace existing photo button */}
                  {uploadedMediaPath && (
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Ganti Foto
                    </ObjectUploader>
                  )}
                </div>

                {isSending && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Mengirim notifikasi ke {employees.length} karyawan...</span>
                      <span>{sendingProgress}%</span>
                    </div>
                    <Progress value={sendingProgress} className="w-full" />
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSending || sendBlastMutation.isPending || loadingEmployees || isUploading}
                  className="w-full bg-red-600 hover:bg-red-700"
                  data-testid="button-send-blast"
                >
                  {isSending || sendBlastMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Mengirim Blast...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Kirim via Notif.my.id ke {employees.length} Karyawan
                    </>
                  )}
                </Button>
              </form>
            </Form>
            ) : (
              // JSON Manual Mode
              <Form {...jsonForm}>
                <form onSubmit={jsonForm.handleSubmit((data) => sendJsonBlastMutation.mutate(data))} className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                    <h4 className="font-medium text-sm mb-2">Format JSON API notif.my.id:</h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded">
{`{
  "apikey": "U7tu87RGNgXcvdpgqNDXuGYEI6u9j8wh1719260547002",
  "receiver": "6281234567890@c.us",
  "mtype": "text",
  "text": "Pesan untuk satu karyawan",
  "url": "https://example.com/image.jpg" (optional)
}`}
                    </pre>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      💡 Gunakan dropdown "Pilih karyawan" untuk auto-fill nomor WhatsApp dari data karyawan
                    </div>
                    
                    {/* Preview karyawan yang tersedia */}
                    <details className="text-xs mt-2">
                      <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                        📋 Lihat {employees.length} Karyawan Tersedia
                      </summary>
                      <div className="max-h-32 overflow-y-auto mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                        {employees.length === 0 ? (
                          <p className="text-gray-500">Tidak ada data karyawan</p>
                        ) : (
                          employees.map((emp, index) => (
                            <div key={emp.id} className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-600 last:border-0">
                              <span className="font-medium">{index + 1}. {emp.name}</span>
                              <span className="text-gray-600 dark:text-gray-400">{emp.phone}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </details>
                  </div>

                  <FormField
                    control={jsonForm.control}
                    name="apikey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Masukkan API key notif.my.id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jsonForm.control}
                    name="receiver"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receiver *</FormLabel>
                        <div className="space-y-2">
                          {/* Auto-populate dari data karyawan */}
                          <Select onValueChange={(value) => {
                            if (value === "manual") {
                              field.onChange("");
                              return;
                            }
                            if (value === "all") {
                              field.onChange("ALL_EMPLOYEES_BLAST");
                              return;
                            }
                            const employee = employees.find(emp => emp.id === value);
                            if (employee) {
                              // Format nomor WhatsApp untuk receiver
                              let phoneNumber = employee.phone.replace(/\D/g, '');
                              if (phoneNumber.startsWith('0')) {
                                phoneNumber = '62' + phoneNumber.substring(1);
                              }
                              if (!phoneNumber.startsWith('62')) {
                                phoneNumber = '62' + phoneNumber;
                              }
                              field.onChange(phoneNumber + '@c.us');
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih karyawan atau input manual" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">📝 Input Manual</SelectItem>
                              <SelectItem value="all">🗂️ Semua Karyawan (Blast)</SelectItem>
                              {employees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                  👤 {emp.name} - {emp.phone}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="contoh: 120363043283436111@g.us atau 6281234567890@c.us" 
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jsonForm.control}
                    name="mtype"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message Type *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih tipe pesan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jsonForm.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Text Message *</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Masukkan pesan text" rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jsonForm.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL (Opsional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="URL gambar atau file (untuk mtype: image)" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={sendJsonBlastMutation.isPending}
                    className="w-full"
                  >
                    {sendJsonBlastMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Kirim JSON Blast
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        {/* Dashboard Evaluasi */}
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Karyawan</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {employees.length}
                  </p>
                </div>
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Blast</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {blastHistory.length}
                  </p>
                </div>
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
            </Card>
          </div>

          {/* Test Connection */}
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Status Koneksi API
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                  className="h-8 px-3"
                >
                  {testConnectionMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Wifi className="h-3 w-3 mr-1" />
                      Test API
                    </>
                  )}
                </Button>
              </div>
              {connectionStatus && (
                <div className={`p-3 rounded-md text-sm border ${
                  connectionStatus.success 
                    ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800' 
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {connectionStatus.success ? (
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <X className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{connectionStatus.message}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Performance Chart */}
          {blastHistory.length > 0 && (
            <Card className="p-3">
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Performance Terakhir
                </h3>
                {(() => {
                  const totalSent = blastHistory.reduce((sum, blast) => sum + blast.successCount, 0);
                  const totalFailed = blastHistory.reduce((sum, blast) => sum + blast.failedCount, 0);
                  const successRate = totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed) * 100) : 0;
                  
                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <p className="font-medium text-green-700 dark:text-green-300">{totalSent}</p>
                          <p className="text-green-600 dark:text-green-400">Terkirim</p>
                        </div>
                        <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <p className="font-medium text-red-700 dark:text-red-300">{totalFailed}</p>
                          <p className="text-red-600 dark:text-red-400">Gagal</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium">
                          Success Rate: {successRate.toFixed(1)}%
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${successRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>
          )}

          {/* Recent Activity */}
          <Card className="p-3">
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Aktivitas Terbaru
              </h3>
              {blastHistory.length === 0 ? (
                <p className="text-xs text-gray-500">Belum ada aktivitas</p>
              ) : (
                <div className="space-y-2">
                  {blastHistory.slice(0, 3).map((blast) => (
                    <div key={blast.id} className="text-xs border rounded p-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{blast.incidentType}</p>
                          <p className="text-gray-500 truncate">{blast.location}</p>
                        </div>
                        <Badge variant={blast.successCount > blast.failedCount ? "default" : "destructive"} className="text-xs">
                          {blast.successCount}/{blast.successCount + blast.failedCount}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* History Section */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-red-600" />
              Riwayat Blast
            </CardTitle>
            <CardDescription>
              History pengiriman notifikasi insiden. Sistem terhubung dengan Notif.my.id untuk WhatsApp blast.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : blastHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Belum ada riwayat blast</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {blastHistory.map((blast) => (
                  <div key={blast.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{blast.incidentType}</h4>
                        <p className="text-xs text-gray-500">{blast.location}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadReport(blast)}
                          className="h-6 w-6 p-0"
                          data-testid={`download-report-${blast.id}`}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <div className="text-sm font-bold text-green-600 dark:text-green-400">
                          {blast.successCount}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Berhasil
                        </div>
                      </div>
                      <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                        <div className="text-sm font-bold text-red-600 dark:text-red-400">
                          {blast.failedCount}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">
                          Gagal
                        </div>
                      </div>
                    </div>
                    
                    {/* Pesan khusus untuk gagal kirim */}
                    {blast.failedCount > 0 && blast.successCount === 0 && blast.failedCount >= 200 && (
                      <Alert className="mb-2 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-xs text-orange-700 dark:text-orange-300">
                          <strong>⚠️ Sebagian pesan gagal terkirim</strong><br/>
                          Kemungkinan penyebab utama:<br/>
                          • Nomor WhatsApp karyawan tidak terdaftar atau salah<br/>
                          • Format nomor tidak sesuai standar Indonesia<br/>
                          • Nomor karyawan tidak aktif di WhatsApp<br/>
                          <strong>Solusi:</strong> Verifikasi dan update data nomor WhatsApp karyawan
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="text-xs text-gray-500">
                      {format(new Date(blast.createdAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last Blast Result Dialog */}
      {showReport && lastBlastResult && (
        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Laporan Blast WhatsApp
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {lastBlastResult.successCount}
                    </div>
                    <p className="text-sm text-green-600">Berhasil Terkirim</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {lastBlastResult.failedCount}
                    </div>
                    <p className="text-sm text-red-600">Gagal Terkirim</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Detail Pengiriman:</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {lastBlastResult.results.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        {result.status === 'terkirim' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm font-medium">{result.employeeName}</span>
                        <span className="text-xs text-gray-500">({result.phoneNumber})</span>
                      </div>
                      <Badge variant={result.status === 'terkirim' ? 'default' : 'destructive'}>
                        {result.status === 'terkirim' ? 'Terkirim' : 'Gagal'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadReport(lastBlastResult)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
                <Button
                  onClick={() => setShowReport(false)}
                  className="flex-1"
                >
                  Tutup
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}