"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Download, Pause, Play, Trash2 } from "lucide-react";

interface LogEntry {
    id: number;
    timestamp: string;
    level: "info" | "warning" | "error" | "success";
    message: string;
}

const mockLogs: Omit<LogEntry, "id" | "timestamp">[] = [
    { level: "info", message: "Starting workflow execution..." },
    { level: "info", message: "Pulling docker image node:18-alpine" },
    { level: "success", message: "Successfully pulled image" },
    { level: "info", message: "Restoring cache..." },
    { level: "info", message: "Cache restored (245MB)" },
    { level: "info", message: "Running npm install..." },
    { level: "warning", message: "npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory." },
    { level: "info", message: "Added 1245 packages in 24s" },
    { level: "info", message: "Running build script..." },
    { level: "info", message: "Building project for production..." },
    { level: "info", message: "Compiled successfully" },
    { level: "success", message: "Build completed in 45s" },
    { level: "info", message: "Running tests..." },
    { level: "error", message: "Test failed: Login component should render" },
    { level: "info", message: "Retrying test execution (1/3)..." },
];

export function LogViewer() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isPlaying, setIsPlaying] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);
    const logIndexRef = useRef(0);

    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            if (logIndexRef.current >= mockLogs.length) {
                setIsPlaying(false);
                return;
            }

            const newLog = mockLogs[logIndexRef.current];
            setLogs(prev => [...prev, {
                id: Date.now(),
                timestamp: new Date().toISOString().split("T")[1].split(".")[0],
                ...newLog
            }]);

            logIndexRef.current++;
        }, 800);

        return () => clearInterval(interval);
    }, [isPlaying]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    const getLevelColor = (level: LogEntry["level"]) => {
        switch (level) {
            case "info": return "text-blue-400";
            case "warning": return "text-yellow-400";
            case "error": return "text-rose-400";
            case "success": return "text-emerald-400";
            default: return "text-muted-foreground";
        }
    };

    return (
        <div className="flex flex-col h-[600px] border rounded-xl overflow-hidden bg-[#0a0a0a] text-sm font-mono shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-[#171717] text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50" />
                    <span>build-logs-89c7fa.txt</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                    >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                        <Download size={14} />
                    </button>
                    <button
                        onClick={() => { setLogs([]); logIndexRef.current = 0; setIsPlaying(false); }}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {logs.length === 0 && (
                    <div className="text-muted-foreground italic opacity-50">Waiting for logs...</div>
                )}
                {logs.map((log) => (
                    <div key={log.id} className="flex gap-4 hover:bg-white/5 px-1 rounded transition-colors group">
                        <span className="text-muted-foreground/40 select-none w-20 shrink-0">{log.timestamp}</span>
                        <span className="text-muted-foreground/40 select-none w-16 shrink-0 uppercase text-[10px] pt-0.5">{log.level}</span>
                        <span className={cn(getLevelColor(log.level), "break-all")}>{log.message}</span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
