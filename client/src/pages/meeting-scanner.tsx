import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, CameraOff, UserCheck, AlertCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import jsQR from "jsqr";

export default function MeetingScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

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
      const errorMessage = error.message || "Gagal melakukan absensi";
      setLastScanResult({ error: errorMessage });
      toast({
        title: "Absensi Gagal",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

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
            Scan QR code meeting untuk melakukan absensi
          </p>
        </div>

        {/* Employee ID Input */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Identitas Karyawan</CardTitle>
            <CardDescription>
              Masukkan NIK untuk melakukan absensi meeting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">NIK Karyawan *</Label>
                <Input
                  id="employeeId"
                  data-testid="input-employee-id"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Contoh: C-030015"
                  disabled={isScanning}
                />
              </div>
              
              {!isScanning ? (
                <Button
                  onClick={handleStartScan}
                  disabled={!employeeId.trim() || attendanceMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700"
                  data-testid="button-start-scan"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Mulai Scan QR Code
                </Button>
              ) : (
                <Button
                  onClick={stopCamera}
                  variant="outline"
                  className="w-full"
                  data-testid="button-stop-scan"
                >
                  <CameraOff className="w-4 h-4 mr-2" />
                  Berhenti Scan
                </Button>
              )}
            </div>
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