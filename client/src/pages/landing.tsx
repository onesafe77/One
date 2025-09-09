import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Users, 
  QrCode, 
  Scan, 
  Calendar, 
  FileText, 
  BarChart3, 
  Shield, 
  Clock, 
  CheckCircle,
  ArrowRight,
  Monitor,
  Building2,
  Target,
  TrendingUp
} from "lucide-react";
import companyLogo from "@assets/WhatsApp Image 2024-11-30 at 13.08.33_1755505069008.jpeg";
import backgroundImage from "@assets/WhatsApp Image 2025-09-09 at 14.57.34 (1)_1757401303707.jpeg";

const features = [
  {
    icon: QrCode,
    title: "QR Code Generator",
    description: "Generate QR codes untuk setiap karyawan dengan keamanan token-based validation",
    color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
  },
  {
    icon: Scan,
    title: "QR Scanner",
    description: "Scan QR code untuk absensi real-time dengan validasi shift dan jam kerja",
    color: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
  },
  {
    icon: Users,
    title: "Manajemen Karyawan",
    description: "Data lengkap karyawan dengan NIK, posisi, departemen, dan investor group",
    color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
  },
  {
    icon: Calendar,
    title: "Roster Kerja",
    description: "Penjadwalan shift karyawan dengan sistem Shift 1 dan Shift 2",
    color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
  },
  {
    icon: Clock,
    title: "Manajemen Cuti",
    description: "Sistem pengajuan, persetujuan, dan monitoring cuti dengan analytics",
    color: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
  },
  {
    icon: Shield,
    title: "SIMPER Monitoring",
    description: "Monitoring BIB dan TIA license dengan tracking expiration dates",
    color: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400"
  },
  {
    icon: BarChart3,
    title: "Dashboard Analytics",
    description: "Real-time statistics, charts, dan performance tracking",
    color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
  },
  {
    icon: FileText,
    title: "Laporan PDF",
    description: "Generate laporan attendance dengan filter tanggal dan export PDF",
    color: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400"
  }
];

const stats = [
  { label: "Karyawan Aktif", value: "306+", icon: Users },
  { label: "QR Codes Generated", value: "10K+", icon: QrCode },
  { label: "Attendance Records", value: "50K+", icon: CheckCircle },
  { label: "System Uptime", value: "99.9%", icon: TrendingUp }
];

export default function Landing() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg overflow-hidden flex items-center justify-center">
                <img 
                  src={companyLogo} 
                  alt="OneTalent GECL Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">OneTalent GECL</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Employee Management System</p>
              </div>
            </div>
            
            <Link href="/workspace">
              <Button size="lg" className="bg-primary-600 hover:bg-primary-700">
                Masuk ke Workspace
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="relative py-20 px-4 min-h-[80vh] flex items-center"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Background Overlay */}
        <div className="absolute inset-0 bg-black/50 dark:bg-black/70"></div>
        
        {/* Content */}
        <div className="container mx-auto text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-6 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white">
              <Building2 className="w-4 h-4 mr-2" />
              PT. GECL - Sistem Manajemen Karyawan Terpadu
            </Badge>
            
            <h1 className="text-5xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
              Sistem Manajemen
              <span className="text-primary-400 block">OneTalent GECL</span>
            </h1>
            
            <p className="text-xl text-gray-100 mb-8 leading-relaxed drop-shadow-md">
              Platform komprehensif untuk manajemen karyawan dengan QR code attendance, 
              leave management, SIMPER monitoring, dan analytics real-time
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/workspace">
                <Button size="lg" className="bg-primary-600 hover:bg-primary-700 text-lg px-8 py-3 shadow-xl">
                  <Monitor className="mr-2 w-5 h-5" />
                  Akses Workspace
                </Button>
              </Link>
              <Link href="/workspace/scanner">
                <Button size="lg" variant="outline" className="text-lg px-8 py-3 bg-white/10 border-white text-white hover:bg-white hover:text-gray-900 backdrop-blur-sm">
                  <Scan className="mr-2 w-5 h-5" />
                  Quick Scan
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-white dark:bg-gray-800">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{stat.value}</div>
                  <div className="text-gray-600 dark:text-gray-400">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Fitur Unggulan
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Sistem terintegrasi dengan teknologi QR code untuk mengelola semua aspek 
              kepegawaian secara digital dan efisien
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card 
                  key={index}
                  className={`transition-all duration-300 cursor-pointer ${
                    hoveredCard === index ? 'transform scale-105 shadow-xl' : 'shadow-lg'
                  }`}
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <CardHeader className="pb-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${feature.color}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary-600 dark:bg-primary-700">
        <div className="container mx-auto text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-6">
              Siap Mengelola Karyawan dengan Lebih Efisien?
            </h2>
            <p className="text-xl text-primary-100 mb-8">
              Bergabunglah dengan OneTalent GECL dan rasakan kemudahan 
              manajemen karyawan yang terintegrasi dan modern
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/workspace">
                <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
                  <Target className="mr-2 w-5 h-5" />
                  Mulai Sekarang
                </Button>
              </Link>
              <Link href="/workspace/dashboard">
                <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-white text-white hover:bg-white hover:text-primary-600">
                  <BarChart3 className="mr-2 w-5 h-5" />
                  Lihat Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 dark:bg-gray-950">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-primary-600 rounded-lg overflow-hidden flex items-center justify-center">
                <img 
                  src={companyLogo} 
                  alt="OneTalent GECL Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="text-white font-semibold">OneTalent GECL</div>
                <div className="text-gray-400 text-sm">Employee Management System</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <Link href="/workspace/dashboard" className="text-gray-400 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link href="/workspace/employees" className="text-gray-400 hover:text-white transition-colors">
                Karyawan
              </Link>
              <Link href="/workspace/reports" className="text-gray-400 hover:text-white transition-colors">
                Laporan
              </Link>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400">
              © 2025 OneTalent GECL. All rights reserved. | PT. GECL Employee Management System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}