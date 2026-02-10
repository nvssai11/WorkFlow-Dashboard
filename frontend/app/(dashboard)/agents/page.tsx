import { AgentStatus } from "@/components/agents/agent-status";
import { DetectionList } from "@/components/agents/detection-list";

export default function AgentsPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Intelligent Agents</h1>
                <p className="text-muted-foreground">AI-powered workflow monitoring and self-healing</p>
            </div>

            <AgentStatus />
            <DetectionList />
        </div>
    );
}
