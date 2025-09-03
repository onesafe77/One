import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Users, Calendar, FileText, BarChart3, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900 flex flex-col">
      <div className="flex-1 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary-600 dark:bg-primary-500 rounded-lg flex items-center justify-center">
              <QrCode className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            AttendanceQR
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Sistem manajemen kehadiran karyawan modern dengan teknologi QR Code untuk tracking yang akurat dan efisien.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <CardHeader>
              <QrCode className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <CardTitle>QR Code Scanning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Absensi cepat dan akurat menggunakan teknologi QR Code yang aman dan mudah digunakan.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Users className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <CardTitle>Manajemen Karyawan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Kelola data karyawan, departemen, dan informasi kepegawaian dengan mudah dan terorganisir.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Calendar className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <CardTitle>Penjadwalan & Roster</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Atur jadwal kerja, shift, dan roster karyawan dengan fleksibilitas tinggi.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <FileText className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <CardTitle>Manajemen Cuti</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Proses pengajuan cuti, persetujuan, dan tracking saldo cuti karyawan secara otomatis.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <BarChart3 className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <CardTitle>Laporan & Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Dapatkan insight mendalam dengan laporan kehadiran dan analytics yang komprehensif.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Shield className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <CardTitle>Keamanan Tinggi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Sistem autentikasi yang aman dan validasi QR Code dengan enkripsi untuk melindungi data.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl mb-4">
                Mulai Menggunakan AttendanceQR
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-300">
                Login untuk mengakses sistem manajemen kehadiran yang lengkap dan mudah digunakan.
              </p>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                className="w-full sm:w-auto"
                onClick={() => window.location.href = '/api/login'}
              >
                Login untuk Masuk
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-300">
          <p>&copy; 2025 AttendanceQR. Sistem manajemen kehadiran yang modern dan efisien.</p>
        </div>
      </footer>
    </div>
  );
}