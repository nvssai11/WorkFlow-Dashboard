"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    GitBranch,
    Play,
    ScrollText,
    Bot,
    Settings,
    ChevronLeft,
    ChevronRight,
    Hexagon,
    FolderGit2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Repositories", href: "/repositories", icon: FolderGit2 },
    { name: "Workflows", href: "/workflows", icon: GitBranch },
    { name: "Runs", href: "/runs", icon: Play },
    { name: "Logs", href: "/logs", icon: ScrollText },
    { name: "Agents", href: "/agents", icon: Bot },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "flex flex-col border-r bg-card/50 backdrop-blur-xl h-screen transition-all duration-300 sticky top-0 z-30",
                collapsed ? "w-16" : "w-64"
            )}
        >
            <div className="h-16 flex items-center px-4 border-b">
                <Link href="/" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
                    <div className="bg-primary text-primary-foreground p-1 rounded-md">
                        <Hexagon size={20} fill="currentColor" />
                    </div>
                    {!collapsed && <span className="text-sm tracking-tight">DevOps<span className="text-muted-foreground font-normal">Flow</span></span>}
                </Link>
            </div>

            <nav className="flex-1 p-2 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group relative",
                                isActive
                                    ? "bg-secondary text-secondary-foreground font-medium"
                                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            )}
                        >
                            <item.icon size={20} className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                            {!collapsed && <span>{item.name}</span>}
                            {collapsed && (
                                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border">
                                    {item.name}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-2 border-t">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "w-full flex items-center justify-center p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors",
                        !collapsed && "justify-end"
                    )}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>
        </aside>
    );
}
