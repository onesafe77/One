import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";

import { useAuth } from "@/hooks/useAuth";
import { Workspace } from "@/components/workspace";
import Landing from "@/pages/landing";
import MobileDriverView from "@/pages/mobile-driver-view";
import DriverView from "@/pages/driver-view";
import { Route, Switch } from "wouter";

/**
 * Router component that handles the two-page structure
 */
function Router() {
  // Cek akses publik PERTAMA sebelum auth check
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  
  // Jika ada parameter NIK atau QR data, berikan akses publik
  if (urlParams.has('nik') || urlParams.has('data') || urlParams.has('qr')) {
    console.log('Public access detected, bypassing auth');
    return (
      <Switch>
        <Route path="/mobile-driver" component={MobileDriverView} />
        <Route path="/driver-view" component={DriverView} />
        <Route path="/qr-redirect">
          {() => {
            // Redirect handler untuk QR scan
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
        {/* Fallback untuk path lain dengan parameter, redirect ke mobile driver */}
        <Route>
          {() => {
            const nikParam = urlParams.get('nik');
            if (nikParam) {
              return <MobileDriverView />;
            }
            return <div>Invalid access</div>;
          }}
        </Route>
      </Switch>
    );
  }

  const { isAuthenticated, isLoading } = useAuth();

  // Halaman 1: Landing (Sebelum Login)
  if (isLoading || !isAuthenticated) {
    return <Landing />;
  }

  // Halaman 2: Workspace (Setelah Login) 
  return <Workspace />;
}

/**
 * Aplikasi AttendanceQR - Dua Halaman Utama:
 * 1. Landing Page - Untuk pengguna yang belum login  
 * 2. Workspace - Untuk pengguna yang sudah login (berisi semua fitur aplikasi)
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