import { GitBranch, Play, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Status } from "@/types";

interface WorkflowCardProps {
    name: string;
    lastRunStatus: Status;
    trigger: string;
    lastRunTime: string;
}

const statusColor = {
    success: "bg-emerald-500",
    failed: "bg-rose-500",
    running: "bg-blue-500 animate-pulse",
    queued: "bg-yellow-500",
};

export function WorkflowCard({ name, lastRunStatus, trigger, lastRunTime }: WorkflowCardProps) {
    return (
        <div className="group rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all hover:border-primary/50">
            <div className="p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-secondary text-secondary-foreground">
                            <GitBranch size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold group-hover:text-primary transition-colors">{name}</h3>
                            <p className="text-sm text-muted-foreground capitalize flex items-center gap-2 mt-1">
                                <span className={cn("w-2 h-2 rounded-full", statusColor[lastRunStatus])} />
                                {lastRunStatus}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" title="Run Workflow">
                            <Play size={18} />
                        </button>
                        <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" title="Rebuild">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{trigger}</span>
                        <span>trigger</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        <span>{lastRunTime}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
