"use client";

import { CheckCircle2, ChevronDown, Github } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopBar() {
    return (
        <header className="h-16 border-b bg-background/50 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary rounded-md transition-colors border border-transparent hover:border-border text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">
                        C
                    </div>
                    <span className="text-foreground">capstone-project</span>
                    <ChevronDown size={14} className="text-muted-foreground" />
                </button>

                <div className="h-4 w-[1px] bg-border" />

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                        Operational
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-secondary/50 text-xs font-medium text-muted-foreground">
                    <Github size={14} />
                    <span>Connected</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
                </div>

                <div className="w-8 h-8 rounded-full bg-secondary border flex items-center justify-center text-xs font-medium text-muted-foreground">
                    JS
                </div>
            </div>
        </header>
    );
}
