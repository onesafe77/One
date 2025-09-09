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
  
  return (
    <Switch>
      {/* Landing Page */}
      <Route path="/" component={Landing} />
      
      {/* Mobile Driver dan Driver View dengan parameter NIK */}
      <Route path="/mobile-driver">
        {() => urlParams.has('nik') ? <MobileDriverView /> : <div>Parameter NIK required</div>}
      </Route>
      <Route path="/driver-view">
        {() => urlParams.has('nik') ? <DriverView /> : <div>Parameter NIK required</div>}
      </Route>
      
      {/* QR Redirect */}
      <Route path="/qr-redirect">
        {() => {
          const qrData = urlParams.get('data') || urlParams.get('qr');
          if (qrData) {
            try {
              const parsedData = JSON.parse(decodeURIComponent(qrData));
              if (parsedData.id) {
                window.location.href = `/mobile-driver?nik=${parsedData.id}`;
              }
            } catch (error) {
              console.error('Invalid QR data:', error);
            }
          }
          return <div>Redirecting...</div>;
        }}
      </Route>
      
      {/* Workspace - semua route yang dimulai dengan /workspace */}
      <Route path="/workspace/:rest*" component={Workspace} />
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