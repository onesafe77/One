import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";

import { Workspace } from "@/components/workspace";
import Landing from "@/pages/landing";
import MobileDriverView from "@/pages/mobile-driver-view";
import DriverView from "@/pages/driver-view";
import { Route, Switch } from "wouter";

/**
 * Router component dengan landing page dan workspace
 */
function Router() {
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  
  // Prioritaskan workspace routes - selalu render Workspace untuk path yang dimulai dengan /workspace
  if (currentPath.startsWith('/workspace')) {
    return <Workspace key={currentPath} />; // key memastikan component remount saat path berubah
  }
  
  return (
    <Switch>
      {/* Compact QR Route Handler */}
      <Route path="/q/:token">
        {(params) => {
          // This route will be handled by server-side redirect
          // But we add this for fallback if needed
          window.location.reload();
          return <div>Processing QR code...</div>;
        }}
      </Route>
      
      {/* Mobile Driver dan Driver View dengan parameter NIK */}
      <Route path="/mobile-driver">
        {() => {
          const params = new URLSearchParams(window.location.search);
          return params.has('nik') ? <MobileDriverView /> : <div>Parameter NIK required</div>;
        }}
      </Route>
      <Route path="/driver-view">
        {() => {
          const params = new URLSearchParams(window.location.search);
          return params.has('nik') ? <DriverView /> : <div>Parameter NIK required</div>;
        }}
      </Route>
      
      {/* Meeting Scanner Route */}
      <Route path="/meeting-scanner">
        {() => {
          const token = urlParams.get('token');
          if (token) {
            window.location.href = `/workspace/meeting-scanner?token=${token}`;
          } else {
            window.location.href = `/workspace/meeting-scanner`;
          }
          return <div>Redirecting to meeting scanner...</div>;
        }}
      </Route>
      
      {/* QR Redirect */}
      <Route path="/qr-redirect">
        {() => {
          const qrData = urlParams.get('data') || urlParams.get('qr');
          if (qrData) {
            try {
              const parsedData = JSON.parse(decodeURIComponent(qrData));
              
              // Handle meeting QR codes
              if (parsedData.type === "meeting" && parsedData.token) {
                window.location.href = `/workspace/meeting-scanner?token=${parsedData.token}`;
                return <div>Redirecting to meeting scanner...</div>;
              }
              
              // Handle employee attendance QR codes
              if (parsedData.id) {
                window.location.href = `/mobile-driver?nik=${parsedData.id}`;
                return <div>Redirecting to attendance...</div>;
              }
            } catch (error) {
              console.error('Invalid QR data:', error);
            }
          }
          return <div>Invalid QR code data</div>;
        }}
      </Route>
      
      {/* Landing Page */}
      <Route path="/" component={Landing} />
      
      {/* Catch-all redirect untuk direct access ke workspace pages */}
      <Route path="/:rest*">
        {(params) => {
          const currentPath = params['rest*'] ? `/${params['rest*']}` : '/';
          // Redirect ke workspace dengan path yang sama
          if (currentPath !== '/') {
            window.location.replace(`/workspace${currentPath}${window.location.search}`);
            return <div>Redirecting to workspace...</div>;
          }
          return <div>Page not found</div>;
        }}
      </Route>
    </Switch>
  );
}

/**
 * Aplikasi AttendanceQR - Aplikasi Publik Tanpa Authentication:
 * - Workspace utama berisi semua fitur aplikasi
 * - Mobile driver view untuk QR scan
 * - Driver view untuk tampilan desktop
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="attendance-theme">
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;