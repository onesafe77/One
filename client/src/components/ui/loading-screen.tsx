import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  isLoading: boolean;
  onComplete?: () => void;
  className?: string;
}

export function LoadingScreen({ isLoading, onComplete, className }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    let progressInterval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const startLoading = () => {
      setProgress(0);
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 100);

      // Simulate minimum loading time
      timeoutId = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(() => {
            onComplete?.();
          }, 500);
        }, 300);
      }, 2000);
    };

    startLoading();

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
    };
  }, [isLoading, onComplete]);

  if (!isLoading && !fadeOut) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-gradient-to-br from-red-50 via-white to-red-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950",
        "transition-opacity duration-300",
        fadeOut ? "opacity-0" : "opacity-100",
        className
      )}
    >
      <div className="flex flex-col items-center space-y-8 p-8">
        
        {/* Logo dan Company Name */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <div className="text-white font-bold text-2xl">PT</div>
              <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-500 rounded-2xl animate-pulse opacity-75" />
            </div>
            
            {/* Floating particles animation */}
            <div className="absolute -top-2 -right-2 w-3 h-3 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="absolute -bottom-1 -left-2 w-2 h-2 bg-red-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            <div className="absolute top-4 -right-4 w-1 h-1 bg-red-200 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
              OneTalent GECL
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
              Employee Attendance System
            </p>
          </div>
        </div>

        {/* Loading Animation */}
        <div className="flex flex-col items-center space-y-6">
          
          {/* Circular Progress */}
          <div className="relative w-32 h-32">
            {/* Background circle */}
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                className="text-red-500 transition-all duration-300 ease-out"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              />
            </svg>
            
            {/* Percentage text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-700 dark:text-white">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Loading dots */}
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>

          {/* Loading text */}
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200 animate-pulse">
              {progress < 50 ? 'Memuat Workspace...' : progress < 90 ? 'Menyiapkan Dashboard...' : 'Hampir Selesai...'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {progress < 30 ? 'Menginisialisasi sistem' : 
               progress < 60 ? 'Memuat data karyawan' : 
               progress < 90 ? 'Menyiapkan interface' : 
               'Finalisasi loading'}
            </p>
          </div>
        </div>

        {/* Bottom decorative elements */}
        <div className="flex space-x-1 mt-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-8 bg-gradient-to-t from-red-200 to-red-400 rounded-full"
              style={{
                animation: `pulse 1.5s infinite ease-in-out`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 dark:opacity-10">
        <div className="absolute top-20 left-20 w-40 h-40 bg-red-300 rounded-full mix-blend-multiply filter blur-xl animate-pulse" />
        <div className="absolute top-40 right-20 w-40 h-40 bg-red-200 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-8 left-20 w-40 h-40 bg-red-100 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  );
}