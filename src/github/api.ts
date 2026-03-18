import { config } from "../config.ts";

export interface Job {
  name: string;
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
  url: string;
}

type GitHubWorkflowJob = {
  name: string;
  conclusion: Job["conclusion"];
  html_url: string;
};

type GitHubWorkflowJobsResponse = {
  jobs: GitHubWorkflowJob[];
  total_count: number;
};

type GitHubPull = {
  user: {
    login: string;
  } | null;
};

const GITHUB_TOKEN = config.githubToken;
const GITHUB_API_URL = "https://api.github.com";

const parseRepo = (repo: string) => {
  const [owner, name] = repo.split("/");

  if (!owner || !name) {
    throw new Error(`Invalid GitHub repo: ${repo}`);
  }

  return { owner, name };
};

const githubFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "github-retry",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export async function getRunJobs(repo: string, runId: number): Promise<Job[]> {
  const { owner, name } = parseRepo(repo);
  const jobs: Job[] = [];
  let page = 1;

  while (true) {
    const response = await githubFetch<GitHubWorkflowJobsResponse>(
      `/repos/${owner}/${name}/actions/runs/${runId}/jobs?per_page=100&page=${page}`,
    );

    jobs.push(
      ...response.jobs.map(({ name, conclusion, html_url }) => ({
        name,
        conclusion,
        url: html_url,
      })),
    );

    if (response.jobs.length < 100) {
      return jobs;
    }

    page += 1;
  }
}

export async function rerunFailedJobs(
  repo: string,
  runId: number,
  jobs: Job[],
): Promise<{ rerunJobUrls: string[] }> {
  const { owner, name } = parseRepo(repo);

  await githubFetch(
    `/repos/${owner}/${name}/actions/runs/${runId}/rerun-failed-jobs`,
    { method: "POST" },
  );

  const failedJobs = jobs.filter((j) => j.conclusion === "failure");
  return {
    rerunJobUrls: failedJobs.map((j) => j.url),
  };
}

export interface FlakyAnalysis {
  isFlaky: boolean;
  analysis: string;
}

export async function getPRAuthor(
  repo: string,
  commitSha: string,
): Promise<string | null> {
  const { owner, name } = parseRepo(repo);
  const pulls = await githubFetch<GitHubPull[]>(
    `/repos/${owner}/${name}/commits/${commitSha}/pulls`,
  );

  return pulls[0]?.user?.login ?? null;
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
