import { LogViewer } from "@/components/logs/log-viewer";

export default function LogsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">System Logs</h1>
                <p className="text-muted-foreground">Real-time execution logs from active runners</p>
            </div>

            <LogViewer />
        </div>
    );
}
