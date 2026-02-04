import { AlertTriangle, RefreshCcw, Slack, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Detection {
    id: string;
    workflow: string;
    issue: string;
    action: "retried" | "notified" | "resolved";
    time: string;
    slackMessage?: string;
}

const detections: Detection[] = [
    {
        id: "1",
        workflow: "Build Frontend",
        issue: "npm install timeout",
        action: "retried",
        time: "45 mins ago",
        slackMessage: "Detected timeout in `Build Frontend`. Retrying attempt 1/3..."
    },
    {
        id: "2",
        workflow: "E2E Tests",
        issue: "Flaky test: Checkout Flow",
        action: "resolved",
        time: "2 hours ago",
        slackMessage: "Flaky test detected. Validated 2nd run success. Marked as stable."
    },
    {
        id: "3",
        workflow: "Deploy API",
        issue: "Docker registry unavailable",
        action: "notified",
        time: "5 hours ago",
        slackMessage: "Critical: Registry unreachable. Manual intervention required. @oncall"
    },
];

export function DetectionList() {
    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Recent Detections & Actions</h3>
            <div className="grid gap-4">
                {detections.map((detection) => (
                    <div key={detection.id} className="rounded-xl border bg-card p-6 flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">{detection.workflow}</span>
                                <span className="text-muted-foreground text-sm">• {detection.time}</span>
                            </div>
                            <div className="flex items-start gap-2 text-rose-500 text-sm font-medium">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                {detection.issue}
                            </div>

                            <div className="flex items-center gap-2 mt-4">
                                <span className={cn(
                                    "text-xs px-2 py-1 rounded-full border font-medium uppercase",
                                    detection.action === "retried" && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                                    detection.action === "resolved" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                    detection.action === "notified" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                                )}>
                                    {detection.action}
                                </span>
                            </div>
                        </div>

                        {/* Slack Preview */}
                        <div className="md:w-96 bg-[#1a1d21] rounded-lg border border-white/5 p-4 text-sm font-sans">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="bg-emerald-500 rounded p-0.5">
                                    <Slack size={12} className="text-white" />
                                </div>
                                <span className="font-bold text-white text-xs">DevOps-Bot</span>
                                <span className="text-[10px] text-gray-500">APP</span>
                            </div>
                            <div className="text-[#d1d2d3] leading-relaxed text-xs">
                                {detection.slackMessage}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
