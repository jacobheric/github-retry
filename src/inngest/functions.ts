import { config } from "../config.ts";
import { inngest } from "./client.ts";
import {
  detectFlakyTests,
  getPRAuthor,
  getRunJobs,
  rerunFailedJobs,
} from "../github/api.ts";

const MAX_RETRY_ATTEMPTS = 3;
const GH_USERNAME = config.ghUsername;

export const retryFailedCI = inngest.createFunction(
  { id: "retry-failed-ci" },
  { event: "github/workflow_run.failed" },
  async ({ event, step }) => {
    const {
      run_id,
      repo,
      run_attempt,
      workflow_name,
      html_url,
      commit_sha,
    } = event.data;

    console.log(
      `[retry-failed-ci] ${repo} run ${run_id} (attempt ${run_attempt}, workflow: ${workflow_name})\n  ${html_url}`,
    );

    // Check if PR author matches configured username
    const prAuthor = await step.run(
      "get-pr-author",
      () => getPRAuthor(repo, commit_sha),
    );

    if (prAuthor !== GH_USERNAME) {
      console.log(
        `[retry-failed-ci] Skipping: PR author "${prAuthor}" does not match "${GH_USERNAME}"`,
      );
      return {
        action: "skipped",
        reason: `PR author "${prAuthor}" does not match configured user`,
      };
    }

    // Fetch jobs before retry decisions so workflow exclusions can short-circuit retries.
    const jobs = await step.run("fetch-jobs", () => getRunJobs(repo, run_id));
    const flakyAnalysis = detectFlakyTests(jobs, workflow_name);

    if (flakyAnalysis.excluded) {
      console.log(
        `[retry-failed-ci] Skipping retry for excluded workflow: ${workflow_name}`,
      );
      return {
        action: "skipped",
        reason: `Workflow "${workflow_name}" excluded from automatic retry`,
        url: html_url,
      };
    }

    if (run_attempt >= MAX_RETRY_ATTEMPTS) {
      console.log(`[retry-failed-ci] Skipping: max retries reached`);
      return {
        action: "skipped",
        reason: "Max retries reached",
        url: html_url,
      };
    }

    // Rerun failed jobs
    const { rerunJobUrls } = await step.run(
      "rerun-failed",
      () => rerunFailedJobs(repo, run_id, jobs),
    );

    console.log(
      `[retry-failed-ci] Rerun triggered (flaky: ${flakyAnalysis.isFlaky})`,
    );

    return {
      action: "retried",
      workflow: workflow_name,
      repo,
      run_id,
      attempt: run_attempt + 1,
      isFlaky: flakyAnalysis.isFlaky,
      analysis: flakyAnalysis.analysis,
      url: html_url,
      rerunJobUrls,
    };
  },
);
