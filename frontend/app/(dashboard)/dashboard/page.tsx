"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentRunsTable } from "@/components/dashboard/recent-runs";
import { Activity, CheckCircle, XCircle, Box } from "lucide-react";
import type { DashboardStats, WorkflowRun } from "@/types";
import { fetchDashboardData } from "@/lib/dashboard";

const emptyStats: DashboardStats = {
  totalWorkflows: 0,
  successfulRuns: 0,
  failedRuns: 0,
  imagesPushed: 0,
};

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      try {
        const data = await fetchDashboardData(20);
        if (!mounted) return;
        setStats(data.stats);
        setRuns(data.runs);
      } catch {
        if (!mounted) return;
        setStats(emptyStats);
        setRuns([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Total Workflows"
          value={stats.totalWorkflows}
          icon={Activity}
          trend={isLoading ? "Loading..." : undefined}
          trendUp={true}
        />
        <StatsCard
          label="Successful Runs"
          value={stats.successfulRuns}
          icon={CheckCircle}
          trend={isLoading ? "Loading..." : undefined}
          trendUp={true}
        />
        <StatsCard
          label="Failed Runs"
          value={stats.failedRuns}
          icon={XCircle}
          trend={isLoading ? "Loading..." : undefined}
          trendUp={false}
        />
        <StatsCard
          label="Images Pushed"
          value={stats.imagesPushed}
          icon={Box}
          className="bg-primary text-primary-foreground border-primary"
        />
      </div>

      <RecentRunsTable runs={runs} />
    </div>
  );
}
