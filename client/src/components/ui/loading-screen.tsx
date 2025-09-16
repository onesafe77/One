import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  isLoading: boolean;
  onComplete?: () => void;
  className?: string;
}

export function LoadingScreen({ isLoading, onComplete, className }: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    let timeoutId: NodeJS.Timeout;

    const startLoading = () => {
      // Simple loading time
      timeoutId = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          setFadeOut(false); // Reset fadeOut state
          onComplete?.();
        }, 300);
      }, 1500);
    };

    startLoading();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isLoading, onComplete]);

  // Hanya render ketika isLoading true, atau ketika fadeOut sedang berlangsung
  if (!isLoading && !fadeOut) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-white dark:bg-gray-900",
        "transition-opacity duration-300 ease-in-out",
        fadeOut ? "opacity-0" : "opacity-100",
        className
      )}
    >
      <div className="flex flex-col items-center space-y-6">
        
        {/* Logo simple */}
        <div className="w-16 h-16 bg-[#E53935] rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-xl">PT</span>
        </div>
        
        {/* Brand name */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
            OneTalent GECL
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Employee Attendance System
          </p>
        </div>

        {/* Simple loading spinner */}
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E53935]"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Memuat aplikasi...
          </p>
        </div>
        
      </div>
    </div>
  );
}