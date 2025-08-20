import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare, Send, Users, Image, Calendar, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import type { WhatsappBlast, Employee } from "@shared/schema";

export default function WhatsAppBlast() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    imageUrl: "",
    targetType: "all",
    targetValue: ""
  });
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Fetch data
  const { data: blasts = [], isLoading: blastsLoading } = useQuery({
    queryKey: ["/api/whatsapp-blasts"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Test API connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/whatsapp/test-connection", "POST");
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Koneksi Berhasil" : "Koneksi Gagal",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal menguji koneksi API",
        variant: "destructive",
      });
    },
  });

  // Create blast mutation
  const createBlastMutation = useMutation({
    mutationFn: async (blastData: any) => {
      return apiRequest("/api/whatsapp-blasts", "POST", blastData);
    },
    onSuccess: () => {
      toast({
        title: "Blast WhatsApp Dibuat",
        description: "Blast WhatsApp berhasil dibuat dan akan diproses",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-blasts"] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal membuat blast WhatsApp",
        variant: "destructive",
      });
    },
  });

  // Send blast mutation
  const sendBlastMutation = useMutation({
    mutationFn: async (blastId: string) => {
      return apiRequest(`/api/whatsapp-blasts/${blastId}/send`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Blast Terkirim",
        description: "Blast WhatsApp berhasil dikirim",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-blasts"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal mengirim blast WhatsApp",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      message: "",
      imageUrl: "",
      targetType: "all",
      targetValue: ""
    });
    setSelectedEmployees([]);
  };

  const handleImageUpload = async () => {
    try {
      const response: any = await apiRequest("/api/objects/upload", "POST");
      return {
        method: "PUT" as const,
        url: response.uploadURL,
      };
    } catch (error) {
      console.error("Failed to get upload URL:", error);
      throw error;
    }
  };

  const handleUploadComplete = async (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const imageUrl = uploadedFile.uploadURL;
      
      try {
        const response: any = await apiRequest("/api/objects/normalize", "POST", { uploadURL: imageUrl });
        
        setFormData(prev => ({ ...prev, imageUrl: response.objectPath }));
        toast({
          title: "Upload Berhasil",
          description: "Gambar berhasil diupload",
        });
      } catch (error) {
        console.error("Failed to normalize path:", error);
        toast({
          title: "Error",
          description: "Gagal memproses gambar",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.message) {
      toast({
        title: "Error",
        description: "Judul dan pesan harus diisi",
        variant: "destructive",
      });
      return;
    }

    let targetValue = "";
    let totalRecipients = 0;

    if (formData.targetType === "all") {
      totalRecipients = employees.length;
    } else if (formData.targetType === "department") {
      const dept = formData.targetValue;
      const deptEmployees = employees.filter(emp => emp.department === dept);
      totalRecipients = deptEmployees.length;
      targetValue = dept;
    } else if (formData.targetType === "specific") {
      totalRecipients = selectedEmployees.length;
      targetValue = JSON.stringify(selectedEmployees);
    }

    const blastData = {
      ...formData,
      targetValue,
      totalRecipients,
    };

    createBlastMutation.mutate(blastData);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
    };
    
    const icons: Record<string, any> = {
      pending: Clock,
      processing: AlertCircle,
      completed: CheckCircle,
      failed: XCircle,
    };
    
    const Icon = icons[status] || Clock;
    
    return (
      <Badge variant={variants[status] || "secondary"} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const departments = Array.from(new Set(employees.map(emp => emp.department).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          WhatsApp Blast
        </h1>
        <Button 
          onClick={() => testConnectionMutation.mutate()}
          disabled={testConnectionMutation.isPending}
          variant="outline"
        >
          Test Koneksi API
        </Button>
      </div>

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList>
          <TabsTrigger value="create">Buat Blast</TabsTrigger>
          <TabsTrigger value="history">Riwayat Blast</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buat Blast WhatsApp Baru</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Judul Blast</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Masukkan judul blast"
                    data-testid="input-blast-title"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Pesan</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Masukkan pesan yang akan dikirim"
                    rows={4}
                    data-testid="textarea-blast-message"
                  />
                </div>

                <div>
                  <Label>Gambar (Opsional)</Label>
                  <div className="flex items-center gap-2">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880} // 5MB
                      onGetUploadParameters={handleImageUpload}
                      onComplete={handleUploadComplete}
                      buttonClassName="w-full"
                    >
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Upload Gambar
                      </div>
                    </ObjectUploader>
                  </div>
                  {formData.imageUrl && (
                    <p className="text-sm text-green-600 mt-1">✓ Gambar berhasil diupload</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="targetType">Target Penerima</Label>
                  <Select 
                    value={formData.targetType} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, targetType: value }))}
                  >
                    <SelectTrigger data-testid="select-target-type">
                      <SelectValue placeholder="Pilih target penerima" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Karyawan</SelectItem>
                      <SelectItem value="department">Per Departemen</SelectItem>
                      <SelectItem value="specific">Pilih Karyawan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.targetType === "department" && (
                  <div>
                    <Label htmlFor="department">Pilih Departemen</Label>
                    <Select 
                      value={formData.targetValue} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, targetValue: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih departemen" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.targetType === "specific" && (
                  <div>
                    <Label>Pilih Karyawan</Label>
                    <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                      {employees.map((employee) => (
                        <div key={employee.id} className="flex items-center space-x-2 mb-2">
                          <input
                            type="checkbox"
                            id={employee.id}
                            checked={selectedEmployees.includes(employee.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEmployees(prev => [...prev, employee.id]);
                              } else {
                                setSelectedEmployees(prev => prev.filter(id => id !== employee.id));
                              }
                            }}
                          />
                          <label htmlFor={employee.id} className="text-sm">
                            {employee.name} - {employee.department}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedEmployees.length} karyawan dipilih
                    </p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={createBlastMutation.isPending}
                  className="w-full"
                  data-testid="button-create-blast"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {createBlastMutation.isPending ? "Membuat..." : "Buat Blast"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Blast WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              {blastsLoading ? (
                <div>Loading...</div>
              ) : (blasts as any[]).length === 0 ? (
                <div className="text-center text-gray-500 py-8">Belum ada riwayat blast</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Judul</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Total Penerima</TableHead>
                      <TableHead>Berhasil</TableHead>
                      <TableHead>Gagal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(blasts as WhatsappBlast[]).map((blast: WhatsappBlast) => (
                      <TableRow key={blast.id}>
                        <TableCell className="font-medium">{blast.title}</TableCell>
                        <TableCell>
                          {blast.targetType === "all" ? "Semua" : 
                           blast.targetType === "department" ? `Dept: ${blast.targetValue}` :
                           "Karyawan Terpilih"}
                        </TableCell>
                        <TableCell>{blast.totalRecipients}</TableCell>
                        <TableCell className="text-green-600">{blast.successCount}</TableCell>
                        <TableCell className="text-red-600">{blast.failedCount}</TableCell>
                        <TableCell>{getStatusBadge(blast.status)}</TableCell>
                        <TableCell>
                          {blast.createdAt ? new Date(blast.createdAt).toLocaleDateString('id-ID') : '-'}
                        </TableCell>
                        <TableCell>
                          {blast.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => sendBlastMutation.mutate(blast.id)}
                              disabled={sendBlastMutation.isPending}
                            >
                              Kirim
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}