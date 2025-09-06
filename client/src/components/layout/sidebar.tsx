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
  Smartphone
} from "lucide-react";
import companyLogo from "@assets/WhatsApp Image 2024-11-30 at 13.08.33_1755505069008.jpeg";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Generate QR", href: "/qr-generator", icon: QrCode },
  { name: "Scan QR", href: "/scanner", icon: Scan },
  { name: "Detail Kehadiran", href: "/attendance-details", icon: Clock },
  { name: "Karyawan", href: "/employees", icon: Users },
  { name: "Roster", href: "/roster", icon: Calendar },
  { name: "Cuti", href: "/leave", icon: ClipboardList },
  { name: "Monitoring Roster Cuti", href: "/leave-roster-monitoring", icon: Monitor },
  { name: "Meeting Management", href: "/meetings", icon: Video },
  { name: "Scan QR Meeting", href: "/meeting-scanner", icon: Smartphone },
  { name: "Driver View", href: "/driver-view", icon: User },
  { name: "Laporan", href: "/reports", icon: FileText },
];

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
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-4 bg-primary-600 dark:bg-primary-700">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-white rounded-lg overflow-hidden flex items-center justify-center">
              <img 
                src={companyLogo} 
                alt="Company Logo" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to QR icon if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (target.parentElement) {
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.className = 'w-5 h-5 text-primary-600 flex items-center justify-center';
                    const qrIcon = document.createElement('svg');
                    qrIcon.innerHTML = '<path d="M3 3h6v6H3V3zM15 3h6v6h-6V3zM3 15h6v6H3v-6zM15 15h6v6h-6v-6z" stroke="currentColor" fill="none" stroke-width="2"/>';
                    qrIcon.setAttribute('viewBox', '0 0 24 24');
                    qrIcon.className = 'w-full h-full';
                    fallbackDiv.appendChild(qrIcon);
                    target.parentElement.appendChild(fallbackDiv);
                  }
                }}
              />
            </div>
            <span className="text-xl font-bold text-white">Attendance GECL</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="mt-8 px-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const IconComponent = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "nav-item flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  isActive && "active"
                )}
                data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    onClose();
                  }
                }}
              >
                <IconComponent className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
