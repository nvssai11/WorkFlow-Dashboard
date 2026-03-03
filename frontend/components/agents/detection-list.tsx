"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw, FileText, X } from "lucide-react";
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
    repoOwner?: string | null;
    repoName?: string | null;
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

function getDisplayRootCause(item: FailureItem): string {
    if (item.rootCause?.trim()) return item.rootCause;
    return "Pending";
}

function getDisplayFix(item: FailureItem): string {
    if (item.fixSuggestion?.trim()) return item.fixSuggestion;
    return "Pending";
}

interface MonitorStatus {
    enabled: boolean;
}

export function DetectionList() {
    const [items, setItems] = useState<FailureItem[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<FailureStatus>("all");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rawLogs, setRawLogs] = useState<RawLogItem[]>([]);
    const [logsDrawerItem, setLogsDrawerItem] = useState<FailureItem | null>(null);
    const [monitorEnabled, setMonitorEnabled] = useState<boolean>(false);

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
        const loadMonitorStatus = async () => {
            try {
                const res = await api.get<MonitorStatus>("/agents/monitor/status");
                setMonitorEnabled(Boolean(res.data?.enabled));
            } catch {
                setMonitorEnabled(false);
            }
        };
        loadMonitorStatus();
        const statusInterval = setInterval(loadMonitorStatus, 10000);
        return () => clearInterval(statusInterval);
    }, []);

    useEffect(() => {
        if (!monitorEnabled) return;
        const intervalId = setInterval(() => {
            loadItems();
        }, 10000);
        return () => clearInterval(intervalId);
    }, [loadItems, monitorEnabled]);

    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            if (a.resolved === b.resolved) return 0;
            return a.resolved ? 1 : -1;
        });
    }, [items]);

    const unresolvedCount = useMemo(() => items.filter((item) => !item.resolved).length, [items]);

    const onToggleResolved = async (id: string, resolved: boolean) => {
        try {
            await api.patch(`/agents/failures/${id}`, { resolved });
            setItems((prev) => prev.map((item) => (item.id === id ? { ...item, resolved } : item)));
        } catch {
            setError("Failed to update status");
        }
    };

    const rawLogsForWorkflow = useMemo(() => {
        if (!logsDrawerItem) return [];
        return rawLogs.filter((entry) => entry.workflow === logsDrawerItem.workflow);
    }, [rawLogs, logsDrawerItem]);

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

            {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
                    {error}
                </div>
            )}

            {isLoading && <div className="text-sm text-muted-foreground">Loading incidents...</div>}

            {!isLoading && items.length === 0 && (
                <div className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">
                    No failures found.
                </div>
            )}

            {!isLoading && items.length > 0 && (
                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="text-left font-semibold p-3">Workflow name</th>
                                    <th className="text-left font-semibold p-3">Repository</th>
                                    <th className="text-left font-semibold p-3">Failure details</th>
                                    <th className="text-left font-semibold p-3">Estimated root cause</th>
                                    <th className="text-left font-semibold p-3">Suggested fix</th>
                                    <th className="text-left font-semibold p-3 w-[100px]">View logs</th>
                                    <th className="text-left font-semibold p-3 w-[100px]">Resolved</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedItems.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={cn(
                                            "border-b last:border-b-0",
                                            item.resolved && "bg-muted/20"
                                        )}
                                    >
                                        <td className="p-3 font-medium">{item.workflow}</td>
                                        <td className="p-3 text-muted-foreground">
                                            {item.repoOwner && item.repoName
                                                ? `${item.repoOwner}/${item.repoName}`
                                                : "—"}
                                        </td>
                                        <td className="p-3">
                                            <span className="text-rose-500 inline-flex items-start gap-1">
                                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                                <span>
                                                    Line {item.errorLineNumber}: {item.errorLine}
                                                </span>
                                            </span>
                                            {item.timestamp && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatTime(item.timestamp)}
                                                </p>
                                            )}
                                        </td>
                                        <td className="p-3 text-muted-foreground max-w-[200px]">
                                            {getDisplayRootCause(item)}
                                        </td>
                                        <td className="p-3 text-muted-foreground max-w-[200px]">
                                            {getDisplayFix(item)}
                                        </td>
                                        <td className="p-3">
                                            <button
                                                type="button"
                                                onClick={() => setLogsDrawerItem(item)}
                                                className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-accent"
                                            >
                                                <FileText size={12} />
                                                View logs
                                            </button>
                                        </td>
                                        <td className="p-3">
                                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={item.resolved}
                                                    onChange={(e) =>
                                                        onToggleResolved(item.id, e.target.checked)
                                                    }
                                                />
                                                <span className="text-xs">
                                                    {item.resolved ? "Resolved" : "Resolve"}
                                                </span>
                                            </label>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Logs drawer */}
            {logsDrawerItem && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/50"
                        aria-hidden
                        onClick={() => setLogsDrawerItem(null)}
                    />
                    <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-background border-l shadow-xl flex flex-col">
                        <div className="flex items-center justify-between border-b p-3">
                            <h4 className="font-semibold">Logs — {logsDrawerItem.workflow}</h4>
                            <button
                                type="button"
                                onClick={() => setLogsDrawerItem(null)}
                                className="rounded-md p-1.5 hover:bg-accent"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-3 space-y-4">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Log snippet (matched block)
                                </p>
                                <pre className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap text-xs overflow-x-auto">
                                    {logsDrawerItem.logBlock || "No snippet."}
                                </pre>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Raw AKS logs for this workflow
                                </p>
                                <div className="rounded-md border bg-muted/30 p-3 max-h-[50vh] overflow-auto">
                                    {rawLogsForWorkflow.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            No raw logs for this workflow yet.
                                        </p>
                                    ) : (
                                        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                                            {rawLogsForWorkflow
                                                .map(
                                                    (entry) =>
                                                        `[${formatTime(entry.timestamp)}] [${entry.workflow}] [${entry.namespace}/${entry.selector}] ${entry.line}`
                                                )
                                                .join("\n")}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
