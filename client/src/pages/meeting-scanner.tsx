import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, CameraOff, UserCheck, AlertCircle, CheckCircle, User, Calendar, Clock, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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
                try {
                  const qrData = JSON.parse(code.data);
                  if (qrData.type === "meeting" && qrData.token && employeeId) {
                    // Stop scanning when QR code is detected
                    stopCamera();
                    
                    // Show loading state
                    toast({
                      title: "QR Code Detected",
                      description: "Memproses absensi meeting...",
                    });
                    
                    attendanceMutation.mutate({
                      qrToken: qrData.token,
                      employeeId: employeeId
                    });
                    return;
                  }
                } catch (parseError) {
                  // Invalid QR code format, continue scanning
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

        {/* Form Absensi */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Form Absensi
            </CardTitle>
            <CardDescription>
              {meetingToken ? "Isi NIK Anda untuk mencatat kehadiran" : "Masukkan NIK karyawan untuk melakukan absensi meeting"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Camera View */}
        {isScanning && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Kamera QR Scanner
              </CardTitle>
              <CardDescription>
                Arahkan kamera ke QR code meeting
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}