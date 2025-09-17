import { Menu, Sun, Moon, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { Link } from "wouter";
import { useState, useEffect } from "react";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    // Gunakan tanggal lokal browser tanpa konversi timezone
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    // Gunakan waktu lokal browser tanpa konversi timezone
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden mr-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onMenuClick}
            data-testid="menu-button"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="page-title">
            {title}
          </h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="text-right hidden sm:block" data-testid="datetime-display">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(currentTime)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(currentTime)}
            </p>
          </div>
          
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="Back to Landing Page"
              data-testid="link-home"
            >
              <Home className="w-4 h-4" />
            </Button>
          </Link>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            data-testid="theme-toggle"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
