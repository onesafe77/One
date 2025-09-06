import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateQRData } from "@/lib/crypto-utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { determineShiftByTime, getCurrentShift } from "@/lib/shift-utils";
import { Camera, CameraOff, CheckCircle, User, Clock, XCircle, Moon, Heart, Activity, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import jsQR from "jsqr";

interface ScanResult {
  employeeId: string;
  name: string;
  nomorLambung?: string;
  scanTime: string;
  status?: 'validated' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}

interface AttendanceFormData {
  jamTidur: string;
  fitToWork: string;
}

interface RecentActivity {
  id: string;
  employeeId: string;
  employeeName: string;
  time: string;
  jamTidur: string;
  fitToWork: string;
  status: string;
  createdAt: string;
  workingDays: number;
}


export function QRScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormData>({
    jamTidur: '',
    fitToWork: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const { toast } = useToast();

  // Query untuk mengambil aktivitas terbaru
  const today = new Date().toISOString().split('T')[0];
  const { data: recentActivities, refetch: refetchActivities } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/recent-activities", today],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/recent-activities?date=${today}`, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Auto-refresh setiap 30 detik
  });

  // Listen untuk perubahan roster data dan clear scan result jika ada
  useEffect(() => {
    const handleRosterChange = () => {
      if (scanResult) {
        setScanResult(null);
        toast({
          title: "Data Roster Berubah",
          description: "Silakan scan QR code lagi untuk mendapatkan data roster terbaru",
          variant: "default",
        });
      }
    };

    // Subscribe to roster query changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && 
          event.query.queryKey[0] === '/api/roster' &&
          scanResult) {
        handleRosterChange();
      }
    });

    return () => unsubscribe();
  }, [scanResult, toast]);


  const startScanning = async () => {
    try {
      // Reset states for fresh start
      setIsProcessing(false);
      setLastScanTime(0);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      setIsScanning(true);
      scanningRef.current = true;
      setScanResult(null);
      setAttendanceForm({ jamTidur: '', fitToWork: '' });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        // Start scanning after video is ready
        videoRef.current.onloadedmetadata = () => {
          console.log("Camera ready, starting QR detection...");
          requestAnimationFrame(scanQRCode);
        };
      }
    } catch (error) {
      console.error("Camera error:", error);
      toast({
        title: "Error Kamera",
        description: "Gagal mengakses kamera. Pastikan browser memiliki izin kamera dan reload halaman.",
        variant: "destructive",
      });
    }
  };

  const stopScanning = () => {
    scanningRef.current = false;
    setIsScanning(false);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const scanQRCode = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      if (scanningRef.current) {
        requestAnimationFrame(scanQRCode); // Only continue if still scanning
      }
      return;
    }

    // Optimize canvas size for faster processing
    const maxWidth = 480; // Reduced for faster processing
    const maxHeight = 360;
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    
    let canvasWidth = Math.min(video.videoWidth, maxWidth);
    let canvasHeight = canvasWidth / videoAspectRatio;
    
    if (canvasHeight > maxHeight) {
      canvasHeight = maxHeight;
      canvasWidth = canvasHeight * videoAspectRatio;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    context.drawImage(video, 0, 0, canvasWidth, canvasHeight);
    
    const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert", // Skip inversion for faster processing
    });
    
    if (code) {
      // Debounce QR code detection to prevent multiple scans (reduced to 500ms)
      const now = Date.now();
      if (now - lastScanTime < 500) { // 500ms cooldown for responsiveness
        requestAnimationFrame(scanQRCode);
        return;
      }
      setLastScanTime(now);
      
      console.log("Raw QR Code data detected:", code.data);
      const qrData = validateQRData(code.data);
      console.log("Validated QR Data:", qrData);
      if (qrData) {
        // Deteksi apakah diakses dari mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        
        if (isMobile) {
          // Jika mobile, redirect ke mobile driver view
          stopScanning();
          window.location.href = `/mobile-driver?nik=${qrData.id}`;
          return;
        } else {
          // Jika desktop, lanjutkan proses normal
          validateAndProcess(qrData.id, qrData.token);
          return;
        }
      } else {
        console.log("QR validation failed for data:", code.data);
        // Don't show toast for every invalid scan, just continue scanning
        // Only show once every 3 seconds to avoid spam
        const lastToastTime = localStorage.getItem('lastInvalidQRToast');
        if (!lastToastTime || now - parseInt(lastToastTime) > 3000) {
          toast({
            title: "QR Code Tidak Valid",
            description: "❌ Pastikan QR Code dari sistem resmi",
            variant: "destructive",
          });
          localStorage.setItem('lastInvalidQRToast', now.toString());
        }
      }
    }
    
    // Continue scanning if still active
    if (scanningRef.current && !isProcessing) {
      requestAnimationFrame(scanQRCode);
    }
  }, [toast]);

  const validateAndProcess = async (employeeId: string, token: string) => {
    // Prevent multiple simultaneous validations
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      const result = await apiRequest("/api/qr/validate", "POST", {
        employeeId,
        token
      });
      
      if (result.valid) {
        const currentTime = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Always display roster time and shift if available
        let displayTime;
        if (result.roster) {
          displayTime = `${result.roster.startTime} - ${result.roster.endTime} (${result.roster.shift})`;
        } else {
          // Fallback to current time with detected shift
          const shift = determineShiftByTime(currentTime);
          displayTime = `${currentTime} (${shift})`;
        }
        
        const employeeData = {
          employeeId: result.employee.id,
          name: result.employee.name,
          nomorLambung: result.employee.nomorLambung,
          scanTime: displayTime,
          roster: result.roster,
          status: 'processing' as const
        };
        
        setScanResult({ ...employeeData, status: 'validated' });
        stopScanning(); // Stop scanning after successful validation
        
        // Show time validation warning if any
        if (result.timeValidation?.warning) {
          toast({
            title: "QR Code Valid - Peringatan Waktu",
            description: result.timeValidation.warning,
            variant: "destructive",
          });
        } else if (result.roster) {
          toast({
            title: "QR Code Valid",
            description: `✅ QR Code valid untuk ${result.employee.name}. Shift: ${result.roster.shift}. Silakan isi data absensi.`,
          });
        } else {
          toast({
            title: "QR Code Valid - Peringatan",
            description: `⚠️ QR Code valid untuk ${result.employee.name}, tetapi tidak ada roster hari ini. Silakan hubungi admin.`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Validasi Gagal",
        description: "❌ QR Code tidak valid atau karyawan tidak terdaftar",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processAttendance = async () => {
    if (!scanResult || !attendanceForm.jamTidur || !attendanceForm.fitToWork) {
      toast({
        title: "Data Tidak Lengkap",
        description: "Silakan isi jam tidur dan status fit to work",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setScanResult(prev => prev ? { ...prev, status: 'processing' } : null);
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      // Format waktu konsisten HH:MM:SS untuk database (menggunakan waktu lokal sistem)
      const currentTime = now.toTimeString().split(' ')[0]; // Menggunakan format HH:MM:SS yang konsisten

      console.log("Processing attendance for:", scanResult.name);

      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: scanResult.employeeId,
          date: today,
          time: currentTime,
          jamTidur: attendanceForm.jamTidur,
          fitToWork: attendanceForm.fitToWork,
          status: "present"
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      // Update status to success and reset processing
      setScanResult(prev => prev ? { ...prev, status: 'success' } : null);
      setIsProcessing(false); // Reset processing state immediately
      
      toast({
        title: "Absensi Berhasil",
        description: `✅ Absensi berhasil dicatat untuk ${scanResult.name}`,
      });

      // Faster cache invalidation - do it in background
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/attendance-details"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/roster"] }),
        refetchActivities() // Refresh recent activities immediately
      ]).catch(console.error); // Don't block UI for cache updates
      
      // Reset form and clear scan result after 3 seconds
      setTimeout(() => {
        setScanResult(null);
        setAttendanceForm({ jamTidur: '', fitToWork: '' });
        // Restart scanning for next QR
        if (videoRef.current && !scanningRef.current) {
          startScanning();
        }
      }, 3000);
      
    } catch (error: any) {
      console.error("Auto attendance error:", error);
      // Immediately reset processing state on error
      setIsProcessing(false);
      
      let errorMessage = "Gagal memproses absensi";
      let errorTitle = "Error";
      
      const errorMsg = error?.message || String(error);
      
      if (errorMsg) {
        const message = errorMsg.toLowerCase();
        
        if (message.includes("sudah melakukan absensi")) {
          errorTitle = "Sudah Absen Hari Ini";
          errorMessage = `${scanResult.name} sudah melakukan absensi pada hari ini`;
        } else if (message.includes("tidak dijadwalkan")) {
          errorTitle = "Tidak Dijadwalkan";
          errorMessage = `${scanResult.name} tidak dijadwalkan bekerja hari ini`;
        } else if (message.includes("tidak ditemukan")) {
          errorTitle = "Karyawan Tidak Ditemukan";
          errorMessage = `Data karyawan ${scanResult.name} tidak ditemukan`;
        } else if (message.includes("tidak sesuai dengan jadwal shift") || message.includes("absensi ditolak") || message.includes("diluar jam kerja") || message.includes("tidak sesuai shift")) {
          errorTitle = "❌ ABSENSI DITOLAK";
          errorMessage = errorMsg; // Use the full detailed message from server
        } else if (message.includes("shift yang berbeda")) {
          errorTitle = "Shift Tidak Sesuai";
          errorMessage = `Waktu check-in tidak sesuai dengan shift yang dijadwalkan untuk ${scanResult.name}`;
        } else {
          errorTitle = "Gagal Memproses";
          errorMessage = errorMsg;
        }
      }
      
      // Update status to error with message
      setScanResult(prev => prev ? { ...prev, status: 'error', errorMessage } : null);
      
      toast({
        title: errorTitle,
        description: `❌ ${errorMessage}`,
        variant: "destructive",
      });
      
      // Immediately reset processing state to unblock UI
      setIsProcessing(false);
      
      // Clear scan result after error to allow retry
      setTimeout(() => {
        setScanResult(null);
        // Resume scanning after error
        if (videoRef.current && !scanningRef.current) {
          startScanning();
        }
      }, 2000);
    }
  };



  const currentShift = getCurrentShift();
  const currentTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Camera Scanner */}
      <Card>
        <CardHeader>
          <CardTitle>Scan QR Code</CardTitle>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Waktu sekarang: {currentTime} • {currentShift}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <video 
              ref={videoRef}
              className="w-full h-64 bg-gray-100 dark:bg-gray-700 rounded-lg object-cover"
              autoPlay
              muted
              playsInline
              data-testid="scanner-video"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {isScanning && (
              <div className="absolute inset-0 border-2 border-primary-500 rounded-lg opacity-50 pointer-events-none">
                <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-primary-500"></div>
                <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-primary-500"></div>
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-primary-500"></div>
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-primary-500"></div>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button 
              onClick={startScanning} 
              disabled={isScanning || isProcessing}
              className="flex-1"
              data-testid="start-scanner-button"
            >
              <Camera className="w-4 h-4 mr-2" />
              {isScanning ? "Scanning..." : isProcessing ? "Memproses..." : "Mulai Scan"}
            </Button>
            <Button 
              onClick={stopScanning} 
              disabled={!isScanning}
              variant="destructive"
              className="flex-1"
              data-testid="stop-scanner-button"
            >
              <CameraOff className="w-4 h-4 mr-2" />
              Stop Scan
            </Button>
          </div>
          
          {isScanning && !isProcessing && (
            <div className="text-sm text-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 p-2 rounded">
              📱 Arahkan kamera ke QR Code untuk melakukan scan
              <div className="text-xs mt-1 text-blue-500">
                ⚠️ Absensi hanya diizinkan pada jam kerja: Shift 1 (06:00-16:00) • Shift 2 (16:30-20:00)
              </div>
            </div>
          )}
          
          {isProcessing && (
            <div className="text-sm text-center text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 p-2 rounded">
              ⏳ Memvalidasi QR Code...
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Scan Result */}
      <Card>
        <CardHeader>
          <CardTitle>Hasil Scan</CardTitle>
        </CardHeader>
        <CardContent>
          {!scanResult ? (
            <div className="text-center py-8" data-testid="scan-placeholder">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">Siap untuk scan QR Code</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="scan-result">
              <div className={`p-4 border rounded-lg ${
                scanResult.status === 'processing' 
                  ? 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700'
                  : scanResult.status === 'success'
                  ? 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700'
                  : scanResult.status === 'error'
                  ? 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700'
                  : 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700'
              }`}>
                <div className="flex items-center">
                  {scanResult.status === 'processing' ? (
                    <>
                      <div className="w-5 h-5 mr-2 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600"></div>
                      <span className="text-blue-800 dark:text-blue-200 font-medium">Memproses Absensi...</span>
                    </>
                  ) : scanResult.status === 'success' ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300 mr-2" />
                      <span className="text-green-800 dark:text-green-200 font-medium">Absensi Berhasil</span>
                    </>
                  ) : scanResult.status === 'error' ? (
                    <>
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-300 mr-2" />
                      <span className="text-red-800 dark:text-red-200 font-medium">Gagal Memproses</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300 mr-2" />
                      <span className="text-green-800 dark:text-green-200 font-medium">QR Code Valid</span>
                    </>
                  )}
                </div>
                {scanResult.status === 'error' && scanResult.errorMessage && (
                  <div className="mt-2">
                    <p className="text-sm text-red-600 dark:text-red-300">{scanResult.errorMessage}</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <User className="w-4 h-4 inline mr-1" />
                    ID Karyawan
                  </label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="scanned-employee-id">
                    {scanResult.employeeId}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="scanned-employee-name">
                    {scanResult.name}
                  </p>
                </div>
                
                {scanResult.nomorLambung && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nomor Lambung</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="scanned-nomor-lambung">
                      {scanResult.nomorLambung}
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Waktu & Shift
                  </label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="scan-time">
                    {scanResult.scanTime}
                  </p>
                </div>
              </div>
              
              {/* Form pengisian jam tidur dan fit to work - tampil setelah QR valid */}
              {scanResult.status === 'validated' && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Form Absensi
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Jam Tidur <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={attendanceForm.jamTidur}
                        onChange={(e) => setAttendanceForm(prev => ({ ...prev, jamTidur: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        data-testid="jam-tidur-select"
                        required
                      >
                        <option value="">Pilih jam tidur</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                        <option value="6">6</option>
                        <option value="7">7</option>
                        <option value="8">8</option>
                        <option value="8+">8+</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status Fit To Work <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={attendanceForm.fitToWork}
                        onChange={(e) => setAttendanceForm(prev => ({ ...prev, fitToWork: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        data-testid="fit-to-work-select"
                        required
                      >
                        <option value="">Pilih status</option>
                        <option value="Fit To Work">Fit To Work</option>
                        <option value="Unfit To Work">Unfit To Work</option>
                      </select>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={processAttendance}
                    disabled={!attendanceForm.jamTidur || !attendanceForm.fitToWork || isProcessing}
                    className="w-full"
                    data-testid="process-attendance-button"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Memproses...
                      </>
                    ) : (
                      'Proses Absensi'
                    )}
                  </Button>
                </div>
              )}
              
              {/* Show action buttons based on status */}
              {(scanResult.status === 'success' || scanResult.status === 'error') && (
                <Button 
                  onClick={() => {
                    setScanResult(null);
                    setAttendanceForm({ jamTidur: '', fitToWork: '' });
                  }} 
                  className="w-full"
                  variant={scanResult.status === 'error' ? 'destructive' : 'default'}
                  data-testid="scan-again-button"
                >
                  {scanResult.status === 'error' ? 'Coba Lagi' : 'Scan Lagi'}
                </Button>
              )}
              
              {scanResult.status === 'processing' && (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Sedang memproses absensi, harap tunggu...
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activities Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Aktivitas Absensi Terbaru
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities?.length === 0 ? (
            <div className="text-center py-8" data-testid="no-activities">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">Belum ada aktivitas absensi hari ini</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="recent-activities-list">
              {recentActivities?.slice(0, 5).map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border"
                  data-testid={`activity-${activity.employeeId}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {activity.employeeName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({activity.employeeId})
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 mt-1 text-xs text-gray-600 dark:text-gray-300">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {activity.time}
                      </span>
                      <span className="flex items-center">
                        <Moon className="w-3 h-3 mr-1" />
                        {activity.jamTidur} jam
                      </span>
                      <span className="flex items-center">
                        <Heart className="w-3 h-3 mr-1" />
                        {activity.fitToWork}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Hari ke-{activity.workingDays}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      activity.status === 'present' 
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                      {activity.status === 'present' ? 'Hadir' : activity.status}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(activity.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}
              
              {recentActivities && recentActivities.length > 5 && (
                <div className="text-center pt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Menampilkan 5 dari {recentActivities.length} aktivitas hari ini
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
