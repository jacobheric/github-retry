import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface Job {
  name: string;
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
}

export async function getRunJobs(repo: string, runId: number): Promise<Job[]> {
  const { stdout } = await execAsync(
    `gh run view ${runId} --repo ${repo} --json jobs -q '.jobs'`
  );
  return JSON.parse(stdout);
}

export async function rerunFailedJobs(
  repo: string,
  runId: number
): Promise<void> {
  await execAsync(`gh run rerun ${runId} --repo ${repo} --failed`);
}

export interface FlakyAnalysis {
  isFlaky: boolean;
  analysis: string;
}

export function detectFlakyTests(jobs: Job[]): FlakyAnalysis {
  // Group jobs by base name (strip matrix params like "(ubuntu, node-18)")
  const jobGroups = new Map<string, Job[]>();

  for (const job of jobs) {
    const baseName = job.name.replace(/\s*\(.*\)$/, "").trim();
    const group = jobGroups.get(baseName) || [];
    group.push(job);
    jobGroups.set(baseName, group);
  }

  // Check for mixed results in any group
  for (const [baseName, group] of jobGroups) {
    if (group.length > 1) {
      const passed = group.filter((j) => j.conclusion === "success").length;
      const failed = group.filter((j) => j.conclusion === "failure").length;

      if (passed > 0 && failed > 0) {
        return {
          isFlaky: true,
          analysis: `"${baseName}": ${passed} passed, ${failed} failed`,
        };
      }
    }
  }

  return { isFlaky: false, analysis: "No flaky pattern detected" };
}
