"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type FailureStatus = "all" | "resolved" | "unresolved";

interface FailureItem {
    id: string;
    workflow: string;
    source: string;
    podName?: string | null;
    timestamp?: string | null;
    errorLineNumber: number;
    errorLine: string;
    matchedKeyword: string;
    logBlock: string;
    rootCause?: string | null;
    fixSuggestion?: string | null;
    urgency: "crucial" | "moderate" | "low" | string;
    resolved: boolean;
}

interface RawLogItem {
    timestamp: string;
    workflow: string;
    namespace: string;
    selector: string;
    line: string;
}

function formatTime(value?: string | null): string {
    if (!value) return "unknown time";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

export function DetectionList() {
    const [items, setItems] = useState<FailureItem[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<FailureStatus>("all");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rawLogs, setRawLogs] = useState<RawLogItem[]>([]);

    const loadItems = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [failureResponse, logsResponse] = await Promise.all([
                api.get("/agents/failures", {
                    params: {
                        status,
                        search: search.trim() || undefined,
                        limit: 200,
                    },
                }),
                api.get("/agents/monitor/raw-logs", {
                    params: { limit: 300 },
                }),
            ]);
            setItems(failureResponse.data?.items ?? []);
            setRawLogs(logsResponse.data?.items ?? []);
        } catch (err: any) {
            setError(err?.response?.data?.detail || "Failed to load incidents");
        } finally {
            setIsLoading(false);
        }
    }, [search, status]);

    useEffect(() => {
        const t = setTimeout(() => {
            loadItems();
        }, 300);
        return () => clearTimeout(t);
    }, [loadItems]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            loadItems();
        }, 10000);
        return () => clearInterval(intervalId);
    }, [loadItems]);

    const unresolvedCount = useMemo(() => items.filter((item) => !item.resolved).length, [items]);

    const onToggleResolved = async (id: string, resolved: boolean) => {
        try {
            await api.patch(`/agents/failures/${id}`, { resolved });
            setItems((prev) => prev.map((item) => (item.id === id ? { ...item, resolved } : item)));
        } catch {
            setError("Failed to update status");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="font-semibold text-lg">Recent Failures</h3>
                <button
                    onClick={loadItems}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                    <RefreshCcw size={14} />
                    Refresh
                </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search workflow"
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                />
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FailureStatus)}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                >
                    <option value="all">All</option>
                    <option value="unresolved">Unresolved</option>
                    <option value="resolved">Resolved</option>
                </select>
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Unresolved: <span className="font-medium text-foreground">{unresolvedCount}</span>
                </div>
            </div>

            {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</div>}

            {isLoading && <div className="text-sm text-muted-foreground">Loading incidents...</div>}

            {!isLoading && items.length === 0 && (
                <div className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">
                    No failures found.
                </div>
            )}

            <div className="grid gap-4">
                {items.map((item) => (
                    <div key={item.id} className="rounded-xl border bg-card p-5 space-y-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">{item.workflow}</span>
                                <span className="text-muted-foreground text-sm">{formatTime(item.timestamp)}</span>
                            </div>
                            <span
                                className={cn(
                                    "text-xs px-2 py-1 rounded-full border font-medium uppercase w-fit",
                                    item.urgency === "crucial" && "bg-rose-500/10 text-rose-500 border-rose-500/20",
                                    item.urgency === "moderate" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                                    item.urgency === "low" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                )}
                            >
                                {item.urgency}
                            </span>
                        </div>

                        <div className="flex items-start gap-2 text-rose-500 text-sm font-medium">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <span>
                                line {item.errorLineNumber}: {item.errorLine}
                            </span>
                        </div>

                        <div className="grid gap-2 text-sm">
                            <p><span className="font-medium">Root cause:</span> {item.rootCause || "Pending AI analysis"}</p>
                            <p><span className="font-medium">Fix suggestion:</span> {item.fixSuggestion || "Pending AI analysis"}</p>
                            <p className="text-muted-foreground">
                                Source: {item.source}
                                {item.podName ? ` | Pod: ${item.podName}` : ""}
                                {item.matchedKeyword ? ` | Keyword: ${item.matchedKeyword}` : ""}
                            </p>
                        </div>

                        <details className="rounded-md border bg-muted/30 p-3">
                            <summary className="cursor-pointer text-sm font-medium">View log snippet</summary>
                            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.logBlock}</pre>
                        </details>

                        <label className="inline-flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={item.resolved}
                                onChange={(e) => onToggleResolved(item.id, e.target.checked)}
                            />
                            <span className="inline-flex items-center gap-1">
                                <CheckCircle2 size={14} />
                                Mark as resolved
                            </span>
                        </label>
                    </div>
                ))}
            </div>

            <details className="rounded-xl border bg-card p-4">
                <summary className="cursor-pointer font-medium text-sm">Raw AKS Logs (reference)</summary>
                <div className="mt-3 rounded-md border bg-muted/30 p-3 max-h-[320px] overflow-auto">
                    {rawLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No raw logs fetched yet.</p>
                    ) : (
                        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                            {rawLogs.map((entry) => `[${formatTime(entry.timestamp)}] [${entry.workflow}] [${entry.namespace}/${entry.selector}] ${entry.line}`).join("\n")}
                        </pre>
                    )}
                </div>
            </details>
        </div>
    );
}
