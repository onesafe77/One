import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Users, Calendar, FileText, BarChart3, Shield } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: QrCode,
      title: "QR Code Scanning",
      description: "Absensi cepat dan akurat menggunakan teknologi QR Code yang aman dan mudah digunakan.",
      gradient: "from-red-500 to-pink-500"
    },
    {
      icon: Users,
      title: "Manajemen Karyawan", 
      description: "Kelola data karyawan, departemen, dan informasi kepegawaian dengan mudah dan terorganisir.",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: Calendar,
      title: "Penjadwalan & Roster",
      description: "Atur jadwal kerja, shift, dan roster karyawan dengan fleksibilitas tinggi.",
      gradient: "from-purple-500 to-violet-500"
    },
    {
      icon: FileText,
      title: "Manajemen Cuti",
      description: "Proses pengajuan cuti, persetujuan, dan tracking saldo cuti karyawan secara otomatis.",
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      icon: BarChart3,
      title: "Laporan & Analytics",
      description: "Dapatkan insight mendalam dengan laporan kehadiran dan analytics yang komprehensif.",
      gradient: "from-orange-500 to-amber-500"
    },
    {
      icon: Shield,
      title: "Keamanan Tinggi",
      description: "Sistem autentikasi yang aman dan validasi QR Code dengan enkripsi untuk melindungi data.",
      gradient: "from-green-500 to-emerald-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 dark:from-slate-900 dark:via-gray-900 dark:to-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-100/50 to-purple-100/50 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-pink-100/50 to-orange-100/50 rounded-full blur-3xl"></div>
      
      <div className="relative container mx-auto px-6 py-20">
        {/* Hero Section */}
        <div className="text-center mb-32 relative">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-8 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
            <div className="relative w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <QrCode className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black mb-8 tracking-tight">
            <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent dark:from-white dark:via-gray-100 dark:to-white">
              Attendance
            </span>
            <span className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent">
              QR
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl lg:text-3xl font-light text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed mb-12">
            Sistem manajemen kehadiran karyawan modern dengan teknologi QR Code untuk tracking yang 
            <span className="font-medium text-gray-800 dark:text-white"> akurat dan efisien</span>
          </p>

          {/* Floating elements */}
          <div className="absolute top-20 left-10 w-3 h-3 bg-red-500 rounded-full opacity-60 animate-bounce delay-100"></div>
          <div className="absolute top-32 right-16 w-2 h-2 bg-blue-500 rounded-full opacity-40 animate-bounce delay-300"></div>
          <div className="absolute bottom-10 left-20 w-4 h-4 bg-purple-500 rounded-full opacity-50 animate-bounce delay-500"></div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="group relative border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
            >
              {/* Gradient border effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-200/50 to-gray-300/50 dark:from-gray-700/50 dark:to-gray-600/50 rounded-xl"></div>
              <div className="relative bg-white dark:bg-gray-800 m-[1px] rounded-xl">
                
                <CardHeader className="pb-8 pt-10">
                  <div className="relative mb-8">
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} rounded-2xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity duration-500`}></div>
                    <div className={`relative w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mx-auto shadow-xl group-hover:scale-110 transition-transform duration-500`}>
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  <CardTitle className="text-xl font-bold text-gray-900 dark:text-white text-center mb-4 group-hover:text-gray-700 dark:group-hover:text-gray-100 transition-colors duration-300">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="pb-10">
                  <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed font-light text-base">
                    {feature.description}
                  </p>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center relative">
          <Card className="max-w-4xl mx-auto border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl shadow-2xl overflow-hidden relative">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-100/30 to-pink-100/30 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-100/30 to-purple-100/30 rounded-full blur-2xl"></div>
            
            <div className="relative">
              <CardHeader className="pb-10 pt-16">
                <CardTitle className="text-4xl md:text-5xl lg:text-6xl font-black mb-8 tracking-tight">
                  <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent dark:from-white dark:via-gray-100 dark:to-white">
                    Mulai Menggunakan
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent">
                    AttendanceQR
                  </span>
                </CardTitle>
                
                <p className="text-xl md:text-2xl font-light text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
                  Login untuk mengakses sistem manajemen kehadiran yang 
                  <span className="font-medium text-gray-800 dark:text-white"> lengkap dan mudah digunakan</span>
                </p>
              </CardHeader>
              
              <CardContent className="pb-16">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-300"></div>
                  <Button 
                    size="lg" 
                    className="relative px-16 py-6 text-xl font-bold bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-700 hover:via-red-600 hover:to-red-700 text-white border-0 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 hover:-translate-y-1 group"
                    onClick={() => window.location.href = '/api/login'}
                  >
                    <span className="flex items-center gap-3">
                      Login untuk Masuk
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-45 transition-transform duration-300">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </span>
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-gray-200/50 dark:border-gray-700/50 bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl py-12">
        <div className="container mx-auto px-6 text-center">
          <p className="text-lg font-light text-gray-600 dark:text-gray-300">
            &copy; 2025 <span className="font-medium text-gray-800 dark:text-white">AttendanceQR</span>. 
            Sistem manajemen kehadiran yang modern dan efisien.
          </p>
        </div>
      </footer>
    </div>
  );
}