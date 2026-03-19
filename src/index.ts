import { config } from "./config.ts";
import { serve } from "inngest/edge";
import { inngest } from "./inngest/client.ts";
import { retryFailedCI } from "./inngest/functions.ts";

const INNGEST_SERVE_PATH = "/api/inngest";
const PORT = Number(Deno.env.get("PORT") ?? "8000");

const inngestHandler = serve({
  client: inngest,
  functions: [retryFailedCI],
  signingKey: config.inngestSigningKey,
});

export const handler = (request: Request) => {
  const { pathname } = new URL(request.url);

  if (pathname === INNGEST_SERVE_PATH) {
    return inngestHandler(request);
  }

  return new Response("Not Found", { status: 404 });
};

if (import.meta.main) {
  console.log(
    `Serving Inngest on http://localhost:${PORT}${INNGEST_SERVE_PATH}`,
  );
  Deno.serve({ port: PORT }, handler);
}
