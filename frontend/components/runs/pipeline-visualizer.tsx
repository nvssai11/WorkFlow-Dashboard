import { CheckCircle2, Circle, Clock, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StepStatus = "completed" | "running" | "failed" | "pending" | "skipped";

interface Step {
    id: string;
    name: string;
    status: StepStatus;
    duration?: string;
}

const steps: Step[] = [
    { id: "1", name: "Code Push", status: "completed", duration: "2s" },
    { id: "2", name: "Build", status: "completed", duration: "1m 30s" },
    { id: "3", name: "Docker Image", status: "running", duration: "45s" },
    { id: "4", name: "Registry Push", status: "pending" },
    { id: "5", name: "Deployment", status: "pending" },
];

type StepConfig = {
    icon: typeof CheckCircle2;
    color: string;
    border: string;
    bg: string;
    spin?: boolean;
};

const stepConfig: Record<string, StepConfig> = {
    completed: { icon: CheckCircle2, color: "text-emerald-500", border: "border-emerald-500", bg: "bg-emerald-500/10", spin: false },
    failed: { icon: XCircle, color: "text-rose-500", border: "border-rose-500", bg: "bg-rose-500/10", spin: false },
    running: { icon: Loader2, color: "text-blue-500", border: "border-blue-500", bg: "bg-blue-500/10", spin: true },
    pending: { icon: Circle, color: "text-muted-foreground", border: "border-border", bg: "bg-secondary/50", spin: false },
    skipped: { icon: Circle, color: "text-muted-foreground", border: "border-border", bg: "bg-secondary/50", spin: false },
};

export function PipelineVisualizer() {
    return (
        <div className="py-12">
            <div className="relative flex items-center justify-between max-w-4xl mx-auto">
                {/* Connection Line */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-border -z-10" />

                {steps.map((step) => {
                    const config = stepConfig[step.status];
                    const Icon = config.icon;
                    const isPending = step.status === "pending" || step.status === "skipped";

                    return (
                        <div key={step.id} className="relative flex flex-col items-center bg-background px-2">
                            <div
                                className={cn(
                                    "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all bg-background z-10",
                                    config.border,
                                    config.color,
                                    config.bg
                                )}
                            >
                                <Icon size={20} className={cn(config.spin && "animate-spin")} />
                            </div>

                            <div className="absolute top-14 left-1/2 -translate-x-1/2 flex flex-col items-center w-32 text-center">
                                <span className={cn("text-sm font-medium", isPending ? "text-muted-foreground" : "text-foreground")}>
                                    {step.name}
                                </span>
                                {step.duration && (
                                    <span className="text-xs text-muted-foreground font-mono mt-1">
                                        {step.duration}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
