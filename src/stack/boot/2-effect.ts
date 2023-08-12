import pino from "pino";
import * as Env from "./0-env.js";
import * as Config from "./1-config.js";
import { v4 as uuid } from "uuid";

export type Effect = {
  /**
   * Every effect is tied to the application it happened within. Every
   * application we deploy is uniquely identified by an app/env/instance triple.
   * The app name must be either the name of the project repo, or the name of
   * the package, whichever is more specific.
   */
  app: string;

  /**
   * "dev" -> local developer environment
   * "test" -> fully dockerized end-to-end test environment
   * "prod" -> production environment
   */
  env: "dev" | "test" | "prod";

  /**
   * The instance field exists mostly because app/env is sometimes not enough to
   * uniquely identify an application. For example, we may deploy the same application
   * multiple times in the same environment for different customers.
   */
  instance: string;

  /**
   * Every effect belongs to a particular service. The service field is the name
   * of the service that is emitting the effect. Examples of services are
   * "prisma", "express", or "fetch".
   *
   * One thing to note is that we use "service" in a more narrow sense than is
   * typical. Typicall a service is a collection of related functionality. In
   * our case, a service is more like a collection of related IO.
   */
  service: string;

  /**
   * The feature field should provide a description of the domain-level "reason"
   * behind the effect. A developer should be able to look at the logs, read each
   * "feature" field, and have a fairly precise understanding of what user-facing
   * functionality is being affected.
   */
  feature: string;

  /**
   * Every effect has a set of inputs. The request field is a developer-friendly
   * human-readable string that describes the context surrounding the effect.
   */
  request: string;

  /**
   * Every effect has three possible statuses: attempt, success, and failure. The
   * attempt event is emitted when the effect is first attempted. The success
   * event is emitted when the effect is successfully completed. The failure
   * event is emitted when the effect fails.
   */
  status: "attempt" | "success" | "failure";

  /**
   * Every effect
   */
  event: string;

  /**
   * The metadata field is a semi-structured string (like the id) that provides
   * whatever additional information is necessary for application
   * troubleshooting. The metadata field should be used sparingly. If we rely
   * too heavily on the metadata field it's a sign that we need to redesign our
   * approach to observability.
   */
  metadata: string;
};

const devLogger = pino({
  level: Config.logger().level,
  formatters: {
    level: (label, number) => {
      return {
        level: (() => {
          if (number === 50) {
            return label.toUpperCase().padStart(10);
          } else {
            return label.padEnd(10);
          }
        })(),
      };
    },
  },
  base: {},
  timestamp: false,
}).child({
  service: Env.APP_SERVICE,
});

const errDevLogger = pino({
  transport: {
    target: "pino/file",
    options: {
      destination: `./build/${Env.APP_NAME}.${Env.APP_SERVICE}.error.log`,
    },
  },
});

const prodLogger = pino({ level: Config.logger().level }).child(Config.env());

export const create = ({
  api,
  feature,
  request,
  metadata,
}: {
  api: string;
  feature: string;
  request: string;
  metadata?: unknown;
}) => {
  const dl = devLogger.child({
    api,
    feature,
    request,
    metadata,
  });

  const edl = errDevLogger.child({
    api,
    feature,
    request,
    metadata,
  });

  const pl = prodLogger.child({
    api,
    feature,
    request,
    metadata,
  });

  return {
    attempt: (event?: string) => {
      if (Config.env().env === "production") {
        pl.debug({ event, status: "attempt" });
      } else {
        dl.debug({ event, status: "attempt" });
      }
    },

    success: (event?: string) => {
      if (Config.env().env === "production") {
        pl.info({ event, status: "success" });
      } else {
        dl.info({ event, status: "success" });
      }
    },

    failure: (err: unknown, event?: string) => {
      if (Config.env().env === "production") {
        pl.error({ event, status: "failure", err });
      } else {
        const errorId = uuid();
        dl.error({ event, status: "failure", errorId });
        edl.error({ event, status: "failure", errorId, err });
      }
    },
  };
};
