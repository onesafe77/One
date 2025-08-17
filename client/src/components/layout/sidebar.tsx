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
  User
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Generate QR", href: "/qr-generator", icon: QrCode },
  { name: "Scan QR", href: "/scanner", icon: Scan },
  { name: "Karyawan", href: "/employees", icon: Users },
  { name: "Roster", href: "/roster", icon: Calendar },
  { name: "Cuti", href: "/leave", icon: ClipboardList },
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
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <QrCode className="w-5 h-5 text-primary-600" />
            </div>
            <span className="text-xl font-bold text-white">Attendance GECL</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="mt-8 px-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
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
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        {/* User Info */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Admin User</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">admin@company.com</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
