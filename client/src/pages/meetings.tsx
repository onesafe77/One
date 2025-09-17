import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, MapPin, User, QrCode, Users, Eye, Trash2, Plus, Download, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Meeting, InsertMeeting, MeetingAttendance } from "@shared/schema";
import QRCode from "qrcode";
import { generateMeetingAttendancePDF } from "@/lib/meeting-pdf-utils";

// QR Code Display Component
function QRCodeDisplay({ meeting }: { meeting: Meeting }) {
  const [qrDataURL, setQrDataURL] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const generateQR = async () => {
      if (meeting.qrToken) {
        try {
          // Generate QR code with URL format that works with native camera scanners
          const qrData = JSON.stringify({
            type: "meeting",
            token: meeting.qrToken
          });
          const qrUrl = `${window.location.origin}/qr-redirect?data=${encodeURIComponent(qrData)}`;
          
          const dataURL = await QRCode.toDataURL(qrUrl, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrDataURL(dataURL);
        } catch (error) {
          console.error('Error generating QR code:', error);
        }
      }
    };
    generateQR();
  }, [meeting.qrToken]);

  const downloadQR = async () => {
    if (!qrDataURL) return;
    
    try {
      const link = document.createElement('a');
      link.href = qrDataURL;
      link.download = `meeting-qr-${meeting.title.replace(/[^a-zA-Z0-9]/g, '-')}-${meeting.date}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "QR Code Downloaded",
        description: `QR code untuk meeting "${meeting.title}" berhasil didownload`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mendownload QR code",
        variant: "destructive",
      });
    }
  };

  const copyMeetingScanURL = () => {
    const scanURL = `${window.location.origin}/meeting-scanner`;
    navigator.clipboard.writeText(scanURL).then(() => {
      toast({
        title: "Link Copied",
        description: "Link scan QR meeting berhasil dicopy ke clipboard",
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Gagal copy link",
        variant: "destructive",
      });
    });
  };

  return (
    <div className="text-center py-6">
      {qrDataURL && (
        <div className="mx-auto mb-4 inline-block p-4 bg-white rounded-lg shadow-sm">
          <img 
            src={qrDataURL} 
            alt={`QR Code for ${meeting.title}`}
            className="mx-auto"
            style={{ width: 300, height: 300 }}
          />
        </div>
      )}
      
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Informasi Meeting
          </h4>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <div><strong>Judul:</strong> {meeting.title}</div>
            <div><strong>Tanggal:</strong> {new Date(meeting.date).toLocaleDateString('id-ID')}</div>
            <div><strong>Waktu:</strong> {meeting.startTime} - {meeting.endTime}</div>
            <div><strong>Lokasi:</strong> {meeting.location}</div>
            <div><strong>Penyelenggara:</strong> {meeting.organizer}</div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
            Cara Absensi via Mobile
          </h4>
          <div className="text-sm text-green-800 dark:text-green-200 space-y-2">
            <div>1. Buka link berikut di mobile/smartphone:</div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded border text-xs font-mono break-all">
              {window.location.origin}/meeting-scanner
            </div>
            <div>2. Masukkan NIK karyawan</div>
            <div>3. Scan QR code di atas menggunakan kamera</div>
            <div>4. Sistem otomatis mencatat kehadiran</div>
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          <Button 
            onClick={downloadQR}
            className="bg-red-600 hover:bg-red-700"
            data-testid="button-download-qr-dialog"
          >
            <Download className="w-4 h-4 mr-2" />
            Download QR Code
          </Button>
          
          <Button 
            onClick={copyMeetingScanURL}
            variant="outline"
            data-testid="button-copy-scan-url"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Copy Link Scan
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Meetings() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<InsertMeeting>({
    title: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    organizer: "",
    status: "scheduled"
  });

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (meeting: InsertMeeting) => {
      return await apiRequest("/api/meetings", "POST", meeting);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setIsCreateOpen(false);
      setFormData({
        title: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        startTime: "09:00",
        endTime: "10:00",
        location: "",
        organizer: "",
        status: "scheduled"
      });
      toast({
        title: "Meeting Created",
        description: "Meeting berhasil dibuat dengan QR code unik",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal membuat meeting",
        variant: "destructive",
      });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/meetings/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({
        title: "Meeting Deleted",
        description: "Meeting berhasil dihapus",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal menghapus meeting",
        variant: "destructive",
      });
    },
  });

  const { data: attendanceData } = useQuery<{
    meeting: Meeting;
    attendance: (MeetingAttendance & { employee?: any })[];
    totalAttendees: number;
  }>({
    queryKey: ["/api/meetings", selectedMeeting?.id, "attendance"],
    enabled: !!selectedMeeting?.id && isAttendanceOpen,
  });

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    createMeetingMutation.mutate(formData);
  };

  const handleDelete = (meeting: Meeting) => {
    if (confirm(`Yakin ingin menghapus meeting "${meeting.title}"?`)) {
      deleteMeetingMutation.mutate(meeting.id);
    }
  };

  const generateQRCodeDataURL = async (qrToken: string): Promise<string> => {
    try {
      // Generate QR code with URL format that works with native camera scanners
      const qrData = JSON.stringify({ 
        type: "meeting",
        token: qrToken 
      });
      const qrUrl = `${window.location.origin}/qr-redirect?data=${encodeURIComponent(qrData)}`;
      
      return await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  const downloadQRCode = async (meeting: Meeting) => {
    if (!meeting.qrToken) return;
    
    try {
      const qrDataURL = await generateQRCodeDataURL(meeting.qrToken);
      
      // Create download link
      const link = document.createElement('a');
      link.href = qrDataURL;
      link.download = `meeting-qr-${meeting.title.replace(/[^a-zA-Z0-9]/g, '-')}-${meeting.date}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "QR Code Downloaded",
        description: `QR code untuk meeting "${meeting.title}" berhasil didownload`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mendownload QR code",
        variant: "destructive",
      });
    }
  };

  const downloadAttendanceReport = () => {
    console.log('Download PDF requested', { selectedMeeting, attendanceData });
    
    if (!selectedMeeting) {
      toast({
        title: "Error",
        description: "Meeting tidak dipilih",
        variant: "destructive",
      });
      return;
    }
    
    if (!attendanceData) {
      toast({
        title: "Error", 
        description: "Data attendance tidak tersedia",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Prepare and validate data for PDF generation
      const pdfData = {
        meeting: {
          id: selectedMeeting.id,
          title: selectedMeeting.title,
          description: selectedMeeting.description || undefined,
          date: selectedMeeting.date,
          startTime: selectedMeeting.startTime,
          endTime: selectedMeeting.endTime,
          location: selectedMeeting.location,
          organizer: selectedMeeting.organizer,
          status: selectedMeeting.status
        },
        attendance: attendanceData.attendance || [],
        totalAttendees: attendanceData.totalAttendees || 0
      };
      
      console.log('Calling PDF generator with:', pdfData);
      generateMeetingAttendancePDF(pdfData);
      
      toast({
        title: "PDF Berhasil Didownload",
        description: `Laporan meeting "${selectedMeeting.title}" telah didownload`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error tidak dikenal';
      toast({
        title: "Gagal Download PDF",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      scheduled: { label: "Terjadwal", variant: "secondary" as const },
      ongoing: { label: "Berlangsung", variant: "default" as const },
      completed: { label: "Selesai", variant: "outline" as const },
      cancelled: { label: "Dibatalkan", variant: "destructive" as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.scheduled;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Memuat data meeting...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Meeting Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Kelola meeting dan absensi peserta dengan QR code
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-meeting" className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              Buat Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Buat Meeting Baru</DialogTitle>
              <DialogDescription>
                Buat meeting baru dengan QR code untuk absensi peserta
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Judul Meeting *</Label>
                  <Input
                    id="title"
                    data-testid="input-meeting-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Contoh: Rapat Mingguan"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="organizer">Penyelenggara *</Label>
                  <Input
                    id="organizer"
                    data-testid="input-meeting-organizer"
                    value={formData.organizer}
                    onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                    placeholder="Nama penyelenggara"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  data-testid="input-meeting-description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi meeting (opsional)"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Tanggal *</Label>
                  <Input
                    id="date"
                    type="date"
                    data-testid="input-meeting-date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="startTime">Waktu Mulai *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    data-testid="input-meeting-start-time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endTime">Waktu Selesai *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    data-testid="input-meeting-end-time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Lokasi *</Label>
                <Input
                  id="location"
                  data-testid="input-meeting-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Contoh: Ruang Meeting A, Lantai 2"
                  required
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={createMeetingMutation.isPending}
                  data-testid="button-submit-meeting"
                  className="bg-red-600 hover:bg-red-700"
                >
                  {createMeetingMutation.isPending ? "Membuat..." : "Buat Meeting"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  data-testid="button-cancel-meeting"
                >
                  Batal
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Daftar Meeting
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {meetings.length} meeting tersedia
          </p>
        </div>
        <div className="p-6">
          {meetings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Belum ada meeting
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Buat meeting pertama untuk mulai menggunakan sistem absensi QR code
              </p>
              <Button 
                onClick={() => setIsCreateOpen(true)}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-create-first-meeting"
              >
                <Plus className="w-4 h-4 mr-2" />
                Buat Meeting Pertama
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Tanggal & Waktu</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Penyelenggara</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((meeting: Meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {meeting.title}
                        </div>
                        {meeting.description && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {meeting.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(meeting.date).toLocaleDateString('id-ID')}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <Clock className="w-4 h-4" />
                        {meeting.startTime} - {meeting.endTime}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {meeting.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-gray-400" />
                        {meeting.organizer}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(meeting.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMeeting(meeting);
                            setIsQrOpen(true);
                          }}
                          data-testid={`button-view-qr-${meeting.id}`}
                          title="Lihat QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadQRCode(meeting)}
                          data-testid={`button-download-qr-${meeting.id}`}
                          title="Download QR Code"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMeeting(meeting);
                            setIsAttendanceOpen(true);
                          }}
                          data-testid={`button-view-attendance-${meeting.id}`}
                          title="Lihat Kehadiran"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(meeting)}
                          data-testid={`button-delete-meeting-${meeting.id}`}
                          title="Hapus Meeting"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code Meeting</DialogTitle>
            <DialogDescription>
              QR code untuk absensi meeting: {selectedMeeting?.title}
            </DialogDescription>
          </DialogHeader>
          
          {selectedMeeting?.qrToken && (
            <QRCodeDisplay meeting={selectedMeeting} />
          )}
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Daftar Kehadiran Meeting</span>
              {attendanceData && attendanceData.attendance.length > 0 && (
                <Button
                  onClick={downloadAttendanceReport}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  data-testid="button-download-attendance-report"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              Meeting: {selectedMeeting?.title} - {attendanceData?.totalAttendees || 0} peserta hadir
            </DialogDescription>
          </DialogHeader>
          
          {attendanceData?.attendance?.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Belum ada peserta yang hadir
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Peserta dapat scan QR code untuk melakukan absensi
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Karyawan</TableHead>
                  <TableHead>NIK</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Tanggal Scan</TableHead>
                  <TableHead>Waktu Scan</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceData?.attendance?.map((att: any) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium">
                      {att.attendanceType === 'manual_entry' ? att.manualName : (att.employee?.name || 'Unknown')}
                    </TableCell>
                    <TableCell>{att.attendanceType === 'manual_entry' ? '-' : (att.employee?.id || '-')}</TableCell>
                    <TableCell>{att.attendanceType === 'manual_entry' ? att.manualDepartment : (att.employee?.department || '-')}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-sm font-medium truncate">
                        {selectedMeeting?.title || '-'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {selectedMeeting?.location || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(att.scanDate).toLocaleDateString('id-ID')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {att.scanTime} WITA
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400 max-w-[150px]">
                      <div className="truncate" title={att.deviceInfo}>
                        {att.deviceInfo}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}