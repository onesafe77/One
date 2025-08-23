import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
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
import Reports from "@/pages/reports";
import AttendanceDetails from "@/pages/attendance-details";
import WhatsAppBlast from "@/pages/whatsapp-blast";
import Meetings from "@/pages/meetings";
import MeetingScanner from "@/pages/meeting-scanner";
import DriverView from "@/pages/driver-view";

import NotFound from "@/pages/not-found";

const routes = [
  { path: "/", component: Dashboard, title: "Dashboard Karyawan PT.GECL" },
  { path: "/qr-generator", component: QRGenerator, title: "Generate QR Code" },
  { path: "/scanner", component: Scanner, title: "Scan QR Code" },
  { path: "/employees", component: Employees, title: "Data Karyawan" },
  { path: "/roster", component: Roster, title: "Roster Kerja" },
  { path: "/leave", component: Leave, title: "Manajemen Cuti" },
  { path: "/leave-roster-monitoring", component: LeaveRosterMonitoring, title: "Monitoring Roster Cuti" },
  { path: "/reports", component: Reports, title: "Laporan" },
  { path: "/attendance-details", component: AttendanceDetails, title: "Dashboard HR " },
  { path: "/whatsapp-blast", component: WhatsAppBlast, title: "Blast WhatsApp" },
  { path: "/meetings", component: Meetings, title: "Meeting Management" },
  { path: "/meeting-scanner", component: MeetingScanner, title: "Scan QR Meeting" },
  { path: "/driver-view", component: DriverView, title: "Driver View - Data Karyawan" },
];

function Router() {
  return (
    <Switch>
      {routes.map((route) => (
        <Route key={route.path} path={route.path} component={route.component} />
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getCurrentTitle = () => {
    const currentPath = window.location.pathname;
    const route = routes.find(r => r.path === currentPath);
    return route?.title || "AttendanceQR";
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="attendance-theme">
        <TooltipProvider>
          <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <div className="flex-1 flex flex-col lg:ml-0">
              <Header 
                title={getCurrentTitle()} 
                onMenuClick={() => setSidebarOpen(true)} 
              />
              
              <main className="flex-1 p-6 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
          
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
