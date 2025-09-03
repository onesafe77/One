import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Users, Calendar, FileText, BarChart3, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 dark:from-gray-950 dark:via-rose-950/20 dark:to-orange-950/20">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl shadow-red-500/25">
              <QrCode className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent dark:from-white dark:via-gray-100 dark:to-gray-300 mb-6 text-center">Selamat Datang di Aplikasi Abensi Karyawan</h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed font-light">
            Sistem manajemen kehadiran karyawan modern dengan teknologi QR Code untuk tracking yang akurat dan efisien.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          <Card className="group hover:scale-105 transition-all duration-300 border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:shadow-red-500/10">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/25">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-800 dark:text-white text-center">QR Code Scanning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                Absensi cepat dan akurat menggunakan teknologi QR Code yang aman dan mudah digunakan.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:scale-105 transition-all duration-300 border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:shadow-blue-500/10">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
                <Users className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-800 dark:text-white text-center">Manajemen Karyawan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                Kelola data karyawan, departemen, dan informasi kepegawaian dengan mudah dan terorganisir.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:scale-105 transition-all duration-300 border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:shadow-purple-500/10">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/25">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-800 dark:text-white text-center">Penjadwalan & Roster</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                Atur jadwal kerja, shift, dan roster karyawan dengan fleksibilitas tinggi.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:scale-105 transition-all duration-300 border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:shadow-emerald-500/10">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-800 dark:text-white text-center">Manajemen Cuti</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                Proses pengajuan cuti, persetujuan, dan tracking saldo cuti karyawan secara otomatis.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:scale-105 transition-all duration-300 border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:shadow-orange-500/10">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/25">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-800 dark:text-white text-center">Laporan & Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                Dapatkan insight mendalam dengan laporan kehadiran dan analytics yang komprehensif.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:scale-105 transition-all duration-300 border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:shadow-green-500/10">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-800 dark:text-white text-center">Keamanan Tinggi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                Sistem autentikasi yang aman dan validasi QR Code dengan enkripsi untuk melindungi data.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-8">
              <CardTitle className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent dark:from-white dark:via-gray-100 dark:to-gray-300 mb-6">
                Mulai Menggunakan AttendanceQR
              </CardTitle>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed font-light">
                Login untuk mengakses sistem manajemen kehadiran yang lengkap dan mudah digunakan.
              </p>
            </CardHeader>
            <CardContent className="pb-8">
              <Button 
                size="lg" 
                className="px-12 py-4 text-lg font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0 shadow-xl shadow-red-600/25 hover:shadow-2xl hover:shadow-red-600/30 transition-all duration-300 hover:scale-105"
                onClick={() => window.location.href = '/api/login'}
              >
                Login untuk Masuk
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Footer */}
      <footer className="border-t border-white/20 bg-white/50 backdrop-blur-sm py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600 dark:text-gray-300 font-light">
            &copy; 2025 AttendanceQR. Sistem manajemen kehadiran yang modern dan efisien.
          </p>
        </div>
      </footer>
    </div>
  );
}