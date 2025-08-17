import { cn } from "@/lib/utils";
import { Check, Clock, Save } from "lucide-react";

interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved';
  className?: string;
}

export function AutoSaveIndicator({ status, className }: AutoSaveIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: Clock,
          text: 'Menyimpan draft...',
          className: 'text-yellow-600 dark:text-yellow-400'
        };
      case 'saved':
        return {
          icon: Check,
          text: 'Draft tersimpan',
          className: 'text-green-600 dark:text-green-400'
        };
      default:
        return {
          icon: Save,
          text: '',
          className: 'text-gray-400 dark:text-gray-500'
        };
    }
  };

  const { icon: Icon, text, className: statusClassName } = getStatusConfig();

  if (status === 'idle') return null;

  return (
    <div className={cn(
      "flex items-center gap-1 text-xs",
      statusClassName,
      className
    )}>
      <Icon className="w-3 h-3" />
      <span>{text}</span>
    </div>
  );
}