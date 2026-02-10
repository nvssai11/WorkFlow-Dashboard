"use client";

import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans antialiased">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
                <TopBar />
                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
