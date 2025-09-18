import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Users,
  QrCode,
  Scan,
  Calendar,
  FileText,
  BarChart3,
  ClipboardList,
  User,
  Clock,
  Monitor,
  Video,
  Smartphone,
  Shield
} from "lucide-react";
import companyLogo from "@assets/WhatsApp Image 2024-11-30 at 13.08.33_1755505069008.jpeg";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/workspace", icon: BarChart3 },
  { name: "Generate QR", href: "/workspace/qr-generator", icon: QrCode },
  { name: "Scan QR", href: "/workspace/scanner", icon: Scan },
  { name: "Karyawan", href: "/workspace/employees", icon: Users },
  { name: "Roster", href: "/workspace/roster", icon: Calendar },
  { name: "Cuti", href: "/workspace/leave", icon: ClipboardList },
  { name: "Monitoring Roster Cuti", href: "/workspace/leave-roster-monitoring", icon: Monitor },
  { name: "Monitoring SIMPER", href: "/workspace/simper-monitoring", icon: Shield },
  { name: "Meeting Management", href: "/workspace/meetings", icon: Video },
  { name: "Scan QR Meeting", href: "/workspace/meeting-scanner", icon: Smartphone },
  { name: "Driver View", href: "/workspace/driver-view", icon: User },
  { name: "Laporan", href: "/workspace/reports", icon: FileText },
];

function LogoWithFallback() {
  return (
    <div className="w-10 h-10 relative">
      {/* Modern AbsensiQR Logo */}
      <div className="w-full h-full bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
        <div className="relative">
          {/* QR Pattern Background */}
          <div className="absolute inset-0 grid grid-cols-3 gap-0.5 opacity-30">
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-1 bg-transparent"></div>
            <div className="w-1 h-1 bg-transparent"></div>
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-1 bg-transparent"></div>
            <div className="w-1 h-1 bg-white rounded-sm"></div>
          </div>
          {/* Main Icon */}
          <QrCode className="w-5 h-5 text-white relative z-10" strokeWidth={2.5} />
        </div>
      </div>
      {/* Badge/Indicator */}
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
        <div className="w-2 h-2 bg-white rounded-full"></div>
      </div>
    </div>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden bg-gray-600 bg-opacity-75"
          onClick={onClose}
        />
      )}
      {/* Modern Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Clean Logo Section */}
        <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <LogoWithFallback />
            <Link href="/" className="text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              AbsensiQR
            </Link>
          </div>
        </div>
        
        {/* Modern Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + '/');
            const IconComponent = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" 
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                )}
                data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    onClose();
                  }
                }}
              >
                <IconComponent className="w-4 h-4 mr-3 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
