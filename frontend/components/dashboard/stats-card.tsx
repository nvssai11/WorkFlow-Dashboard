import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    className?: string;
}

export function StatsCard({ label, value, icon: Icon, trend, trendUp, className }: StatsCardProps) {
    return (
        <div className={cn("rounded-xl border bg-card text-card-foreground p-6 shadow-sm", className)}>
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <div className="p-2 bg-secondary rounded-full">
                    <Icon size={16} className="text-primary" />
                </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">{value}</h3>
                {trend && (
                    <span className={cn("text-xs font-medium", trendUp ? "text-emerald-500" : "text-rose-500")}>
                        {trend}
                    </span>
                )}
            </div>
        </div>
    );
}
