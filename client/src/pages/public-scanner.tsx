import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, CameraOff, UserCheck, AlertCircle, CheckCircle, User, Clock, MapPin } from "lucide-react";
import jsQR from "jsqr";
import { apiRequest } from "@/lib/queryClient";

interface QRData {
  id: string;
  token: string;
}

export default function PublicScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // Auto-focus untuk mobile
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    if (isMobile) {
      // Start camera immediately on mobile
      setTimeout(() => {
        startCamera();
      }, 1000);
    }
  }, []);

  const validateQRData = (qrResult: string): QRData | null => {
    try {
      // Try parsing as JSON first (new QR format)
      const data = JSON.parse(qrResult);
      if (data.id && data.token) {
        return data;
      }
    } catch {
      // If JSON parsing fails, try old format
      if (qrResult.includes('data=')) {
        const urlParams = new URLSearchParams(qrResult.split('?')[1] || '');
        const encodedData = urlParams.get('data');
        if (encodedData) {
          try {
            const decodedData = JSON.parse(decodeURIComponent(encodedData));
            if (decodedData.id && decodedData.token) {
              return decodedData;
            }
          } catch {
            // Ignore parsing errors for old format
          }
        }
      }
    }
    return null;
  };

  const attendanceMutation = useMutation({
    mutationFn: async (data: { employeeId: string; token: string }) => {
      // First validate the QR
      const validateResponse = await fetch("/api/public/qr/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!validateResponse.ok) {
        const error = await validateResponse.json();
        throw new Error(error.message || 'QR validation failed');
      }

      const validationResult = await validateResponse.json();
      
      // If validation successful, record attendance
      const attendanceResponse = await fetch("/api/public/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: data.employeeId,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('id-ID', { hour12: false }),
          jamTidur: validationResult.roster?.jamTidur || '',
          fitToWork: validationResult.roster?.fitToWork || 'Fit To Work',
        }),
      });

      if (!attendanceResponse.ok) {
        const error = await attendanceResponse.json();
        throw new Error(error.message || 'Attendance recording failed');
      }

      return await attendanceResponse.json();
    },
    onSuccess: (data) => {
      setLastScanResult(data);
      toast({
        title: "✅ Absensi Berhasil!",
        description: `Absensi tercatat untuk ${data.employee?.name || 'karyawan'}`,
      });
      // Continue scanning after successful scan
      setEmployeeId("");
    },
    onError: (error: any) => {
      let errorMessage = error.message || "Gagal melakukan absensi";
      let errorTitle = "❌ Absensi Gagal";
      
      // Handle specific error cases
      if (error.message?.includes("CUTI")) {
        errorTitle = "🚫 Status CUTI";
        errorMessage = error.message;
      } else if (error.message?.includes("OVERSHIFT")) {
        errorTitle = "🚫 Status OVERSHIFT";
        errorMessage = error.message;
      } else if (error.message?.includes("sudah melakukan absensi")) {
        errorTitle = "⚠️ Sudah Absen";
      } else if (error.message?.includes("tidak ditemukan")) {
        errorTitle = "🔍 Data Tidak Ditemukan";
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });

      setLastScanResult({ error: errorMessage });
    },
  });

  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        scanQRCode();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.",
        variant: "destructive",
      });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const scanQRCode = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        const qrData = validateQRData(code.data);
        
        if (qrData) {
          console.log("QR Code detected:", qrData);
          setEmployeeId(qrData.id);
          
          // Process attendance immediately
          attendanceMutation.mutate({
            employeeId: qrData.id,
            token: qrData.token
          });
          
          // Continue scanning after a short delay
          setTimeout(() => {
            if (isScanning) {
              scanQRCode();
            }
          }, 2000);
          return;
        }
      }
    }

    // Continue scanning
    setTimeout(() => {
      if (isScanning) {
        scanQRCode();
      }
    }, 100);
  }, [isScanning, attendanceMutation]);

  // Handle manual employee ID input
  const handleManualScan = () => {
    if (!employeeId.trim()) {
      toast({
        title: "Input Kosong",
        description: "Masukkan NIK karyawan terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    // For manual input, we need to generate a basic token
    // This would ideally be validated server-side
    const basicToken = btoa(employeeId + "AttendanceManual").slice(0, 16);
    
    attendanceMutation.mutate({
      employeeId: employeeId.trim(),
      token: basicToken
    });
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📱 Scan QR Absensi
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Scan QR Code karyawan untuk mencatat kehadiran
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Scanner Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code Scanner
              </CardTitle>
              <CardDescription>
                Arahkan kamera ke QR code karyawan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Camera controls */}
              <div className="flex gap-2">
                <Button 
                  onClick={isScanning ? stopCamera : startCamera}
                  disabled={attendanceMutation.isPending}
                  className="flex-1"
                  data-testid="button-toggle-camera"
                >
                  {isScanning ? (
                    <>
                      <CameraOff className="h-4 w-4 mr-2" />
                      Stop Camera
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Start Camera
                    </>
                  )}
                </Button>
              </div>

              {/* Camera feed */}
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                {!isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
                    <div className="text-center text-white">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Kamera tidak aktif</p>
                    </div>
                  </div>
                )}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Scan overlay */}
                    <div className="absolute inset-0 border-2 border-dashed border-green-400 animate-pulse" />
                    <div className="absolute top-4 left-4 bg-green-500 text-white px-2 py-1 rounded text-sm">
                      🔍 Sedang Scan...
                    </div>
                  </div>
                )}
              </div>

              {/* Manual input */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Input Manual NIK:</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Masukkan NIK karyawan..."
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                    data-testid="input-employee-id"
                  />
                  <Button 
                    onClick={handleManualScan}
                    disabled={attendanceMutation.isPending || !employeeId.trim()}
                    data-testid="button-manual-scan"
                  >
                    {attendanceMutation.isPending ? (
                      <>⏳ Processing...</>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Scan
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Hasil Scan
              </CardTitle>
              <CardDescription>
                Status absensi terakhir
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceMutation.isPending ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Memproses absensi...</p>
                </div>
              ) : lastScanResult ? (
                <div className="space-y-4">
                  {lastScanResult.error ? (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-red-800 dark:text-red-200">
                            Scan Gagal
                          </h4>
                          <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                            {lastScanResult.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-green-800 dark:text-green-200">
                            ✅ Absensi Berhasil
                          </h4>
                          
                          {lastScanResult.employee && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center text-sm">
                                <User className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="font-medium">{lastScanResult.employee.name}</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                                <span>{lastScanResult.employee.id}</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <Clock className="h-4 w-4 mr-2 text-gray-500" />
                                <span>{new Date().toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada hasil scan</p>
                  <p className="text-sm mt-1">Scan QR code untuk memulai</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}