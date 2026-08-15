export interface ResourcePolicies {
  maxConcurrentTasks?: number;
  maxGpuUtilization?: number;
  onlyWhenVisible?: boolean;
  onlyWhenCharging?: boolean;
  allowCellular?: boolean;
}

export const DEFAULT_POLICIES: Required<Pick<ResourcePolicies, "maxConcurrentTasks" | "onlyWhenVisible">> = {
  maxConcurrentTasks: 1,
  onlyWhenVisible: true,
};

export const canRunTask = (policies: ResourcePolicies, activeTasks: number): { ok: boolean; reason?: string } => {
  const maxConcurrent = policies.maxConcurrentTasks ?? DEFAULT_POLICIES.maxConcurrentTasks;
  if (activeTasks >= maxConcurrent) {
    return { ok: false, reason: "max-concurrent-tasks" };
  }
  if (
    (policies.onlyWhenVisible ?? DEFAULT_POLICIES.onlyWhenVisible) &&
    typeof document !== "undefined" &&
    document.visibilityState === "hidden"
  ) {
    return { ok: false, reason: "page-hidden" };
  }
  return { ok: true };
};
