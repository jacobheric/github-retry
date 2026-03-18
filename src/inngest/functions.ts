import { inngest } from "./client.js";
import { getRunJobs, rerunFailedJobs, detectFlakyTests } from "../github/api.js";

const MAX_RETRY_ATTEMPTS = 3;

export const retryFailedCI = inngest.createFunction(
  { id: "retry-failed-ci" },
  { event: "github/workflow_run.failed" },
  async ({ event, step }) => {
    const { run_id, repo, run_attempt, workflow_name, html_url } = event.data;

    if (run_attempt >= MAX_RETRY_ATTEMPTS) {
      return {
        action: "skipped",
        reason: "Max retries reached",
        url: html_url,
      };
    }

    // Fetch and analyze jobs
    const jobs = await step.run("fetch-jobs", () => getRunJobs(repo, run_id));
    const flakyAnalysis = detectFlakyTests(jobs);

    // Rerun failed jobs
    await step.run("rerun-failed", () => rerunFailedJobs(repo, run_id));

    return {
      action: "retried",
      workflow: workflow_name,
      repo,
      run_id,
      attempt: run_attempt + 1,
      isFlaky: flakyAnalysis.isFlaky,
      analysis: flakyAnalysis.analysis,
      url: html_url,
    };
  }
);
