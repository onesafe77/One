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
  Download
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// Schema untuk incident notification
const incidentSchema = z.object({
  incidentType: z.string().min(1, "Jenis insiden harus diisi"),
  location: z.string().min(1, "Lokasi kejadian harus diisi"),
  description: z.string().min(1, "Deskripsi harus diisi"),
  currentStatus: z.string().min(1, "Status terkini harus diisi"),
  instructions: z.string().min(1, "Instruksi untuk karyawan harus diisi"),
  mediaPath: z.string().optional(),
  provider: z.enum(['twilio', 'notif']).optional(),
});

type IncidentForm = z.infer<typeof incidentSchema>;

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
  const [selectedProvider, setSelectedProvider] = useState<'twilio' | 'notif'>('twilio');
  const { toast } = useToast();

  // Query untuk mengambil data karyawan
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Query untuk blast history
  const { data: blastHistory = [], isLoading: loadingHistory } = useQuery<BlastReport[]>({
    queryKey: ["/api/incident-blast/history"],
    refetchInterval: 30000,
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

  // Mutation untuk mengirim blast WhatsApp
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
      
      try {
        // Set ACL untuk media incident
        const response = await apiRequest("PUT", "/api/incident-media", { 
          mediaURL: uploadURL 
        });
        const data = await response.json();
        
        setUploadedMediaPath(data.objectPath);
        
        toast({
          title: "Media Berhasil Diupload",
          description: "Foto insiden siap untuk disertakan dalam notifikasi",
        });
      } catch (error) {
        toast({
          title: "Gagal Menyimpan Media",
          description: "Media berhasil diupload tapi gagal disimpan",
          variant: "destructive",
        });
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
            Sistem notifikasi darurat untuk seluruh karyawan via WhatsApp menggunakan Twilio
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Users className="h-4 w-4" />
          <span>{employees.length} Karyawan Terdaftar</span>
        </div>
      </div>

      {/* Provider Selection */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Pilih Provider WhatsApp</CardTitle>
          <CardDescription>
            Pilih layanan WhatsApp yang akan digunakan untuk mengirim notifikasi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedProvider === 'twilio' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedProvider('twilio')}
              data-testid="provider-twilio"
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedProvider === 'twilio' 
                    ? 'border-blue-500 bg-blue-500' 
                    : 'border-gray-300'
                }`} />
                <div>
                  <h3 className="font-semibold text-sm">Twilio</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Provider internasional, trial limit 9 pesan/hari
                  </p>
                </div>
              </div>
            </div>
            
            <div 
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedProvider === 'notif' 
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedProvider('notif')}
              data-testid="provider-notif"
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedProvider === 'notif' 
                    ? 'border-green-500 bg-green-500' 
                    : 'border-gray-300'
                }`} />
                <div>
                  <h3 className="font-semibold text-sm">Notif.my.id</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Provider lokal Indonesia, lebih stabil untuk volume besar
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Provider Info */}
          {selectedProvider === 'twilio' && (
            <Alert className="mt-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Info Twilio:</strong> Akun trial memiliki batas 9 pesan WhatsApp per hari. 
                Upgrade ke akun berbayar untuk penggunaan tanpa batas.
              </AlertDescription>
            </Alert>
          )}
          
          {selectedProvider === 'notif' && (
            <Alert className="mt-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <AlertTriangle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                <strong>Info Notif.my.id:</strong> Pastikan API key sudah dikonfigurasi dengan benar di environment variables (NOTIF_API_KEY).
                Provider ini mendukung pengiriman volume besar tanpa batas harian.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form Incident */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-red-600" />
              Form Notifikasi Insiden
            </CardTitle>
            <CardDescription>
              Isi detail insiden yang akan dikirim ke seluruh karyawan
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <div className="space-y-2">
                  <Label className="text-sm">Foto Insiden (Opsional)</Label>
                  <div className="flex items-center gap-4">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880} // 5MB
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="h-9"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {uploadedMediaPath ? "Ganti Foto" : "Upload Foto"}
                    </ObjectUploader>
                    
                    {uploadedMediaPath && (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Foto Terupload
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Format: JPG, PNG. Maksimal 5MB
                  </p>
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
                  disabled={isSending || sendBlastMutation.isPending || loadingEmployees}
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
                      Kirim via {selectedProvider === 'twilio' ? 'Twilio' : 'Notif.my.id'} ke {employees.length} Karyawan
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Blast History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-red-600" />
              Riwayat Blast
            </CardTitle>
            <CardDescription>
              History pengiriman notifikasi insiden. Sistem terhubung dengan Twilio untuk WhatsApp blast.
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
                    
                    {/* Pesan khusus untuk batas harian Twilio */}
                    {blast.failedCount > 0 && blast.successCount === 0 && blast.failedCount >= 200 && (
                      <Alert className="mb-2 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-xs text-orange-700 dark:text-orange-300">
                          <strong>Batas harian Twilio tercapai.</strong> Sistem berfungsi normal, namun akun Twilio trial memiliki batas 9 pesan per hari. 
                          Upgrade ke akun Twilio berbayar untuk mengirim pesan tanpa batas.
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