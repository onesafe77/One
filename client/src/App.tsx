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
  const { isAuthenticated, isLoading } = useAuth();

  // Cek apakah ada akses publik untuk driver view (scan QR)
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const hasNikParam = urlParams.has('nik');
  const hasQrParam = urlParams.has('data') || urlParams.has('qr');
  
  const isPublicDriverAccess = (
    (currentPath === '/mobile-driver' && hasNikParam) ||
    (currentPath === '/driver-view' && hasNikParam) ||
    (currentPath === '/qr-redirect' && hasQrParam)
  );

  // Jika akses driver view publik (dari QR scan), tampilkan tanpa auth
  if (isPublicDriverAccess) {
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
      </Switch>
    );
  }

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