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
            setFadeOut(false); // Reset fadeOut state
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

  // Hanya render ketika isLoading true, atau ketika fadeOut sedang berlangsung
  if (!isLoading && !fadeOut) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center overflow-hidden",
        "bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900",
        "transition-all duration-500 ease-in-out",
        fadeOut ? "opacity-0 scale-105" : "opacity-100 scale-100",
        className
      )}
    >
      {/* Glass morphism container */}
      <div className="relative backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 rounded-3xl p-12 shadow-2xl max-w-md w-full mx-4">
        
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl blur-xl animate-pulse" />
        
        <div className="relative flex flex-col items-center space-y-10">
          
          {/* Logo dengan animasi yang lebih menarik */}
          <div className="flex flex-col items-center space-y-6">
            <div className="relative group">
              {/* Main logo dengan glass effect */}
              <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-600 animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <span className="text-white font-bold text-3xl tracking-wider drop-shadow-lg">PT</span>
                </div>
              </div>
              
              {/* Orbiting particles */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '10s' }}>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/50" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50" />
              </div>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }}>
                <div className="absolute top-1/2 -right-2 w-1 h-1 bg-green-400 rounded-full shadow-lg shadow-green-400/50" />
                <div className="absolute top-1/2 -left-2 w-1 h-1 bg-pink-400 rounded-full shadow-lg shadow-pink-400/50" />
              </div>
            </div>
            
            <div className="text-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent mb-2 animate-pulse">
                OneTalent GECL
              </h1>
              <p className="text-lg text-gray-300 font-medium tracking-wide">
                Employee Attendance System
              </p>
            </div>
          </div>

          {/* Enhanced Loading Animation */}
          <div className="flex flex-col items-center space-y-8">
            
            {/* Artistic Progress Circle */}
            <div className="relative w-36 h-36 group">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 to-purple-500/30 animate-spin" style={{ animationDuration: '3s' }} />
              
              {/* Main progress circle */}
              <div className="relative w-full h-full">
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="6"
                    fill="none"
                  />
                  
                  {/* Progress arc with gradient */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="url(#gradient)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out drop-shadow-lg"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
                  />
                  
                  {/* Define gradient */}
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="50%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* Enhanced percentage display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white drop-shadow-lg">
                    {Math.round(progress)}%
                  </span>
                  <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent mt-2 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Sophisticated loading dots */}
            <div className="flex space-x-3">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="relative"
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-white to-gray-300 animate-bounce shadow-lg" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-gradient-to-br from-red-400/60 to-purple-400/60 animate-pulse" />
                </div>
              ))}
            </div>

            {/* Premium loading text */}
            <div className="text-center space-y-2">
              <p className="text-xl font-semibold text-white drop-shadow-lg animate-pulse">
                {progress < 50 ? 'Memuat Workspace...' : progress < 90 ? 'Menyiapkan Dashboard...' : 'Hampir Selesai...'}
              </p>
              <p className="text-sm text-gray-300 tracking-wide">
                {progress < 30 ? 'Menginisialisasi sistem' : 
                 progress < 60 ? 'Memuat data karyawan' : 
                 progress < 90 ? 'Menyiapkan interface' : 
                 'Finalisasi loading'}
              </p>
              
              {/* Loading progress bar */}
              <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full bg-gradient-to-r from-red-400 to-yellow-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Elegant bottom decoration */}
          <div className="flex justify-center items-center space-x-2 mt-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="rounded-full bg-gradient-to-t from-white/40 to-white/80"
                style={{
                  width: i === 3 ? '8px' : i === 2 || i === 4 ? '6px' : '4px',
                  height: i === 3 ? '8px' : i === 2 || i === 4 ? '6px' : '4px',
                  animation: `pulse 2s infinite ease-in-out`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced background effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-red-500/20 to-purple-500/20 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-500/15 to-teal-500/15 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-yellow-500/10 to-red-500/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Floating particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              transform: `translateY(${Math.sin(i) * 10}px)`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
      
    </div>
  );
}