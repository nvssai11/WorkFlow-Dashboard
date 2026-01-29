export type Status = "success" | "failed" | "running" | "queued";

export interface WorkflowRun {
    id: string;
    workflowName: string;
    trigger: "push" | "manual" | "schedule" | "retry";
    status: Status;
    duration: string;
    timestamp: string;
    branch: string;
    commitHash: string;
}

export interface DashboardStats {
    totalWorkflows: number;
    successfulRuns: number;
    failedRuns: number;
    imagesPushed: number;
}
