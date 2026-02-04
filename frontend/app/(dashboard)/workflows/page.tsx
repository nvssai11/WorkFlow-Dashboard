import { WorkflowCard } from "@/components/workflows/workflow-card";
import { Plus } from "lucide-react";

// Mock workflows data
const workflows = [
    { id: 1, name: "Deploy API Service", lastRunStatus: "success" as const, trigger: "push", lastRunTime: "2m ago" },
    { id: 2, name: "Run E2E Tests", lastRunStatus: "running" as const, trigger: "schedule", lastRunTime: "Just now" },
    { id: 3, name: "Build Frontend", lastRunStatus: "failed" as const, trigger: "push", lastRunTime: "15m ago" },
    { id: 4, name: "Database Migration", lastRunStatus: "success" as const, trigger: "manual", lastRunTime: "1h ago" },
    { id: 5, name: "Security Scan", lastRunStatus: "success" as const, trigger: "schedule", lastRunTime: "3h ago" },
    { id: 6, name: "Cleanup Resources", lastRunStatus: "queued" as const, trigger: "schedule", lastRunTime: "Pending" },
];

export default function WorkflowsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
                    <p className="text-muted-foreground">Manage and automate your CI/CD pipelines</p>
                </div>
                <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium">
                    <Plus size={16} />
                    New Workflow
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workflows.map((workflow) => (
                    <WorkflowCard
                        key={workflow.id}
                        name={workflow.name}
                        lastRunStatus={workflow.lastRunStatus}
                        trigger={workflow.trigger}
                        lastRunTime={workflow.lastRunTime}
                    />
                ))}
            </div>
        </div>
    );
}
