import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateQRData, isMobileDevice } from "@/lib/crypto-utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { determineShiftByTime, getCurrentShift } from "@/lib/shift-utils";
import { Camera, CameraOff, CheckCircle, User, Clock, XCircle, Moon, Heart, Activity, Calendar, ScanLine, Zap, Shield, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import jsQR from "jsqr";

interface ScanResult {
  employeeId: string;
  name: string;
  nomorLambung?: string;
  isSpareOrigin?: boolean;
  scanTime: string;
  status?: 'validated' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}

interface AttendanceFormData {
  jamTidur: string;
  fitToWork: string;
  nomorLambung?: string;
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
    fitToWork: '',
    nomorLambung: ''
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
      setAttendanceForm({ jamTidur: '', fitToWork: '', nomorLambung: '' });
      
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
      inversionAttempts: "attemptBoth", // Try both modes for better detection
    });
    
    if (code) {
      // Debounce QR code detection to prevent multiple scans (reduced to 500ms)
      const now = Date.now();
      if (now - lastScanTime < 500) { // 500ms cooldown for responsiveness
        requestAnimationFrame(scanQRCode);
        return;
      }
      setLastScanTime(now);
      
      // Check for empty or whitespace data
      if (!code.data || code.data.trim() === '') {
        requestAnimationFrame(scanQRCode);
        return;
      }
      
      // Special handling for direct URLs (user's request)
      if (code.data.includes('workspace/driver-view?nik=') || code.data.includes('workspace/mobile-driver?nik=')) {
        const nikMatch = code.data.match(/[?&]nik=([^&]+)/);
        if (nikMatch && nikMatch[1]) {
          const nik = decodeURIComponent(nikMatch[1]);
          const isOnMobile = isMobileDevice();
          
          if (isOnMobile) {
            window.location.href = `/workspace/mobile-driver?nik=${nik}`;
          } else {
            window.location.href = `/workspace/driver-view?nik=${nik}`;
          }
          return;
        }
      }
      
      // Continue with traditional QR validation for JSON format
      const qrData = validateQRData(code.data);
      if (qrData) {
        // Stop scanning first
        stopScanning();
        
        // Check if we're on mobile device first
        const isOnMobile = isMobileDevice();
        
        // Handle direct URL format (contains mobile-driver or driver-view)
        if (qrData.token === 'direct') {
          // For direct URLs, check if it's already a mobile or desktop URL (both legacy and workspace patterns)
          if (code.data.includes('/mobile-driver?') || code.data.includes('/workspace/mobile-driver?')) {
            // QR contains mobile URL, but redirect based on current device for better UX
            const nikMatch = code.data.match(/[?&]nik=([^&]+)/);
            if (nikMatch && nikMatch[1]) {
              const nik = decodeURIComponent(nikMatch[1]);
              if (isOnMobile) {
                window.location.href = `/workspace/mobile-driver?nik=${nik}`;
              } else {
                window.location.href = `/workspace/driver-view?nik=${nik}`;
              }
              return;
            }
          } else if (code.data.includes('/driver-view?') || code.data.includes('/workspace/driver-view?')) {
            // QR contains desktop URL, redirect based on device
            if (isOnMobile) {
              window.location.href = `/workspace/mobile-driver?nik=${qrData.id}`;
            } else {
              window.location.href = `/workspace/driver-view?nik=${qrData.id}`;
            }
            return;
          } else {
            // Safety fallback for unrecognized direct URLs - redirect based on device
            if (isOnMobile) {
              window.location.href = `/workspace/mobile-driver?nik=${qrData.id}`;
            } else {
              window.location.href = `/workspace/driver-view?nik=${qrData.id}`;
            }
            return;
          }
        }
        
        // Handle compact URL format (redirect directly) - legacy
        if (qrData.id === 'compact') {
          // For compact URLs, redirect to the server endpoint which will handle device detection
          window.location.href = `/q/${qrData.token}`;
          return;
        }
        
        // Handle traditional JSON format
        // On mobile: redirect to driver view automatically (user request)
        // On desktop: continue with attendance system
        if (isOnMobile) {
          toast({
            title: "🔄 Redirect ke Driver View",
            description: `Membuka data untuk ${qrData.id}...`,
          });
          
          // Add small delay for user to see the message
          setTimeout(() => {
            window.location.href = `/workspace/mobile-driver?nik=${qrData.id}`;
          }, 800);
          return;
        }
        
        // Desktop: continue with traditional attendance system
        validateAndProcess(qrData.id, qrData.token);
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
          isSpareOrigin: result.employee.isSpareOrigin || false,
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
    if (!scanResult || !attendanceForm.jamTidur || !attendanceForm.fitToWork || 
        (scanResult.nomorLambung === 'SPARE' && !attendanceForm.nomorLambung)) {
      toast({
        title: "Data Tidak Lengkap",
        description: scanResult?.nomorLambung === 'SPARE' 
          ? "Silakan isi jam tidur, status fit to work, dan nomor lambung baru"
          : "Silakan isi jam tidur dan status fit to work",
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

      const attendanceData: any = {
        employeeId: scanResult.employeeId,
        date: today,
        time: currentTime,
        jamTidur: attendanceForm.jamTidur,
        fitToWork: attendanceForm.fitToWork,
        status: "present"
      };
      
      // Jika nomor lambung SPARE, sertakan nomor lambung baru
      if (scanResult.nomorLambung === 'SPARE' && attendanceForm.nomorLambung) {
        attendanceData.nomorLambungBaru = attendanceForm.nomorLambung;
      }

      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attendanceData)
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
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] }), // Invalidate employees untuk nomor lambung update
        refetchActivities() // Refresh recent activities immediately
      ]).catch(console.error); // Don't block UI for cache updates

      // Force refetch roster dengan delay untuk memastikan data employee sudah terupdate
      if (attendanceForm.nomorLambung) {
        console.log(`🔄 Force refetching roster after nomor lambung update for ${scanResult.name}`);
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ["/api/roster"] });
          queryClient.refetchQueries({ queryKey: ["/api/employees"] });
        }, 1000); // Delay 1 detik untuk memastikan backend selesai update
      }
      
      // Reset form and clear scan result after 3 seconds
      setTimeout(() => {
        setScanResult(null);
        setAttendanceForm({ jamTidur: '', fitToWork: '', nomorLambung: '' });
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
    <div className="space-y-8">
      {/* Hero Scanner Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/10 opacity-30"></div>
        <div className="relative z-10">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ScanLine className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              QR Code Scanner
            </h1>
            <p className="text-xl text-indigo-100 max-w-2xl mx-auto">
              Scan QR code karyawan untuk absensi real-time
            </p>
            <div className="flex justify-center items-center gap-4 text-sm bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Waktu: {currentTime}</span>
              </div>
              <div className="w-1 h-4 bg-white/30"></div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>{currentShift}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Scanner Interface */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Enhanced Camera Scanner */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Camera Scanner</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Posisikan QR code di dalam frame untuk scan otomatis</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center">
                <Camera className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Enhanced Video Container */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl opacity-5"></div>
              <video 
                ref={videoRef}
                className="relative z-10 w-full h-80 bg-gray-900 rounded-2xl object-cover shadow-lg"
                autoPlay
                muted
                playsInline
                data-testid="scanner-video"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Modern Scanning Overlay */}
              {isScanning && (
                <div className="absolute inset-4 z-20 pointer-events-none">
                  {/* Animated Corner Brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg animate-pulse"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg animate-pulse"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg animate-pulse"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-lg animate-pulse"></div>
                  
                  {/* Scanning Line Animation */}
                  <div className="absolute inset-x-8 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse"></div>
                  
                  {/* Center Target */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-20 h-20 border-2 border-indigo-400 rounded-lg flex items-center justify-center animate-pulse">
                      <Target className="w-8 h-8 text-indigo-400" />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Camera Off State */}
              {!isScanning && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/80 rounded-2xl">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto">
                      <Camera className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-white text-lg font-medium">Kamera Siap</p>
                    <p className="text-gray-300 text-sm">Klik tombol di bawah untuk memulai scanning</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Enhanced Control Buttons */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={startScanning} 
                  disabled={isScanning || isProcessing}
                  className="h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl font-medium shadow-lg shadow-indigo-500/25"
                  data-testid="start-scanner-button"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  {isScanning ? "Scanning..." : isProcessing ? "Memproses..." : "Mulai Scan"}
                </Button>
                <Button 
                  onClick={stopScanning} 
                  disabled={!isScanning}
                  variant="outline"
                  className="h-12 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium"
                  data-testid="stop-scanner-button"
                >
                  <CameraOff className="w-5 h-5 mr-2" />
                  Stop Scan
                </Button>
              </div>
              
              {/* Status Indicators */}
              {isScanning && !isProcessing && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center justify-center space-x-2 text-indigo-700 dark:text-indigo-300">
                    <ScanLine className="w-5 h-5 animate-pulse" />
                    <span className="font-medium">Mendeteksi QR Code...</span>
                  </div>
                  <p className="text-xs text-center mt-2 text-indigo-600 dark:text-indigo-400">
                    Arahkan kamera ke QR code dan pastikan pencahayaan cukup
                  </p>
                </div>
              )}
              
              {isProcessing && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-center space-x-2 text-amber-700 dark:text-amber-300">
                    <div className="w-5 h-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"></div>
                    <span className="font-medium">Memvalidasi QR Code...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      
        {/* Enhanced Scan Result */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Hasil Scan</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Informasi karyawan yang berhasil discan</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {!scanResult ? (
              <div className="text-center py-16" data-testid="scan-placeholder">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <ScanLine className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Siap untuk Scan</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Hasil scan QR code akan ditampilkan di sini</p>
              </div>
            ) : (
              <div className="space-y-6" data-testid="scan-result">
                {/* Enhanced Status Banner */}
                <div className={`relative overflow-hidden rounded-2xl p-6 ${
                  scanResult.status === 'processing' 
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800'
                    : scanResult.status === 'success'
                    ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800'
                    : scanResult.status === 'error'
                    ? 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800'
                }`}>
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {scanResult.status === 'processing' ? (
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                          <div className="w-6 h-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                        </div>
                      ) : scanResult.status === 'success' ? (
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      ) : scanResult.status === 'error' ? (
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
                          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold ${
                        scanResult.status === 'processing' 
                          ? 'text-blue-800 dark:text-blue-200'
                          : scanResult.status === 'success'
                          ? 'text-emerald-800 dark:text-emerald-200'
                          : scanResult.status === 'error'
                          ? 'text-red-800 dark:text-red-200'
                          : 'text-emerald-800 dark:text-emerald-200'
                      }`}>
                        {scanResult.status === 'processing' 
                          ? 'Memproses Absensi...'
                          : scanResult.status === 'success'
                          ? '🎉 Absensi Berhasil!'
                          : scanResult.status === 'error'
                          ? '❌ Gagal Memproses'
                          : '✅ QR Code Valid'
                        }
                      </h3>
                      <p className={`text-sm mt-1 ${
                        scanResult.status === 'processing' 
                          ? 'text-blue-600 dark:text-blue-300'
                          : scanResult.status === 'success'
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : scanResult.status === 'error'
                          ? 'text-red-600 dark:text-red-300'
                          : 'text-emerald-600 dark:text-emerald-300'
                      }`}>
                        {scanResult.status === 'processing' 
                          ? 'Sedang memvalidasi dan menyimpan data absensi'
                          : scanResult.status === 'success'
                          ? 'Data absensi berhasil disimpan ke sistem'
                          : scanResult.status === 'error'
                          ? 'Terjadi kesalahan saat memproses absensi'
                          : 'QR code terdeteksi dan siap diproses'
                        }
                      </p>
                      {scanResult.status === 'error' && scanResult.errorMessage && (
                        <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <p className="text-sm text-red-700 dark:text-red-300 font-medium">{scanResult.errorMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Enhanced Employee Information Cards */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">ID Karyawan</label>
                        <p className="text-lg font-bold text-gray-900 dark:text-white" data-testid="scanned-employee-id">
                          {scanResult.employeeId}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nama Karyawan</label>
                        <p className="text-lg font-bold text-gray-900 dark:text-white" data-testid="scanned-employee-name">
                          {scanResult.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {scanResult.nomorLambung && (
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                          <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nomor Lambung</label>
                          <p className="text-lg font-bold text-gray-900 dark:text-white" data-testid="scanned-nomor-lambung">
                            {scanResult.isSpareOrigin && scanResult.nomorLambung !== "SPARE" ? 
                              `SPARE ${scanResult.nomorLambung}` : (scanResult.nomorLambung || '-')
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Waktu & Shift</label>
                        <p className="text-lg font-bold text-gray-900 dark:text-white" data-testid="scan-time">
                          {scanResult.scanTime}
                        </p>
                      </div>
                    </div>
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
                    
                    {/* Field Nomor Lambung - hanya tampil jika nomor lambung adalah SPARE */}
                    {scanResult.nomorLambung === 'SPARE' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nomor Lambung Baru <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="text"
                          value={attendanceForm.nomorLambung || ''}
                          onChange={(e) => setAttendanceForm(prev => ({ ...prev, nomorLambung: e.target.value }))}
                          placeholder="Masukkan nomor lambung baru"
                          className="w-full"
                          data-testid="nomor-lambung-input"
                          required={scanResult.nomorLambung === 'SPARE'}
                        />
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    onClick={processAttendance}
                    disabled={
                      !attendanceForm.jamTidur || 
                      !attendanceForm.fitToWork || 
                      isProcessing ||
                      (scanResult.nomorLambung === 'SPARE' && !attendanceForm.nomorLambung)
                    }
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
                    setAttendanceForm({ jamTidur: '', fitToWork: '', nomorLambung: '' });
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
        </div>
      </div>

      {/* Enhanced Recent Activities */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Aktivitas Real-time</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Absensi karyawan terbaru hari ini</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {recentActivities?.length === 0 ? (
            <div className="text-center py-16" data-testid="no-activities">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Activity className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Belum Ada Aktivitas</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Aktivitas absensi real-time akan ditampilkan di sini</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="recent-activities-list">
              {recentActivities?.slice(0, 5).map((activity) => (
                <div 
                  key={activity.id} 
                  className="group bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700/30 dark:to-blue-900/10 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-200"
                  data-testid={`activity-${activity.employeeId}`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {activity.employeeName}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          ({activity.employeeId})
                        </span>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span className="font-medium">{activity.time}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                          <Moon className="w-4 h-4 text-indigo-500" />
                          <span className="font-medium">{activity.jamTidur}h tidur</span>
                        </div>
                        <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                          <Heart className={`w-4 h-4 ${
                            activity.fitToWork === 'Fit' ? 'text-emerald-500' : 'text-amber-500'
                          }`} />
                          <span className={`font-medium ${
                            activity.fitToWork === 'Fit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}>{activity.fitToWork}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                          <Calendar className="w-4 h-4 text-purple-500" />
                          <span className="font-medium">Hari ke-{activity.workingDays}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end space-y-2">
                      <span className="bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-800 dark:text-emerald-200 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                        ✓ Hadir
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(activity.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {recentActivities && recentActivities.length > 5 && (
                <div className="text-center pt-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-3">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      Menampilkan 5 dari {recentActivities.length} aktivitas • 
                      <button className="underline hover:no-underline">Lihat Semua</button>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>

    </div>
  );
}
