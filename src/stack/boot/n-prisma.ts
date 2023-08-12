import { PrismaClient } from "@prisma/client";
import * as Config from "./1-config.js";
import * as Effect from "./2-effect.js";

const client = (() => {
  const effect = Effect.create({
    api: "boot-prisma-client",
    feature: "boot-prisma-client",
    request: "new PrismaClient()",
  });

  effect.attempt();

  const created = (() => {
    try {
      return new PrismaClient({
        datasources: {
          db: {
            url: Config.prisma().connection,
          },
        },
      });
    } catch (err) {
      effect.failure(err, "new PrismaClient() threw an error");
      throw err;
    }
  })();

  effect.success();

  return created;
})();

const effect = Effect.create({
  api: "boot-prisma-client",
  feature: "boot-prisma-client",
  request: "prisma.$connect()",
});

effect.attempt();

try {
  await client.$connect();
} catch (err) {
  effect.failure(err, "prisma.$connect() threw an error");
  throw err;
}

effect.success();

export const create = ({ feature }: { feature: string }) => {
  const effect = Effect.create({
    api: "prisma",
    feature,
    request: "register",
  });

  effect.attempt();

  return (request: string) => {
    return client.$extends({
      query: {
        async $queryRaw({ args, query, operation }: unknown) {
          const effect = Effect.create({
            api: "prisma",
            feature,
            request,
            metadata: { operation },
          });

          effect.attempt();

          const value = await (async () => {
            try {
              return await query(args);
            } catch (error) {
              effect.failure(error, "query(args) threw an error");
              throw error;
            }
          })();

          effect.success();

          return value;
        },
        async $executeRaw({ args, query, operation }: unknown) {
          const effect = Effect.create({
            api: "prisma",
            feature,
            request,
            metadata: { operation },
          });

          const value = await (async () => {
            try {
              return await query(args);
            } catch (error) {
              effect.failure(error, "query(args) threw an error");
              throw error;
            }
          })();

          effect.success();

          return value;
        },
        $allModels: {
          async $allOperations({ operation, model, args, query }: unknown) {
            const effect = Effect.create({
              api: "prisma",
              feature,
              request,
              metadata: { operation, model },
            });

            effect.attempt();

            const value = await (async () => {
              try {
                return await query(args);
              } catch (error) {
                effect.failure(error, "query(args) threw an error");
                throw error;
              }
            })();

            effect.success();

            return value;
          },
        },
      },
    });
  };
};
