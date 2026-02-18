import Link from "next/link";
import { recentRuns } from "@/data/mock-dashboard";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Loader2, Clock, GitCommit } from "lucide-react";

type StatusConfig = {
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
    spin?: boolean;
};

const statusConfig: Record<string, StatusConfig> = {
    success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", spin: false },
    failed: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20", spin: false },
    running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", spin: true },
    queued: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", spin: false },
};

export function RecentRunsTable() {
    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div className="p-6 border-b">
                <h3 className="font-semibold">Recent Workflow Runs</h3>
                <p className="text-sm text-muted-foreground">Latest execution status across all projects</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium">
                        <tr>
                            <th className="px-6 py-3">Workflow</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Trigger</th>
                            <th className="px-6 py-3">Branch</th>
                            <th className="px-6 py-3">Duration</th>
                            <th className="px-6 py-3 text-right">Time</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {recentRuns.map((run) => {
                            const status = statusConfig[run.status];
                            const StatusIcon = status.icon;
                            return (
                                <tr key={run.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4 font-medium">{run.workflowName}</td>
                                    <td className="px-6 py-4">
                                        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border w-fit", status.bg, status.color)}>
                                            <StatusIcon size={14} className={cn(status.spin && "animate-spin")} />
                                            <span className="capitalize">{run.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground capitalize">{run.trigger}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-xs">
                                            <GitCommit size={12} />
                                            <span>{run.branch}</span>
                                            <span className="opacity-50">#</span>
                                            <span>{run.commitHash}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">{run.duration}</td>
                                    <td className="px-6 py-4 text-right text-muted-foreground">{run.timestamp}</td>
                                    <td className="px-6 py-4 text-right">
                                        <Link href="/logs" className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
                                            Logs
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
