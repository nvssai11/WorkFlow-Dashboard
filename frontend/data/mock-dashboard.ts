import { DashboardStats, WorkflowRun } from "@/types";

export const dashboardStats: DashboardStats = {
    totalWorkflows: 12,
    successfulRuns: 145,
    failedRuns: 8,
    imagesPushed: 67,
};

export const recentRuns: WorkflowRun[] = [
    {
        id: "run-1",
        workflowName: "Deploy API Service",
        trigger: "push",
        status: "success",
        duration: "2m 14s",
        timestamp: "2 mins ago",
        branch: "main",
        commitHash: "7a9b2c3",
    },
    {
        id: "run-2",
        workflowName: "Run E2E Tests",
        trigger: "schedule",
        status: "running",
        duration: "45s",
        timestamp: "Just now",
        branch: "develop",
        commitHash: "8b1c4d5",
    },
    {
        id: "run-3",
        workflowName: "Build Frontend",
        trigger: "push",
        status: "failed",
        duration: "1m 12s",
        timestamp: "15 mins ago",
        branch: "feat/ui-update",
        commitHash: "9c2d5e6",
    },
    {
        id: "run-4",
        workflowName: "Database Migration",
        trigger: "manual",
        status: "success",
        duration: "34s",
        timestamp: "1 hour ago",
        branch: "main",
        commitHash: "1e3f6a8",
    },
    {
        id: "run-5",
        workflowName: "Security Scan",
        trigger: "schedule",
        status: "success",
        duration: "5m 01s",
        timestamp: "3 hours ago",
        branch: "main",
        commitHash: "7a9b2c3",
    },
];
