import { RecentRunsTable } from "@/components/dashboard/recent-runs";

export default function RunsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">All Runs</h1>
                <p className="text-muted-foreground">History of all workflow executions</p>
            </div>
            <RecentRunsTable />
        </div>
    );
}
