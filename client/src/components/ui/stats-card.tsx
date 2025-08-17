import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor: string;
  className?: string;
}

export function StatsCard({ title, value, icon, iconColor, className }: StatsCardProps) {
  return (
    <div className={cn("stats-card", className)} data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center">
        <div className={cn("stats-icon", iconColor)}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white" data-testid={`stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
