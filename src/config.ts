const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
};

const parseBoolean = (value?: string) => {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const parseLogLevel = (value?: string) =>
  value?.toLowerCase() === "debug" ? "debug" : "info";

export const config = {
  ghUsername: getRequiredEnv("GH_USERNAME"),
  githubToken: getRequiredEnv("GITHUB_TOKEN"),
  inngestSigningKey: getRequiredEnv("INNGEST_SIGNING_KEY"),
  inngestEventKey: Deno.env.get("INNGEST_EVENT_KEY"),
  inngestDev: parseBoolean(Deno.env.get("INNGEST_DEV")),
  logLevel: parseLogLevel(Deno.env.get("LOG_LEVEL")),
};
