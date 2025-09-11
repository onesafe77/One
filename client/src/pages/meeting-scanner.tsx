import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { QrCode, Camera, CameraOff, UserCheck, AlertCircle, CheckCircle, User, Calendar, Clock, MapPin, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import jsQR from "jsqr";
import type { Meeting } from "@shared/schema";

export default function MeetingScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [meetingToken, setMeetingToken] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // Manual attendance form schema
  const manualAttendanceSchema = z.object({
    namaKaryawan: z.string().min(1, "Nama karyawan wajib diisi"),
    position: z.enum(["Investor", "Korlap"], { 
      required_error: "Position wajib dipilih" 
    }),
    department: z.string().min(1, "Department wajib dipilih"),
  });

  const manualForm = useForm<z.infer<typeof manualAttendanceSchema>>({
    resolver: zodResolver(manualAttendanceSchema),
    defaultValues: {
      namaKaryawan: "",
      position: undefined,
      department: "",
    },
  });

  // Get token from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setMeetingToken(token);
    }
  }, []);

  // Fetch meeting details if token is available
  const { data: meeting, isLoading: isLoadingMeeting } = useQuery({
    queryKey: ['/api/meetings/by-token', meetingToken],
    queryFn: () => apiRequest(`/api/meetings/by-token/${meetingToken}`, "GET"),
    enabled: !!meetingToken,
  });

  // Fetch investor groups for dropdown
  const { data: investorGroups } = useQuery({
    queryKey: ['/api/investor-groups'],
    queryFn: () => apiRequest('/api/investor-groups', 'GET'),
  });

  const attendanceMutation = useMutation({
    mutationFn: async (data: { qrToken: string; employeeId: string }) => {
      return await apiRequest("/api/meetings/qr-scan", "POST", data);
    },
    onSuccess: (data) => {
      setLastScanResult(data);
      toast({
        title: "Absensi Berhasil!",
        description: data.message,
      });
      // Reset employee ID after successful scan
      setEmployeeId("");
    },
    onError: (error: any) => {
      let errorMessage = error.message || "Gagal melakukan absensi";
      let errorTitle = "Absensi Gagal";
      
      // Handle specific meeting errors  
      if (error.message?.includes("Already attended")) {
        errorTitle = "Sudah Absen";
        errorMessage = "Anda sudah melakukan absensi untuk meeting ini sebelumnya";
      } else if (error.message?.includes("Employee not found")) {
        errorTitle = "Karyawan Tidak Ditemukan";
        errorMessage = "NIK yang dimasukkan tidak terdaftar dalam sistem";
      } else if (error.message?.includes("Meeting not found")) {
        errorTitle = "Meeting Tidak Ditemukan";
        errorMessage = "QR Code meeting tidak valid atau meeting sudah tidak aktif";
      }
      
      setLastScanResult({ error: errorMessage });
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Manual attendance mutation
  const manualAttendanceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof manualAttendanceSchema>) => {
      if (!meeting?.id) throw new Error("Meeting not found");
      return await apiRequest(`/api/meetings/${meeting.id}/manual-attendance`, "POST", {
        attendanceType: "manual_entry",
        manualName: data.namaKaryawan,
        manualPosition: data.position,
        manualDepartment: data.department,
        scanTime: new Date().toTimeString().split(' ')[0],
        scanDate: new Date().toISOString().split('T')[0],
        deviceInfo: navigator.userAgent || 'Manual Entry'
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Absensi Manual Berhasil!",
        description: `${data.manualName} (${data.manualPosition}) telah dicatat sebagai hadir`,
      });
      manualForm.reset();
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/meetings', meeting?.id, 'attendance'] });
    },
    onError: (error: any) => {
      toast({
        title: "Absensi Manual Gagal",
        description: error.message || "Terjadi kesalahan saat mencatat absensi manual",
        variant: "destructive",
      });
    },
  });

  // Handle manual form submission
  const onManualSubmit = (data: z.infer<typeof manualAttendanceSchema>) => {
    manualAttendanceMutation.mutate(data);
  };

  // Handle form submission for direct attendance
  const handleFormSubmit = () => {
    if (!employeeId.trim()) {
      toast({
        title: "NIK Diperlukan",
        description: "Silakan masukkan NIK karyawan",
        variant: "destructive",
      });
      return;
    }

    if (!meetingToken) {
      toast({
        title: "Token Meeting Tidak Ditemukan",
        description: "Silakan scan QR code meeting yang valid",
        variant: "destructive",
      });
      return;
    }

    attendanceMutation.mutate({
      qrToken: meetingToken,
      employeeId: employeeId.trim()
    });
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" } // Use back camera if available
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsScanning(true);
        
        // Start scanning process
        const scanQR = () => {
          if (videoRef.current && canvasRef.current && isScanning) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");

            if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
              canvas.height = video.videoHeight;
              canvas.width = video.videoWidth;
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);

              if (code && code.data) {
                let qrToken = null;
                
                // Try to parse as JSON first
                try {
                  const qrData = JSON.parse(code.data);
                  if (qrData.type === "meeting" && qrData.token) {
                    qrToken = qrData.token;
                  }
                } catch (parseError) {
                  // If JSON parsing fails, try to parse as URL
                  try {
                    const url = new URL(code.data);
                    
                    // Handle direct meeting scanner URLs
                    if (url.pathname.includes('/meeting-scanner')) {
                      qrToken = url.searchParams.get('token');
                    }
                    // Handle QR redirect URLs (new format)
                    else if (url.pathname.includes('/qr-redirect')) {
                      const data = url.searchParams.get('data');
                      if (data) {
                        try {
                          const decodedData = decodeURIComponent(data);
                          const redirectQrData = JSON.parse(decodedData);
                          if (redirectQrData.type === "meeting" && redirectQrData.token) {
                            qrToken = redirectQrData.token;
                          }
                        } catch (nestedParseError) {
                          console.log('Failed to parse QR redirect data:', nestedParseError);
                        }
                      }
                    }
                  } catch (urlError) {
                    // Neither JSON nor URL, continue scanning
                    console.log('QR code format not recognized:', code.data);
                  }
                }
                
                // If we found a valid meeting token and have employee ID
                if (qrToken && employeeId) {
                  // Stop scanning when QR code is detected
                  stopCamera();
                  
                  // Show loading state
                  toast({
                    title: "QR Code Detected",
                    description: "Memproses absensi meeting...",
                  });
                  
                  attendanceMutation.mutate({
                    qrToken: qrToken,
                    employeeId: employeeId
                  });
                  return;
                }
              }
            }
            
            // Continue scanning
            requestAnimationFrame(scanQR);
          }
        };
        
        // Start scanning loop
        videoRef.current.addEventListener('loadedmetadata', () => {
          scanQR();
        });
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.",
        variant: "destructive",
      });
    }
  }, [employeeId, isScanning, attendanceMutation]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const handleStartScan = () => {
    if (!employeeId.trim()) {
      toast({
        title: "NIK Required",
        description: "Masukkan NIK karyawan terlebih dahulu",
        variant: "destructive",
      });
      return;
    }
    startCamera();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <QrCode className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Absensi Meeting
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {meetingToken ? "Form absensi meeting" : "Scan QR code meeting untuk melakukan absensi"}
          </p>
          
          {meetingToken && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mt-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                ✅ QR Code Meeting terdeteksi - Silakan isi form absensi di bawah
              </p>
            </div>
          )}
        </div>

        {/* Meeting Information Card */}
        {meetingToken && meeting && !isLoadingMeeting && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Informasi Meeting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">{meeting.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>{new Date(meeting.date).toLocaleDateString('id-ID')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>{meeting.startTime} - {meeting.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span>{meeting.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>Penyelenggara: {meeting.organizer}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendance Tabs */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Form Absensi
            </CardTitle>
            <CardDescription>
              {meetingToken ? "Pilih metode absensi yang Anda inginkan" : "Scan QR code meeting atau isi form manual untuk absensi"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="qr-scan" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="qr-scan" data-testid="tab-qr-scan">
                  <QrCode className="w-4 h-4 mr-2" />
                  Scan QR Code
                </TabsTrigger>
                <TabsTrigger value="manual-entry" data-testid="tab-manual-entry" disabled={!meetingToken}>
                  <FileText className="w-4 h-4 mr-2" />
                  Entry Manual
                </TabsTrigger>
              </TabsList>

              {/* QR Code Scan Tab */}
              <TabsContent value="qr-scan" className="space-y-4">
                <div>
                  <Label htmlFor="employeeId">NIK Karyawan</Label>
                  <Input
                    id="employeeId"
                    type="text"
                    placeholder="Masukkan NIK karyawan"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={attendanceMutation.isPending}
                    data-testid="input-employee-id"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && meetingToken) {
                        handleFormSubmit();
                      }
                    }}
                  />
                </div>

                {meetingToken ? (
                  <Button
                    onClick={handleFormSubmit}
                    disabled={attendanceMutation.isPending || !employeeId.trim()}
                    className="w-full bg-green-600 hover:bg-green-700"
                    data-testid="button-submit-attendance"
                  >
                    {attendanceMutation.isPending ? (
                      <>
                        <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
                        Memproses Absensi...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Absen Sekarang
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartScan}
                    disabled={!employeeId.trim() || isScanning || attendanceMutation.isPending}
                    className="w-full bg-red-600 hover:bg-red-700"
                    data-testid="button-start-scan"
                  >
                    {isScanning ? (
                      <>
                        <CameraOff className="w-4 h-4 mr-2" />
                        Sedang Scanning...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Mulai Scan QR Code
                      </>
                    )}
                  </Button>
                )}

                {/* Camera View */}
                {isScanning && (
                  <div className="mt-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                        <Camera className="w-5 h-5" />
                        Kamera QR Scanner
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Arahkan kamera ke QR code meeting
                      </p>
                    </div>
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg"
                        data-testid="video-scanner"
                      />
                      <canvas
                        ref={canvasRef}
                        className="hidden"
                      />
                      
                      {/* Scanning overlay */}
                      <div className="absolute inset-0 border-2 border-red-500 rounded-lg pointer-events-none">
                        <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-red-500"></div>
                        <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-red-500"></div>
                        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-red-500"></div>
                        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-red-500"></div>
                      </div>
                      
                      <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded text-center">
                        Memindai QR code meeting...
                      </div>
                    </div>
                    <Button
                      onClick={stopCamera}
                      variant="outline"
                      className="w-full mt-4"
                      data-testid="button-stop-scan"
                    >
                      <CameraOff className="w-4 h-4 mr-2" />
                      Hentikan Scanner
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Manual Entry Tab */}
              <TabsContent value="manual-entry" className="space-y-4">
                {!meetingToken ? (
                  <div className="text-center p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
                    <p className="text-yellow-800 dark:text-yellow-200">
                      Silakan scan QR code meeting terlebih dahulu untuk mengaktifkan entry manual
                    </p>
                  </div>
                ) : (
                  <Form {...manualForm}>
                    <form onSubmit={manualForm.handleSubmit(onManualSubmit)} className="space-y-4">
                      {/* Current Date and Time Display */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-blue-800 dark:text-blue-200">Tanggal:</span>
                            <div className="text-blue-700 dark:text-blue-300">
                              {new Date().toLocaleDateString('id-ID', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-blue-800 dark:text-blue-200">Waktu:</span>
                            <div className="text-blue-700 dark:text-blue-300">
                              {new Date().toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Nama Karyawan */}
                      <FormField
                        control={manualForm.control}
                        name="namaKaryawan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nama Karyawan</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Masukkan nama lengkap karyawan"
                                data-testid="input-manual-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Position */}
                      <FormField
                        control={manualForm.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Posisi</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col space-y-2"
                                data-testid="radio-manual-position"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Investor" id="investor" />
                                  <Label htmlFor="investor">Investor</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Korlap" id="korlap" />
                                  <Label htmlFor="korlap">Korlap</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Department */}
                      <FormField
                        control={manualForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-manual-department">
                                  <SelectValue placeholder="Pilih department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {investorGroups?.investorGroups?.map((group: string) => (
                                  <SelectItem key={group} value={group}>
                                    {group}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={manualAttendanceMutation.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        data-testid="button-submit-manual"
                      >
                        {manualAttendanceMutation.isPending ? (
                          <>
                            <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
                            Memproses Entry Manual...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Simpan Absensi Manual
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Scan Result */}
        {lastScanResult && (
          <Card className={`mb-6 ${lastScanResult.error ? 'border-red-200' : 'border-green-200'}`}>
            <CardHeader>
              <CardTitle className={`text-lg flex items-center gap-2 ${lastScanResult.error ? 'text-red-600' : 'text-green-600'}`}>
                {lastScanResult.error ? (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    Absensi Gagal
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Absensi Berhasil
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lastScanResult.error ? (
                <div className="text-red-600 text-sm">
                  {lastScanResult.error}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-green-600 font-medium">
                    {lastScanResult.message}
                  </div>
                  
                  {lastScanResult.meeting && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div><strong>Meeting:</strong> {lastScanResult.meeting.title}</div>
                      <div><strong>Tanggal:</strong> {new Date(lastScanResult.meeting.date).toLocaleDateString('id-ID')}</div>
                      <div><strong>Waktu:</strong> {lastScanResult.meeting.startTime} - {lastScanResult.meeting.endTime}</div>
                      <div><strong>Lokasi:</strong> {lastScanResult.meeting.location}</div>
                    </div>
                  )}
                  
                  {lastScanResult.employee && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t space-y-1">
                      <div><strong>Nama:</strong> {lastScanResult.employee.name}</div>
                      <div><strong>NIK:</strong> {lastScanResult.employee.id}</div>
                      <div><strong>Posisi:</strong> {lastScanResult.employee.position || '-'}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cara Penggunaan</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="qr-instructions" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="qr-instructions" className="text-xs">
                  <QrCode className="w-3 h-3 mr-1" />
                  Scan QR
                </TabsTrigger>
                <TabsTrigger value="manual-instructions" className="text-xs">
                  <FileText className="w-3 h-3 mr-1" />
                  Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qr-instructions">
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>Masukkan NIK karyawan pada form di atas</div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>Tekan tombol "Mulai Scan QR Code" untuk mengaktifkan kamera</div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div>Arahkan kamera ke QR code meeting yang telah disediakan</div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div>Tunggu hingga sistem berhasil memindai dan memproses absensi</div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual-instructions">
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>Pastikan QR code meeting telah discan terlebih dahulu</div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>Pilih tab "Entry Manual" untuk mengakses form manual</div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div>Isi nama karyawan, pilih posisi (Investor/Korlap), dan pilih department</div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div>Tekan "Simpan Absensi Manual" untuk mencatat kehadiran</div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      <strong>Catatan:</strong> Entry manual hanya dapat digunakan setelah QR code meeting berhasil discan dan untuk peserta yang tidak memiliki NIK terdaftar dalam sistem.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}