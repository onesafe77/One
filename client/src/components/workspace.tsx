import { Switch, Route } from "wouter";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

import Dashboard from "@/pages/dashboard";
import QRGenerator from "@/pages/qr-generator";
import Scanner from "@/pages/scanner";
import Employees from "@/pages/employees";
import Roster from "@/pages/roster";
import Leave from "@/pages/leave";
import LeaveRosterMonitoring from "@/pages/leave-roster-monitoring";
import SimperMonitoring from "@/pages/simper-monitoring";
import Reports from "@/pages/reports";
import AttendanceDetails from "@/pages/attendance-details";
import Meetings from "@/pages/meetings";
import MeetingScanner from "@/pages/meeting-scanner";
import DriverView from "@/pages/driver-view";
import MobileDriverView from "@/pages/mobile-driver-view";
import EmployeePersonalData from "@/pages/employee-personal-data";
import NotFound from "@/pages/not-found";

const workspaceRoutes = [
  { path: "/", component: Dashboard, title: "Dashboard Karyawan PT.GECL" },
  { path: "/qr-generator", component: QRGenerator, title: "Generate QR Code" },
  { path: "/scanner", component: Scanner, title: "Scan QR Code" },
  { path: "/employees", component: Employees, title: "Data Karyawan" },
  { path: "/roster", component: Roster, title: "Roster Kerja" },
  { path: "/leave", component: Leave, title: "Manajemen Cuti" },
  { path: "/leave-roster-monitoring", component: LeaveRosterMonitoring, title: "Monitoring Roster Cuti" },
  { path: "/simper-monitoring", component: SimperMonitoring, title: "Monitoring SIMPER Karyawan" },
  { path: "/reports", component: Reports, title: "Laporan" },
  { path: "/attendance-details", component: AttendanceDetails, title: "Dashboard HR " },
  { path: "/meetings", component: Meetings, title: "Meeting Management" },
  { path: "/meeting-scanner", component: MeetingScanner, title: "Scan QR Meeting" },
  { path: "/driver-view", component: DriverView, title: "Driver View - Data Karyawan" },
  { path: "/mobile-driver", component: MobileDriverView, title: "Driver Mobile View" },
  { path: "/employee-personal", component: EmployeePersonalData, title: "Data Pribadi Karyawan" },
  { path: "/qr-redirect", component: () => <div>Loading...</div>, title: "QR Redirect" },
];

export function Workspace() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getCurrentTitle = () => {
    const currentPath = window.location.pathname;
    const route = workspaceRoutes.find(r => r.path === currentPath);
    return route?.title || "AttendanceQR Workspace";
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header 
          title={getCurrentTitle()} 
          onMenuClick={() => setSidebarOpen(true)} 
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
          <Switch>
            {workspaceRoutes.map((route) => (
              <Route key={route.path} path={route.path} component={route.component} />
            ))}
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}