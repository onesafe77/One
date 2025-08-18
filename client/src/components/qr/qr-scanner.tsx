import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateQRData } from "@/lib/crypto-utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { determineShiftByTime, getCurrentShift } from "@/lib/shift-utils";
import { Camera, CameraOff, CheckCircle, User, Clock, XCircle, Moon, Heart } from "lucide-react";
import jsQR from "jsqr";

interface ScanResult {
  employeeId: string;
  name: string;
  scanTime: string;
  status?: 'validated' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}

interface AttendanceFormData {
  jamTidur: string;
  fitToWork: string;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const { toast } = useToast();

  const startScanning = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      setStream(mediaStream);
      setIsScanning(true);
      scanningRef.current = true;
      setScanResult(null);
      setAttendanceForm({ jamTidur: '', fitToWork: '' });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        requestAnimationFrame(scanQRCode);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mengakses kamera. Pastikan browser memiliki izin kamera.",
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
      requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    
    if (code) {
      const qrData = validateQRData(code.data);
      if (qrData) {
        validateAndProcess(qrData.id, qrData.token);
        return;
      } else {
        toast({
          title: "QR Code Tidak Valid",
          description: "❌ QR Code tidak valid atau bukan dari sistem resmi",
          variant: "destructive",
        });
      }
    }
    
    requestAnimationFrame(scanQRCode);
  }, [toast]);

  const validateAndProcess = async (employeeId: string, token: string) => {
    try {
      const response = await apiRequest("POST", "/api/qr/validate", {
        employeeId,
        token
      });
      
      const result = await response.json();
      
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
          scanTime: displayTime,
          roster: result.roster,
          status: 'processing' as const
        };
        
        setScanResult({ ...employeeData, status: 'validated' });
        stopScanning();
        
        if (result.roster) {
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
      // Format waktu konsisten HH:MM:SS untuk database
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

      // Update status to success
      setScanResult(prev => prev ? { ...prev, status: 'success' } : null);
      
      toast({
        title: "Absensi Berhasil",
        description: `✅ Absensi berhasil dicatat untuk ${scanResult.name}`,
      });

      // Comprehensive real-time data invalidation
      const { queryClient } = await import("@/lib/queryClient");
      
      // Invalidate all attendance-related queries for real-time updates
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/attendance-details"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/roster"] }),
        queryClient.refetchQueries({ queryKey: ["/api/dashboard/stats"] }),
        queryClient.refetchQueries({ queryKey: ["/api/dashboard/attendance-details"] })
      ]);
      
      // Reset form and clear scan result after 3 seconds
      setTimeout(() => {
        setScanResult(null);
        setAttendanceForm({ jamTidur: '', fitToWork: '' });
      }, 3000);
      
    } catch (error: any) {
      console.error("Auto attendance error:", error);
      
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
      
      // Clear scan result after error to allow retry
      setTimeout(() => {
        setScanResult(null);
      }, 3000);
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
              disabled={isScanning}
              className="flex-1"
              data-testid="start-scanner-button"
            >
              <Camera className="w-4 h-4 mr-2" />
              Mulai Scan
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
    </div>
  );
}
