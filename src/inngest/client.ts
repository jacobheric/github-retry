import { config } from "../config.ts";
import { eventType, Inngest, staticSchema } from "inngest";

type GithubWorkflowRunFailed = {
  run_id: number;
  repo: string;
  workflow_name: string;
  commit_sha: string;
  html_url: string;
  run_attempt: number;
};

export const githubWorkflowRunFailed = eventType("github/workflow_run.failed", {
  schema: staticSchema<GithubWorkflowRunFailed>(),
});

export const inngest = new Inngest({
  id: "github-retry-ci-deployed",
  eventKey: config.inngestEventKey,
  signingKey: config.inngestSigningKey,
  isDev: config.inngestDev,
});
