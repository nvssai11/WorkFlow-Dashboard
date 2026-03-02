import { api } from "@/lib/api";
import type { DashboardStats, WorkflowRun } from "@/types";

export interface DashboardResponse {
  stats: DashboardStats;
  runs: WorkflowRun[];
}

export async function fetchDashboardData(limit = 20): Promise<DashboardResponse> {
  const { data } = await api.get("/workflow/runs", {
    params: { limit, refresh: true },
  });
  return data as DashboardResponse;
}
