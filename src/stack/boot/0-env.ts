import { z } from "zod";
import * as Util from "../../util.js";

const zKebabCase = z.string().refine((s) => {
  const tokens = s.split("-");
  const lowered = tokens.map((t) => t.toLowerCase());
  const kebab = lowered.join("-");
  return s === kebab;
});

export const APP_NAME = zKebabCase.parse(process.env.APP_NAME, {
  errorMap: () => {
    return {
      message: "process.env.APP_NAME is not a valid string",
    };
  },
});

export const APP_ENV = z
  .enum(["dev", "test", "production"])
  .parse(process.env.APP_ENV, {
    errorMap: () => {
      return {
        message: "process.env.APP_ENV is not a valid string",
      };
    },
  });

export const APP_INSTANCE = z.string().parse(process.env.APP_INSTANCE, {
  errorMap: () => {
    return {
      message: "process.env.APP_INSTANCE is not a valid string",
    };
  },
});

export const APP_SERVICE = zKebabCase.parse(process.env.APP_SERVICE, {
  errorMap: () => {
    return {
      message: "process.env.APP_SERVICE is not a valid string",
    };
  },
});

export const PG_CONNECTION_STRING = Util.zPgConnectionString.parse(
  process.env.PG_CONNECTION_STRING,
  {
    errorMap: () => {
      return {
        message:
          "process.env.PG_CONNECTION_STRING is not a valid postgresql connection string",
      };
    },
  }
);
