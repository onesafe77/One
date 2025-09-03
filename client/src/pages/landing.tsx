import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Users, Calendar, FileText, BarChart3, Shield, ArrowRight, Check } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: QrCode,
      title: "QR Code Scanning",
      description: "Absensi cepat dan akurat menggunakan teknologi QR Code yang aman dan mudah digunakan.",
      color: "text-blue-600"
    },
    {
      icon: Users,
      title: "Manajemen Karyawan", 
      description: "Kelola data karyawan, departemen, dan informasi kepegawaian dengan mudah dan terorganisir.",
      color: "text-emerald-600"
    },
    {
      icon: Calendar,
      title: "Penjadwalan & Roster",
      description: "Atur jadwal kerja, shift, dan roster karyawan dengan fleksibilitas tinggi.",
      color: "text-purple-600"
    },
    {
      icon: FileText,
      title: "Manajemen Cuti",
      description: "Proses pengajuan cuti, persetujuan, dan tracking saldo cuti karyawan secara otomatis.",
      color: "text-orange-600"
    },
    {
      icon: BarChart3,
      title: "Laporan & Analytics",
      description: "Dapatkan insight mendalam dengan laporan kehadiran dan analytics yang komprehensif.",
      color: "text-red-600"
    },
    {
      icon: Shield,
      title: "Keamanan Tinggi",
      description: "Sistem autentikasi yang aman dan validasi QR Code dengan enkripsi untuk melindungi data.",
      color: "text-indigo-600"
    }
  ];

  const benefits = [
    "Sistem absensi digital yang akurat",
    "Manajemen karyawan terintegrasi",
    "Laporan real-time dan analytics",
    "Interface yang user-friendly",
    "Keamanan data tingkat enterprise"
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-600 rounded-xl mb-8 shadow-lg">
              <QrCode className="w-10 h-10 text-white" />
            </div>

            {/* Heading */}
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Attendance<span className="text-red-600">QR</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 mb-10 leading-relaxed max-w-3xl mx-auto">
              Sistem manajemen kehadiran karyawan modern dengan teknologi QR Code untuk tracking yang akurat dan efisien
            </p>

            {/* Benefits List */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12 max-w-4xl mx-auto">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center justify-center md:justify-start space-x-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <Button 
              size="lg" 
              className="px-8 py-4 text-lg font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center space-x-2"
              onClick={() => window.location.href = '/api/login'}
            >
              <span>Mulai Sekarang</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Fitur Lengkap & Modern
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Solusi terpadu untuk manajemen kehadiran karyawan dengan teknologi terdepan
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="group bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-600 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center group-hover:bg-red-50 dark:group-hover:bg-red-900/20 transition-colors duration-300">
                      <feature.icon className={`w-6 h-6 ${feature.color} group-hover:text-red-600`} />
                    </div>
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-red-600 transition-colors duration-300">
                      {feature.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-r from-red-600 to-red-700 border-0 shadow-xl">
              <CardContent className="p-12 text-center">
                <h3 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                  Siap untuk Memulai?
                </h3>
                <p className="text-xl text-red-100 mb-8 max-w-2xl mx-auto">
                  Login sekarang untuk mengakses sistem manajemen kehadiran yang lengkap dan mudah digunakan
                </p>
                <Button 
                  size="lg" 
                  variant="secondary"
                  className="px-10 py-4 text-lg font-semibold bg-white text-red-600 hover:bg-gray-50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center space-x-2"
                  onClick={() => window.location.href = '/api/login'}
                >
                  <span>Login untuk Masuk</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <QrCode className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                AttendanceQR
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              &copy; 2025 AttendanceQR. Sistem manajemen kehadiran modern dan efisien.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}