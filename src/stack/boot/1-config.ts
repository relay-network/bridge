import { z } from "zod";
import * as Env from "./0-env.js";
import postgres from "postgres";

/* *****************************************************************************
 *
 * ENVIRONMENT DEFINITION
 *
 * ****************************************************************************/

const zEnvironmentConfig = z.object({
  name: z.string(),
  env: z.enum(["dev", "production", "test"]),
  instance: z.string(),
});

/* *****************************************************************************
 *
 * INTERFACES DEFINITION
 *
 * ****************************************************************************/

const zExpressConfig = z.object({
  port: z.number(),
});

const zLoggerConfig = z.object({
  level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
});

const zXmtpConfig = z.object({
  key: z.string(),
  address: z.string(),
  environment: z.enum(["dev", "production"]),
});

const zPrismaConfig = z.object({
  connection: z.string(),
});

/* *****************************************************************************
 *
 * SERVICE DEFINITION
 *
 * ****************************************************************************/

const zWebhookConfig = z.null();

const zBridgeConfig = z.object({
  webhookAddress: z.string(),
  httpUrl: z.string().url(),
  isBot: z.boolean(),
});

/* eslint-disable-next-line */
const zCanaryConfig = z.null();

const zEndToEndConfig = z.object({
  canaryHost: z.string().url(),
  webhookHost: z.string().url(),
  bridgeAddress: z.string(),
});

const sql = postgres(Env.PG_CONNECTION_STRING);

/* *****************************************************************************
 *
 * FETCH UNTYPED CONFIG
 *
 * ****************************************************************************/

const kebabToPascal = (service: string) => {
  const uppercase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const tokens = service.split("-");
  return tokens.map(uppercase).join("");
};

const serviceTable = () => {
  return `${kebabToPascal(Env.APP_NAME)}${kebabToPascal(Env.APP_SERVICE)}`;
};

const getEnv = async () => {
  const [env] = await sql`
    select * from "Environment"
      where name = ${Env.APP_NAME}
      and env = ${Env.APP_ENV}
      and instance = ${Env.APP_INSTANCE}
    limit 1
  `;

  if (!env) {
    throw new Error(
      `No environment found with name: ${Env.APP_NAME}, env: ${Env.APP_ENV}, instance: ${Env.APP_INSTANCE}`
    );
  }

  return zEnvironmentConfig.parse(env);
};

const getService = async () => {
  try {
    const [service] = await sql`
      select * from ${sql(serviceTable())}
      inner join "Environment"
        on "Environment".id = ${sql(serviceTable())}."environmentId"
      where
        "Environment".name = ${Env.APP_NAME}
        and "Environment".env = ${Env.APP_ENV}
        and "Environment".instance = ${Env.APP_INSTANCE}
      limit 1
    `;

    return service || null;
  } catch (err) {
    return null;
  }
};

const getInterface = async (table: string) => {
  try {
    const foreignKey = `${table.toLowerCase()}Id`;

    const [config] = await sql`
      select * from ${sql(table)}
        inner join ${sql(serviceTable())}
          on ${sql(table)}.id = ${sql(serviceTable())}.${sql(foreignKey)}
        inner join "Environment"
          on "Environment".id = ${sql(serviceTable())}."environmentId"
        where
          "Environment".name = ${Env.APP_NAME}
          and "Environment".env = ${Env.APP_ENV}
          and "Environment".instance = ${Env.APP_INSTANCE}
      limit 1
    `;

    return config || null;
  } catch (err) {
    return null;
  }
};

/* *****************************************************************************
 *
 * TYPED CONFIG THUNKS
 *
 * ****************************************************************************/

export const env = await (async () => {
  const env = await getEnv();
  return () => env;
})();

export const express = await (async () => {
  const i = await getInterface("Express");
  return () =>
    zExpressConfig.parse(i, {
      errorMap: () => {
        return {
          message: `Failed to parse Express config for ${Env.APP_SERVICE}`,
        };
      },
    });
})();

export const logger = await (async () => {
  const i = await getInterface("Logger");
  return () =>
    zLoggerConfig.parse(i, {
      errorMap: () => {
        return {
          message: `Failed to parse Logger config for ${Env.APP_SERVICE}`,
        };
      },
    });
})();

export const xmtp = await (async () => {
  const i = await getInterface("Xmtp");
  return () =>
    zXmtpConfig.parse(i, {
      errorMap: () => {
        return {
          message: `Failed to parse Xmtp config for ${Env.APP_SERVICE}`,
        };
      },
    });
})();

export const prisma = await (async () => {
  const i = await getInterface(`Postgres`);
  return () =>
    zPrismaConfig.parse(i, {
      errorMap: () => {
        return {
          message: `Failed to parse Postgres config for ${Env.APP_SERVICE}`,
        };
      },
    });
})();

export const webhook = await (async () => {
  return () => zWebhookConfig.parse(null);
})();

export const bridge = await (async () => {
  const s = await getService();
  return () =>
    zBridgeConfig.parse(s, {
      errorMap: () => {
        return {
          message: `Failed to parse Bridge config for ${Env.APP_SERVICE}`,
        };
      },
    });
})();

export const canary = await (async () => {
  return () =>
    zCanaryConfig.parse(null, {
      errorMap: () => {
        return {
          message: `Failed to parse Canary config for ${Env.APP_SERVICE}`,
        };
      },
    });
})();

export const endToEnd = await (async () => {
  const s = await getService();
  return () =>
    zEndToEndConfig.parse(s, {
      errorMap: () => {
        return {
          message: `Failed to parse EndToEnd config for ${Env.APP_SERVICE}`,
        };
      },
    });
})();
