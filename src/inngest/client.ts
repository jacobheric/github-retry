import { config } from "../config.ts";
import { EventSchemas, Inngest } from "inngest";

type Events = {
  "github/workflow_run.failed": {
    data: {
      run_id: number;
      repo: string;
      workflow_name: string;
      commit_sha: string;
      html_url: string;
      run_attempt: number;
    };
  };
};

export const inngest = new Inngest({
  id: "github-retry-ci-deployed",
  eventKey: config.inngestEventKey,
  isDev: config.inngestDev,
  schemas: new EventSchemas().fromRecord<Events>(),
});
