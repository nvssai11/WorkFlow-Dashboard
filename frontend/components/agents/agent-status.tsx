import { Bot, CheckCircle, ShieldCheck, Zap } from "lucide-react";

export function AgentStatus() {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Bot size={100} />
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">Agent Status</p>
                    <div className="mt-2 flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <h3 className="text-2xl font-bold">Active</h3>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">Monitoring 12 workflows</p>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Self-Healing Events</p>
                    <ShieldCheck className="text-primary" size={20} />
                </div>
                <div className="mt-2 text-2xl font-bold">24 <span className="text-xs font-normal text-muted-foreground">this week</span></div>
                <div className="h-2 w-full bg-secondary rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[78%]" />
                </div>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Validation Checks</p>
                    <Zap className="text-primary" size={20} />
                </div>
                <div className="mt-2 text-2xl font-bold">1,892</div>
                <p className="text-xs text-muted-foreground mt-4 text-emerald-500 flex items-center gap-1">
                    <CheckCircle size={12} />
                    All systems operational
                </p>
            </div>
        </div>
    );
}
