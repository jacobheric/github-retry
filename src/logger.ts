import { config } from "./config.ts";

type LogMetadata = Record<string, unknown>;

const formatLog = (message: string, metadata?: LogMetadata) =>
  metadata ? `${message} ${JSON.stringify(metadata)}` : message;

const debugEnabled = config.logLevel === "debug";

export const logger = {
  info: (message: string, metadata?: LogMetadata) => {
    console.info(formatLog(message, metadata));
  },
  debug: (message: string, metadata?: LogMetadata) => {
    if (debugEnabled) {
      console.debug(formatLog(message, metadata));
    }
  },
};
