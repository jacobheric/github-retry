#!/bin/bash

set -euo pipefail

if [[ -z "${1:-}" ]]; then
    echo "Usage: $0 <pr-url>"
    echo "Example: $0 https://github.com/inngest/monorepo/pull/6559"
    exit 1
fi

pr_url="$1"

# Parse repo and PR number from URL
if [[ "$pr_url" =~ github\.com/([^/]+/[^/]+)/pull/([0-9]+) ]]; then
    repo="${BASH_REMATCH[1]}"
    pr_num="${BASH_REMATCH[2]}"
else
    echo "Error: Invalid GitHub PR URL"
    exit 1
fi

echo "Fetching PR #$pr_num from $repo..."

# Get the HEAD commit SHA
head_sha=$(gh pr view "$pr_num" --repo "$repo" --json headRefOid -q .headRefOid)
echo "HEAD commit: $head_sha"

# Get failed workflow runs (most recent per workflow)
echo "Finding failed workflow runs..."
failed_runs=$(gh run list --repo "$repo" --commit "$head_sha" --status failure --json databaseId,name,workflowName,createdAt -q '
  group_by(.workflowName) | map(sort_by(.createdAt) | last) | .[] | "\(.databaseId)\t\(.name)"
')

if [[ -z "$failed_runs" ]]; then
    echo "No failed workflow runs found."
    exit 0
fi

echo "Failed runs:"
echo "$failed_runs"
echo ""

# Rerun each failed workflow
echo "$failed_runs" | while IFS=$'\t' read -r run_id run_name; do
    echo "Rerunning failed jobs in: $run_name (ID: $run_id)"
    gh run rerun "$run_id" --repo "$repo" --failed
done

echo "Done!"
