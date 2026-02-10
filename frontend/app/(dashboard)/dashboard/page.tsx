import { dashboardStats } from "@/data/mock-dashboard";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentRunsTable } from "@/components/dashboard/recent-runs";
import { Activity, CheckCircle, XCircle, Box } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Total Workflows"
          value={dashboardStats.totalWorkflows}
          icon={Activity}
          trend="+2 new"
          trendUp={true}
        />
        <StatsCard
          label="Successful Runs"
          value={dashboardStats.successfulRuns}
          icon={CheckCircle}
          trend="+12%"
          trendUp={true}
        />
        <StatsCard
          label="Failed Runs"
          value={dashboardStats.failedRuns}
          icon={XCircle}
          trend="-2%"
          trendUp={true}
        />
        <StatsCard
          label="Images Pushed"
          value={dashboardStats.imagesPushed}
          icon={Box}
          className="bg-primary text-primary-foreground border-primary"
        />
      </div>

      <RecentRunsTable />
    </div>
  );
}
