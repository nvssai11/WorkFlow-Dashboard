import { Status } from "@/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Loader2, Clock, GitCommit, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type StatusConfig = {
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
    spin?: boolean;
};

export function RunHeader({
    workflowName,
    status,
    commitHash,
    branch,
    trigger,
    duration
}: {
    workflowName: string;
    status: Status;
    commitHash: string;
    branch: string;
    trigger: string;
    duration: string;
}) {
    const statusConfig: Record<string, StatusConfig> = {
        success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", spin: false },
        failed: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20", spin: false },
        running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", spin: true },
        queued: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", spin: false },
    };

    const StatusIcon = statusConfig[status].icon;

    return (
        <div className="flex flex-col gap-6 border-b pb-6">
            <div className="flex items-center gap-4">
                <Link href="/runs" className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
                    <ArrowLeft size={18} />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{workflowName}</h1>
                        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium border", statusConfig[status].bg, statusConfig[status].color)}>
                            <StatusIcon size={16} className={cn(statusConfig[status].spin && "animate-spin")} />
                            <span className="capitalize">{status}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <GitCommit size={14} />
                            <span className="font-mono text-foreground">{commitHash}</span>
                            <span className="text-muted-foreground/60">on</span>
                            <span className="font-medium text-foreground">{branch}</span>
                        </div>
                        <div>
                            Triggered by <span className="font-medium text-foreground">{trigger}</span>
                        </div>
                        <div>
                            Duration: <span className="font-medium text-foreground">{duration}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {status === 'failed' && (
                        <Button variant="default">
                            Re-run Failed Jobs
                        </Button>
                    )}
                    <Button variant="secondary">
                        Cancel Run
                    </Button>
                </div>
            </div>
        </div>
    );
}
