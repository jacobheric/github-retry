import { config } from "../config.ts";
import { githubWorkflowRunFailed, inngest } from "./client.ts";
import {
  detectFlakyTests,
  getPRAuthor,
  getRunJobs,
  rerunFailedJobs,
} from "../github/api.ts";
import { logger } from "../logger.ts";

const MAX_RETRY_ATTEMPTS = 3;
const GH_USERNAME = config.ghUsername;

export const retryFailedCI = inngest.createFunction(
  { id: "retry-failed-ci", triggers: [githubWorkflowRunFailed] },
  async ({ event, step }) => {
    const { run_id, repo, run_attempt, workflow_name, html_url, commit_sha } =
      event.data;

    logger.debug("[retry-failed-ci] received failed workflow run", {
      repo,
      runId: run_id,
      attempt: run_attempt,
      workflow: workflow_name,
      url: html_url,
    });

    const prAuthor = await step.run("get-pr-author", () =>
      getPRAuthor(repo, commit_sha),
    );

    if (prAuthor !== GH_USERNAME) {
      logger.debug("[retry-failed-ci] skipped non-owned PR", {
        repo,
        runId: run_id,
        workflow: workflow_name,
        prAuthor,
      });

      return {
        action: "skipped",
        reason: `PR author "${prAuthor}" does not match configured user`,
      };
    }

    const jobs = await step.run("fetch-jobs", () => getRunJobs(repo, run_id));
    const flakyAnalysis = detectFlakyTests(jobs, workflow_name);

    if (flakyAnalysis.excluded) {
      logger.debug("[retry-failed-ci] skipped excluded workflow", {
        repo,
        runId: run_id,
        workflow: workflow_name,
      });

      return {
        action: "skipped",
        reason: `Workflow "${workflow_name}" excluded from automatic retry`,
        url: html_url,
      };
    }

    if (run_attempt >= MAX_RETRY_ATTEMPTS) {
      logger.info("[retry-failed-ci] skipped max attempts", {
        repo,
        runId: run_id,
        attempt: run_attempt,
        workflow: workflow_name,
      });

      return {
        action: "skipped",
        reason: "Max retries reached",
        url: html_url,
      };
    }

    const { rerunJobUrls } = await step.run("rerun-failed", () =>
      rerunFailedJobs(repo, run_id, jobs),
    );

    logger.info("[retry-failed-ci] retried failed jobs", {
      repo,
      runId: run_id,
      workflow: workflow_name,
      nextAttempt: run_attempt + 1,
      flaky: flakyAnalysis.isFlaky,
      analysis: flakyAnalysis.analysis,
      url: html_url,
      rerunJobUrls,
    });

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
