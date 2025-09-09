import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LoadingScreen } from "@/components/ui/loading-screen";

import Dashboard from "@/pages/dashboard";
import QRGenerator from "@/pages/qr-generator";
import Scanner from "@/pages/scanner";
import Employees from "@/pages/employees";
import Roster from "@/pages/roster";
import Leave from "@/pages/leave";
import LeaveRosterMonitoring from "@/pages/leave-roster-monitoring";
import SimperMonitoring from "@/pages/simper-monitoring";
import Reports from "@/pages/reports";
import Meetings from "@/pages/meetings";
import MeetingScanner from "@/pages/meeting-scanner";
import DriverView from "@/pages/driver-view";
import MobileDriverView from "@/pages/mobile-driver-view";
import EmployeePersonalData from "@/pages/employee-personal-data";
import NotFound from "@/pages/not-found";

const workspaceRoutes = [
  { path: "/workspace", component: Dashboard, title: "Dashboard Karyawan PT.GECL" },
  { path: "/workspace/dashboard", component: Dashboard, title: "Dashboard Karyawan PT.GECL" },
  { path: "/workspace/qr-generator", component: QRGenerator, title: "Generate QR Code" },
  { path: "/workspace/scanner", component: Scanner, title: "Scan QR Code" },
  { path: "/workspace/employees", component: Employees, title: "Data Karyawan" },
  { path: "/workspace/roster", component: Roster, title: "Roster Kerja" },
  { path: "/workspace/leave", component: Leave, title: "Manajemen Cuti" },
  { path: "/workspace/leave-roster-monitoring", component: LeaveRosterMonitoring, title: "Monitoring Roster Cuti" },
  { path: "/workspace/simper-monitoring", component: SimperMonitoring, title: "Monitoring SIMPER Karyawan" },
  { path: "/workspace/reports", component: Reports, title: "Laporan" },
  { path: "/workspace/meetings", component: Meetings, title: "Meeting Management" },
  { path: "/workspace/meeting-scanner", component: MeetingScanner, title: "Scan QR Meeting" },
  { path: "/workspace/driver-view", component: DriverView, title: "Driver View - Data Karyawan" },
  { path: "/workspace/mobile-driver", component: MobileDriverView, title: "Driver Mobile View" },
  { path: "/workspace/employee-personal", component: EmployeePersonalData, title: "Data Pribadi Karyawan" },
];

export function Workspace() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getCurrentTitle = () => {
    const currentPath = window.location.pathname;
    const route = workspaceRoutes.find(r => r.path === currentPath);
    return route?.title || "AttendanceQR Workspace";
  };

  // Show loading screen when entering workspace
  useEffect(() => {
    // Reset loading state when component mounts (when navigating to workspace)
    setIsLoading(true);
    
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500); // Loading screen akan tampil selama 2.5 detik

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative">
      {/* Loading Screen dengan conditional rendering yang lebih aman */}
      {isLoading && (
        <LoadingScreen 
          isLoading={isLoading} 
          onComplete={() => setIsLoading(false)}
        />
      )}
      
      {/* Workspace Content - selalu render tapi invisible saat loading */}
      <div 
        className={`h-screen flex bg-gray-50 dark:bg-gray-900 transition-opacity duration-300 ${
          isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          <Header 
            title={getCurrentTitle()} 
            onMenuClick={() => setSidebarOpen(true)} 
          />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
            <Switch>
              <Route path="/workspace" component={Dashboard} />
              <Route path="/workspace/dashboard" component={Dashboard} />
              <Route path="/workspace/qr-generator" component={QRGenerator} />
              <Route path="/workspace/scanner" component={Scanner} />
              <Route path="/workspace/employees" component={Employees} />
              <Route path="/workspace/roster" component={Roster} />
              <Route path="/workspace/leave" component={Leave} />
              <Route path="/workspace/leave-roster-monitoring" component={LeaveRosterMonitoring} />
              <Route path="/workspace/simper-monitoring" component={SimperMonitoring} />
              <Route path="/workspace/reports" component={Reports} />
              <Route path="/workspace/meetings" component={Meetings} />
              <Route path="/workspace/meeting-scanner" component={MeetingScanner} />
              <Route path="/workspace/driver-view" component={DriverView} />
              <Route path="/workspace/mobile-driver" component={MobileDriverView} />
              <Route path="/workspace/employee-personal" component={EmployeePersonalData} />
              <Route component={Dashboard} />
            </Switch>
          </main>
        </div>
      </div>
    </div>
  );
}