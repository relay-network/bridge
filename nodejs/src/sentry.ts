import * as Sentry from "@sentry/node";

export const createInterface = ({
  dsn,
  release,
  environment,
}: {
  dsn: string;
  release: string;
  environment: string;
}): {
  captureException: (typeof Sentry)["captureException"];
} => {
  Sentry.init({
    dsn,
    release,
    environment,
    serverName: "api",
  });

  return {
    captureException: (error, opts) => {
      return Sentry.captureException(error, opts);
    },
  };
};
