import { Inngest, EventSchemas } from "inngest";

type Events = {
  "github/workflow_run.failed": {
    data: {
      run_id: number;
      repo: string;
      workflow_name: string;
      branch: string;
      commit_sha: string;
      html_url: string;
      run_attempt: number;
    };
  };
};

export const inngest = new Inngest({
  id: "github-retry",
  schemas: new EventSchemas().fromRecord<Events>(),
});
