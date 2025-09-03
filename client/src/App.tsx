import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";

import { useAuth } from "@/hooks/useAuth";
import { Workspace } from "@/components/workspace";
import Landing from "@/pages/landing";

/**
 * Router component that handles the two-page structure
 */
function Router() {
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