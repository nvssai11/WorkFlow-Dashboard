"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle, RefreshCcw, ShieldCheck, Zap } from "lucide-react";
import { api } from "@/lib/api";

interface MonitorSource {
    workflow: string;
    namespace: string;
    selector: string;
    container?: string | null;
}

interface MonitorStatus {
    running: boolean;
    enabled: boolean;
    pollSeconds: number;
    sources: MonitorSource[];
    lastPollAt?: string | null;
    lastSuccessAt?: string | null;
    lastError?: string | null;
    kubectlReachable?: boolean | null;
    lastResult?: {
        detected: number;
        stored: number;
    } | null;
}

const emptyStatus: MonitorStatus = {
    running: false,
    enabled: false,
    pollSeconds: 0,
    sources: [],
};

function formatDate(value?: string | null): string {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

export function AgentStatus() {
    const [status, setStatus] = useState<MonitorStatus>(emptyStatus);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadStatus = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get("/agents/monitor/status");
            setStatus(response.data ?? emptyStatus);
        } catch (err: any) {
            setError(err?.response?.data?.detail || "Failed to load monitor status");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();
        const intervalId = setInterval(loadStatus, 10000);
        return () => clearInterval(intervalId);
    }, [loadStatus]);

    const controlMonitor = async (action: "start" | "stop" | "poll-once") => {
        try {
            setError(null);
            const response = await api.post(`/agents/monitor/${action}`);
            if (action === "poll-once") {
                setStatus(response.data?.status ?? status);
            } else {
                setStatus(response.data ?? status);
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || `Failed to ${action}`);
        }
    };

    const sourceCount = useMemo(() => status.sources?.length ?? 0, [status.sources]);
    const healthText = useMemo(() => {
        if (status.kubectlReachable === false) return "kubectl unreachable";
        if (status.kubectlReachable === true) return "kubectl reachable";
        return "health unknown";
    }, [status.kubectlReachable]);

    return (
        <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Bot size={100} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">AKS Monitor</p>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                {status.running && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                )}
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${status.running ? "bg-emerald-500" : "bg-zinc-500"}`}></span>
                            </span>
                            <h3 className="text-2xl font-bold">{status.running ? "Running" : "Stopped"}</h3>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                        {status.enabled ? "Started from UI (click Stop to disable)" : "Stopped — click Start to enable"} | Poll {status.pollSeconds || "-"}s
                    </p>
                </div>

                <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Monitored Sources</p>
                        <ShieldCheck className="text-primary" size={20} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">{sourceCount}</div>
                    <div className="h-2 w-full bg-secondary rounded-full mt-4 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, sourceCount * 25)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">Health: {healthText}</p>
                </div>

                <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Monitor Controls</p>
                        <Zap className="text-primary" size={20} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => controlMonitor("start")} className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent">
                            Start
                        </button>
                        <button onClick={() => controlMonitor("stop")} className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent">
                            Stop
                        </button>
                        <button
                            onClick={() => controlMonitor("poll-once")}
                            className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
                            title="Fetch AKS logs once, run error detection, and store failures. Does not start the background monitor."
                        >
                            Poll Once
                        </button>
                        <button
                            onClick={loadStatus}
                            className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent inline-flex items-center gap-1"
                            title="Reload monitor status (running, last poll, errors) from the server. Does not poll AKS."
                        >
                            <RefreshCcw size={12} />
                            Refresh
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-emerald-500 flex items-center gap-1">
                        <CheckCircle size={12} />
                        {isLoading ? "Refreshing status..." : "Status updates every 10s"}
                    </p>
                </div>
            </div>

            {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</div>}

            {status.lastError && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
                    <p className="font-medium">Last monitor error</p>
                    <p className="mt-1 break-words">{status.lastError}</p>
                    <p className="mt-2 text-xs">
                        Last poll: {formatDate(status.lastPollAt)} | Last success: {formatDate(status.lastSuccessAt)}
                    </p>
                    <p className="mt-1 text-xs">
                        If this says DNS/no such host, refresh AKS kubeconfig with{" "}
                        <code>az aks get-credentials --overwrite-existing</code> and verify <code>kubectl get nodes</code>.
                    </p>
                </div>
            )}
        </div>
    );
}
