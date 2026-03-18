import { connect } from "inngest/connect";
import { inngest } from "./inngest/client.js";
import { retryFailedCI } from "./inngest/functions.js";

async function main() {
  console.log("Connecting to Inngest...");

  await connect({
    apps: [
      {
        client: inngest,
        functions: [retryFailedCI],
      },
    ],
  });
}

main().catch(console.error);
