import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Check, ArrowRight } from "lucide-react";

export default function Landing() {
  const benefits = [
    "Sistem absensi digital yang akurat",
    "Manajemen karyawan terintegrasi", 
    "Laporan real-time dan analytics",
    "Interface yang user-friendly",
    "Keamanan data tingkat enterprise"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-6 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Logo Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-red-600 rounded-2xl mb-8 shadow-lg shadow-red-600/25">
              <QrCode className="w-12 h-12 text-white" />
            </div>

            {/* Main Title */}
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
              Attendance<span className="text-red-600">QR</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 mb-16 leading-relaxed max-w-3xl mx-auto font-light">
              Sistem manajemen kehadiran karyawan modern dengan teknologi QR Code untuk tracking yang akurat dan efisien
            </p>
          </div>

          {/* Benefits Section */}
          <div className="mb-16">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
              <CardContent className="p-8 lg:p-12">
                <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
                  {benefits.map((benefit, index) => (
                    <div 
                      key={index} 
                      className="flex items-start space-x-4 group"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors duration-200">
                          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <p className="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                        {benefit}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <Button 
              size="lg" 
              className="px-12 py-6 text-xl font-bold bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-xl shadow-red-600/25 hover:shadow-2xl hover:shadow-red-600/30 transition-all duration-300 hover:scale-105 inline-flex items-center space-x-3 group"
              onClick={() => window.location.href = '/api/login'}
            >
              <span>Mulai Sekarang</span>
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
            </Button>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-6 font-medium">
              Login untuk mengakses semua fitur
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}