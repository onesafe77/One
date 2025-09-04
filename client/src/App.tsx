import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";

import { Workspace } from "@/components/workspace";
import MobileDriverView from "@/pages/mobile-driver-view";
import DriverView from "@/pages/driver-view";
import { Route, Switch } from "wouter";

/**
 * Router component tanpa authentication
 */
function Router() {
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  
  // Untuk mobile driver dan driver view dengan parameter NIK
  if ((currentPath === '/mobile-driver' || currentPath === '/driver-view') && urlParams.has('nik')) {
    return (
      <Switch>
        <Route path="/mobile-driver" component={MobileDriverView} />
        <Route path="/driver-view" component={DriverView} />
      </Switch>
    );
  }
  
  // Handle QR redirect
  if (currentPath === '/qr-redirect') {
    return (
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
    );
  }

  // Default: tampilkan workspace langsung tanpa auth check
  return <Workspace />;
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