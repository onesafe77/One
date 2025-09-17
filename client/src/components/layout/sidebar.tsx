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
  const [hasImageError, setHasImageError] = useState(false);

  if (hasImageError) {
    return (
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <QrCode className="w-5 h-5 text-white" />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center overflow-hidden">
      <img 
        src={companyLogo} 
        alt="Company Logo" 
        className="w-full h-full object-cover"
        onError={() => setHasImageError(true)}
      />
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
              OneTalent GECL
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
