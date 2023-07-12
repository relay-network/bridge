/* eslint-disable no-console */
import chalk from "chalk";

export const LOG_LEVELS = [
  { name: "debug", severity: 0 },
  { name: "info", severity: 1 },
  { name: "warn", severity: 2 },
  { name: "error", severity: 3 },
] as const;

type Level = (typeof LOG_LEVELS)[number]["name"];

const LINE_LENGTH = 100;
const MAX_TEXT_LENGTH = 100;

const getCentered = (pad: string, text: string) => {
  const trimmed = text.slice(0, MAX_TEXT_LENGTH);
  const padding = pad.repeat((LINE_LENGTH - trimmed.length) / 2);
  return `${padding} ${text} ${padding}`;
};

const writeDevDebug = (message: string, metadata?: unknown) => {
  const HEADER = getCentered("-", message);
  const BORDER = getCentered(" ", "") + "|";
  const FOOTER = getCentered("-", "END DEBUG");

  const description = (() => {
    try {
      return (metadata as { description: string }).description;
    } catch (err) {
      return undefined;
    }
  })();

  console.log(chalk.green(HEADER));
  console.log(chalk.green(BORDER));
  console.log(chalk.green(BORDER));
  console.log(chalk.green(BORDER));
  console.log("\n");
  if (description === undefined) {
    console.log(chalk.yellow("No description provided"));
  } else {
    console.log(chalk.yellow(description));
  }
  console.log("\n");
  if (metadata === undefined) {
    console.log("no metadata provided");
  } else {
    console.log(JSON.stringify(metadata, null, 2));
  }
  console.log(chalk.green(BORDER));
  console.log(chalk.green(BORDER));
  console.log(chalk.green(BORDER));
  console.log(chalk.green(FOOTER));
  console.log("\n");
  console.log("\n");
};

const writeDevError = (message: string, metadata?: unknown) => {
  const HEADER = getCentered("-", message);
  const BORDER = getCentered(" ", "") + "|";
  const FOOTER = getCentered("-", "END ERROR");

  const description = (() => {
    try {
      return (metadata as { description: string }).description;
    } catch (err) {
      return undefined;
    }
  })();

  console.log(chalk.red(HEADER));
  console.log(chalk.red(BORDER));
  console.log(chalk.red(BORDER));
  console.log(chalk.red(BORDER));
  console.log(chalk.yellow(message));
  console.log("\n");
  if (description === undefined) {
    console.log(chalk.yellow("No description provided"));
  } else {
    console.log(chalk.yellow(description));
  }
  console.log("\n");
  if (metadata === undefined) {
    console.log("no metadata provided");
  } else {
    console.log(JSON.stringify(metadata, null, 2));
  }
  console.log("\n");
  console.log(chalk.red(BORDER));
  console.log(chalk.red(BORDER));
  console.log(chalk.red(BORDER));
  console.log(chalk.red(FOOTER));
  console.log("\n");
  console.log("\n");
};

export const createInterface = ({ level }: { level: Level }) => {
  const WRITE_CONFIG = {
    debug: level === "debug",
    info: level === "debug" || level === "info",
    warn: level === "debug" || level === "info" || level === "warn",
    error: true,
  };

  return {
    debug: (message: string, metadata?: unknown) => {
      if (WRITE_CONFIG.debug) {
        if (process.env.NODE_ENV !== "production") {
          writeDevDebug(message, metadata);
        } else {
          console.debug({
            message,
            ...(metadata || {}),
          });
        }
      }
    },

    info: (message: string, metadata?: unknown) => {
      if (WRITE_CONFIG.info) {
        if (process.env.NODE_ENV !== "production") {
          writeDevDebug(message, metadata);
        } else {
          console.log({
            message,
            ...(metadata || {}),
          });
        }
      }
    },

    warn: (message: string, metadata?: unknown) => {
      if (WRITE_CONFIG.warn) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(message, metadata);
        } else {
          console.warn({
            message,
            ...(metadata || {}),
          });
        }
      }
    },

    error: (message: string, metadata?: unknown) => {
      if (WRITE_CONFIG.error) {
        if (process.env.NODE_ENV !== "production") {
          writeDevError(message, metadata);
        } else {
          console.error({
            message,
            ...(metadata || {}),
          });
        }
      }
    },
  };
};
