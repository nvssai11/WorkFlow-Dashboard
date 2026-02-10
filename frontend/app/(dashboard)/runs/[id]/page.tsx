import { RunHeader } from "@/components/runs/run-header";
import { PipelineVisualizer } from "@/components/runs/pipeline-visualizer";

export default async function RunDetailsPage({ params }: { params: { id: string } }) {
    // In a real app we would use params.id to fetch data. 
    // For now using static mock data matching our recentRuns

    return (
        <div className="space-y-8">
            <RunHeader
                workflowName="Deploy API Service"
                status="running"
                branch="main"
                commitHash="7a9b2c3"
                trigger="push"
                duration="45s"
            />

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8">
                <h2 className="text-lg font-semibold mb-6">Pipeline Visualization</h2>
                <PipelineVisualizer />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border bg-card p-6 h-64 flex items-center justify-center text-muted-foreground">
                    Build Logs (Coming soon in Logs tab)
                </div>
                <div className="rounded-xl border bg-card p-6 h-64 flex items-center justify-center text-muted-foreground">
                    Artifacts (Coming soon)
                </div>
            </div>
        </div>
    );
}
