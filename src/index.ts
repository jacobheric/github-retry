import { connect } from "inngest/connect";
import { inngest } from "./inngest/client.js";
import { retryFailedCI } from "./inngest/functions.js";

async function main() {
  console.log("Connecting to Inngest...");

  const connection = await connect({
    apps: [
      {
        client: inngest,
        functions: [retryFailedCI],
      },
    ],
  });

  console.log(`Connected to Inngest (${connection.connectionId})`);

  await connection.closed;
}

main().catch(console.error);
