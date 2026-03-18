# github-retry

Inngest app that detects flaky CI tests and automatically retries failed GitHub
Actions workflows.

## How it works

1. GitHub sends a `workflow_run` webhook when a workflow completes
2. Inngest transforms it into a `github/workflow_run.failed` event
3. This app analyzes the failed jobs, detects flaky tests (mixed pass/fail in
   matrix jobs), and reruns failed jobs
4. Retries up to 3 attempts per workflow run

## Prerequisites

- Deno 2.0+
- An [Inngest](https://www.inngest.com/) account
- A GitHub token with access to the target repository

## Setup

### 1. Install dependencies

No install step is required. Deno will resolve dependencies from `deno.json`.

### 2. Configure environment variables

```bash
cp env.example .env
```

Edit `.env`:

- `INNGEST_SIGNING_KEY` - Get from [Inngest Dashboard](https://app.inngest.com/)
  → Manage → Signing Key
- `INNGEST_EVENT_KEY` - optional, only needed if this app will send events to
  Inngest Cloud
- `INNGEST_DEV` - optional, set to `1` only when you intentionally want local
  Inngest dev mode
- `GH_USERNAME` - scope to PRs authored by this username
- `GITHUB_TOKEN` - GitHub token with `actions:write` and pull request read
  access

### 3. Configure Inngest webhook

Create a webhook transform in Inngest to convert GitHub's `workflow_run` payload
to your event schema. See
[Inngest Webhook documentation](https://www.inngest.com/docs/platform/webhooks).

**Transform example:**

```javascript
function transform(evt, headers = {}) {
  const githubEventType = headers["X-Github-Event"] || "";

  // Only process workflow_run events
  if (githubEventType !== "workflow_run") {
    return null;
  }

  // Only process completed workflow runs that failed
  if (
    evt.action !== "completed" ||
    evt.workflow_run.conclusion !== "failure"
  ) {
    return null;
  }

  const run = evt.workflow_run;

  return {
    name: "github/workflow_run.failed",
    data: {
      run_id: run.id,
      repo: evt.repository.full_name,
      workflow_name: run.name,
      commit_sha: run.head_sha,
      html_url: run.html_url,
      run_attempt: run.run_attempt,
    },
    id: `workflow-run-${run.id}-${run.run_attempt}`,
    ts: new Date(run.updated_at).getTime(),
  };
}
```

### 4. Add webhook to GitHub

1. Go to your GitHub repo → Settings → Webhooks → Add webhook
2. Set Payload URL to your Inngest webhook URL
3. Set Content type to `application/json`
4. Select "Workflow runs" event
5. Save

### 5. Run the app

```bash
# Development
deno task dev

# Production
deno task start
```

The Inngest serve endpoint is available at `http://localhost:8000/api/inngest`.

## Deno Deploy

Use `src/index.ts` as the entrypoint. The deployed app exposes the Inngest
handler at `/api/inngest`, so point Inngest at
`https://<your-app>.deno.dev/api/inngest`.

## License

MIT
