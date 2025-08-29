import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { generateQRCodeCanvas, downloadQRCode, printQRCode } from "@/lib/qr-utils";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Employee } from "@shared/schema";
import { Download, Printer, Search } from "lucide-react";

export function QRGenerator() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [qrData, setQrData] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    
    const query = searchQuery.toLowerCase();
    return employees.filter(employee => 
      employee.id.toLowerCase().includes(query) ||
      employee.name.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);

  // Reset selected employee if it's not in filtered results
  useEffect(() => {
    if (selectedEmployeeId && !filteredEmployees.find(emp => emp.id === selectedEmployeeId)) {
      setSelectedEmployeeId("");
    }
  }, [filteredEmployees, selectedEmployeeId]);

  const generateQR = async () => {
    if (!selectedEmployeeId) {
      toast({
        title: "Error",
        description: "Silakan pilih karyawan terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await apiRequest("/api/qr/generate", "POST", {
        employeeId: selectedEmployeeId
      });
      
      console.log("QR Response:", result);
      setQrData(result.qrData);
      
      // Wait a bit to ensure canvas is ready
      setTimeout(async () => {
        if (canvasRef.current) {
          console.log("Canvas element:", canvasRef.current);
          try {
            await generateQRCodeCanvas(result.qrData, canvasRef.current);
            console.log("QR Code rendered to canvas");
          } catch (error) {
            console.error("Canvas rendering error:", error);
          }
        } else {
          console.error("Canvas ref is null");
        }
      }, 100);

      toast({
        title: "QR Code Generated",
        description: `QR Code berhasil dibuat untuk ${selectedEmployee?.name}`,
      });
    } catch (error) {
      console.error("QR Generation error:", error);
      toast({
        title: "Error",
        description: "Gagal membuat QR Code",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (canvasRef.current && selectedEmployee) {
      const filename = `QR_${selectedEmployee.id}_${selectedEmployee.name.replace(/\s+/g, '_')}.png`;
      downloadQRCode(canvasRef.current, filename);
    }
  };

  const handlePrint = () => {
    if (canvasRef.current && selectedEmployee) {
      printQRCode(canvasRef.current, {
        id: selectedEmployee.id,
        name: selectedEmployee.name
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Employee Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Generate QR Code Karyawan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cari Karyawan
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Cari berdasarkan NIK atau nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="employee-search-input"
              />
            </div>
          </div>

          {/* Employee Selection Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pilih Karyawan
            </label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger data-testid="employee-select">
                <SelectValue placeholder="-- Pilih Karyawan --" />
              </SelectTrigger>
              <SelectContent>
                {filteredEmployees.length === 0 ? (
                  <SelectItem value="no-results" disabled>
                    {searchQuery ? `Tidak ditemukan hasil untuk "${searchQuery}"` : "Tidak ada karyawan"}
                  </SelectItem>
                ) : (
                  filteredEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.id} - {employee.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {searchQuery && filteredEmployees.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Menampilkan {filteredEmployees.length} dari {employees.length} karyawan
              </p>
            )}
          </div>
          
          {selectedEmployee && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" data-testid="employee-details">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Detail Karyawan</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">ID:</span> {selectedEmployee.id}</p>
                <p><span className="font-medium">Nama:</span> {selectedEmployee.name}</p>
                <p><span className="font-medium">WhatsApp:</span> {selectedEmployee.phone}</p>
                <p><span className="font-medium">Posisi:</span> {selectedEmployee.position}</p>
                <p><span className="font-medium">Departemen:</span> {selectedEmployee.department}</p>
              </div>
            </div>
          )}
          
          <Button 
            onClick={generateQR} 
            className="w-full" 
            disabled={!selectedEmployeeId || isGenerating}
            data-testid="generate-qr-button"
          >
            {isGenerating ? "Generating..." : "Generate QR Code"}
          </Button>
        </CardContent>
      </Card>
      
      {/* QR Code Display */}
      <Card>
        <CardHeader>
          <CardTitle>QR Code Result</CardTitle>
        </CardHeader>
        <CardContent>
          {!qrData ? (
            <div className="text-center" data-testid="qr-placeholder">
              <div className="w-64 h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                <p className="text-gray-500 dark:text-gray-400">QR Code akan muncul di sini</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pilih karyawan dan klik Generate QR Code</p>
            </div>
          ) : (
            <div data-testid="qr-result">
              <div className="text-center mb-4">
                <canvas 
                  ref={canvasRef} 
                  width={256}
                  height={256}
                  className="mx-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white"
                  style={{ display: 'block' }}
                  data-testid="qr-canvas"
                />
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all" data-testid="qr-data">
                    {qrData}
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleDownload} 
                    variant="outline" 
                    className="flex-1"
                    data-testid="download-qr-button"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button 
                    onClick={handlePrint} 
                    variant="outline" 
                    className="flex-1"
                    data-testid="print-qr-button"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
