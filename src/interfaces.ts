import { z } from "zod";
import { Client, DecodedMessage, Conversation } from "@xmtp/xmtp-js";
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import fetch, { RequestInit } from "node-fetch";
import * as Sentry from "@sentry/node";
import { Express } from "express";
import { Wallet } from "@ethersproject/wallet";

const noop = () => null;

const PG_CONNECTION_STRING = z.string().parse(process.env.PG_CONNECTION_STRING);
const APP_ENV = z.string().parse(process.env.APP_ENV);
const APP_NAME = z.string().parse(process.env.APP_NAME);
const APP_INSTANCE = z.string().parse(process.env.APP_INSTANCE);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PG_CONNECTION_STRING,
    },
  },
});

export const iConfig = await prisma.app.findUniqueOrThrow({
  where: {
    name_env_instance: {
      name: APP_NAME,
      env: APP_ENV,
      instance: APP_INSTANCE,
    },
  },
  include: {
    sentryConfig: true,
    loggerConfig: true,
    xmtpConfig: true,
    httpConfig: true,
  },
});

/* ****************************************************************************
 *
 * BOOT THE LOGGER
 *
 * ****************************************************************************/

export const iLogger = pino({
  level: iConfig.loggerConfig.level,
}).child({
  app: iConfig.name,
  appId: iConfig.id,
});

const bootLogger = iLogger.child({
  interface: "boot",
});

/* ****************************************************************************
 *
 * BOOT SENTRY
 *
 * ****************************************************************************/

const sentryLogger = iLogger.child({
  interface: "sentry",
});

const sentryOnIgnore = () => {
  bootLogger.debug({
    effect: "ignoring sentry (not booting it)",
    event: "ignore",
  });
};

const sentryOnBoot = () => {
  bootLogger.debug({
    effect: "boot sentry interface",
  });
};

const sentryOnBootFailure = (err: unknown) => {
  bootLogger.error({
    effect: "boot sentry interface",
    err,
  });
};

const sentryOnRegister = (effect: string) => {
  sentryLogger.debug({
    effect,
    event: "register",
  });
};

const sentryOnRequest = (
  effect: string,
  metadata: { app: string; interface: string; effect: string }
) => {
  sentryLogger.debug({
    effect,
    event: "request",
    metadata,
  });
};

const sentryOnRequestFailure = (
  effect: string,
  err: unknown,
  metadata: { app: string; interface: string; effect: string }
) => {
  sentryLogger.error({
    effect,
    event: "request-fail",
    err,
    metadata,
  });
};

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const sentryOnResponse = (
  effect: string,
  response: unknown,
  metadata: { app: string; interface: string; effect: string }
) => {
  sentryLogger.debug({
    effect,
    event: "response",
    response,
    metadata,
  });
};

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const sentryOnValidateFailure = (
  effect: string,
  err: unknown,
  metadata: { app: string; interface: string; effect: string }
) => {
  sentryLogger.error({
    effect,
    event: "validate-fail",
    err,
    metadata,
  });
};

const sentryOnSuccess = (
  effect: string,
  response: unknown,
  metadata: { app: string; interface: string; effect: string }
) => {
  sentryLogger.debug({
    effect,
    event: "success",
    response,
    metadata,
  });
};

const sentryOnUnknownFailure = (
  effect: string | undefined,
  err: unknown,
  metadata: { message: string }
) => {
  sentryLogger.error({
    effect,
    event: "unknown-fail",
    err,
    metadata,
  });
};

const iSentry = (() => {
  if (iConfig.sentryConfig === null) {
    try {
      sentryOnIgnore();
    } catch (err) {
      sentryOnUnknownFailure(undefined, err, {
        message: "sentryOnIgnore threw an error",
      });
      throw err;
    }

    return null;
  } else {
    try {
      sentryOnBoot();
    } catch (err) {
      sentryOnUnknownFailure(undefined, err, {
        message: "sentryOnBoot threw an error",
      });
      throw err;
    }

    const sentry = (() => {
      try {
        Sentry.init({
          dsn: iConfig.sentryConfig.dsn,
          environment: iConfig.sentryConfig.environment,
          release: iConfig.sentryConfig.release,
          serverName: iConfig.sentryConfig.serverName,
        });
        return Sentry;
      } catch (err) {
        sentryOnBootFailure(err);
        throw err;
      }
    })();

    return ({ effect }: { effect: string }) => {
      try {
        sentryOnRegister(effect);
      } catch (err) {
        sentryOnUnknownFailure(effect, err, {
          message: "sentryOnRegister threw an error",
        });
        throw err;
      }

      return {
        captureException: async (
          error: unknown,
          opts: { app: string; interface: string; effect: string }
        ) => {
          try {
            sentryOnRequest(effect, opts);
          } catch (err) {
            sentryOnUnknownFailure(effect, err, {
              message: "sentryOnRequest threw an error",
            });
            throw err;
          }

          try {
            sentry.captureException(error, {
              tags: {
                app: opts.app,
                interface: opts.interface,
                effect: opts.effect,
              },
            });
          } catch (err) {
            sentryOnRequestFailure(effect, err, opts);
            throw err;
          }

          try {
            sentryOnSuccess(effect, undefined, opts);
          } catch (err) {
            sentryOnUnknownFailure(effect, err, {
              message: "sentryOnSuccess threw an error",
            });
            throw err;
          }
        },
      };
    };
  }
})();

/* ****************************************************************************
 *
 * BOOT PRISMA
 *
 * ****************************************************************************/

const prismaLogger = iLogger.child({
  interface: "prisma",
});

const prismaOnBoot = () => {
  bootLogger.debug({
    effect: "boot prisma interface",
  });
};

const prismaOnBootFailure = (err: unknown) => {
  bootLogger.error({
    effect: "boot prisma interface",
    err,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "prismaOnBootFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "prisma",
      effect: "boot prisma interface",
    });
  }
};

const prismaOnRegister = (effect: string) => {
  prismaLogger.debug({
    effect,
    event: "register",
  });
};

const prismaOnRequest = (
  effect: string,
  metadata: { operation: string; model: string }
) => {
  prismaLogger.debug({
    effect,
    event: "request",
    metadata,
  });
};

const prismaOnRequestFailure = (
  effect: string,
  err: unknown,
  metadata: { operation: string; model: string }
) => {
  prismaLogger.error({
    effect,
    event: "request-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "prismaOnRequestFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "prisma",
      effect,
    });
  }
};

const prismaOnResponse = (
  effect: string,
  response: unknown,
  metadata: { operation: string; model: string }
) => {
  prismaLogger.debug({
    effect,
    event: "response",
    response,
    metadata,
  });
};

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const prismaOnValidateFailure = (
  effect: string,
  err: unknown,
  metadata: { operation: string; model: string }
) => {
  prismaLogger.error({
    effect,
    event: "validate-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "prismaOnValidateFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "prisma",
      effect,
    });
  }
};

const prismaOnSuccess = (
  effect: string,
  response: unknown,
  metadata: { operation: string; model: string }
) => {
  prismaLogger.debug({
    effect,
    event: "success",
    response,
    metadata,
  });
};

const prismaOnUnknownFailure = (
  effect: string | undefined,
  err: unknown,
  metadata: { message: string }
) => {
  prismaLogger.error({
    effect,
    event: "unknown-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "prismaOnUnknownFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "prisma",
      effect: effect ?? "unknown",
    });
  }
};

export const iPrisma = await (async () => {
  try {
    prismaOnBoot();
  } catch (err) {
    prismaOnUnknownFailure(undefined, err, {
      message: "prismaOnBoot threw an error",
    });
    throw err;
  }

  try {
    await prisma.$connect();
  } catch (err) {
    prismaOnBootFailure(err);
    throw err;
  }

  return ({ effect }: { effect: string }) => {
    try {
      prismaOnRegister(effect);
    } catch (err) {
      prismaOnUnknownFailure(effect, err, {
        message: "prismaOnRegister threw an error",
      });
      throw err;
    }
    return prisma.$extends({
      query: {
        async $queryRaw({ args, query, operation }) {
          try {
            prismaOnRequest(effect, { operation, model: "queryRaw" });
            const value = await query(args);
            try {
              prismaOnResponse(effect, value, { operation, model: "queryRaw" });
            } catch (err) {
              prismaOnUnknownFailure(effect, err, {
                message: "prismaOnResponse threw an error",
              });
              throw err;
            }
            try {
              prismaOnSuccess(effect, value, { operation, model: "queryRaw" });
            } catch (err) {
              prismaOnUnknownFailure(effect, err, {
                message: "prismaOnSuccess threw an error",
              });
              throw err;
            }

            return value;
          } catch (error) {
            prismaOnRequestFailure(effect, error, {
              operation,
              model: "queryRaw",
            });
            throw error;
          }
        },
        async $executeRaw({ args, query, operation }) {
          try {
            prismaOnRequest(effect, { operation, model: "executeRaw" });
            return await query(args);
          } catch (error) {
            prismaOnRequestFailure(effect, error, {
              operation,
              model: "executeRaw",
            });
            throw error;
          }
        },
        $allModels: {
          async $allOperations({ operation, model, args, query }) {
            try {
              prismaOnRequest(effect, { operation, model });
              return await query(args);
            } catch (error) {
              prismaOnRequestFailure(effect, error, { operation, model });
              throw error;
            }
          },
        },
      },
    });
  };
})();

/* ****************************************************************************
 *
 * BOOT FETCH
 *
 * ****************************************************************************/

const fetchLogger = iLogger.child({
  interface: "fetch",
});

const fetchOnBoot = () => {
  bootLogger.debug({
    effect: "boot fetch interface",
  });
};

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const fetchOnBootFailure = (err: unknown) => {
  bootLogger.error({
    effect: "boot fetch interface",
    err,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "fetchOnBootFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "fetch",
      effect: "boot fetch interface",
    });
  }
};

const fetchOnRegister = (effect: string) => {
  fetchLogger.debug({
    effect,
    event: "register",
  });
};

const fetchOnRequest = (
  effect: string,
  metadata: { url: string; init: RequestInit }
) => {
  fetchLogger.debug({
    effect,
    event: "request",
    metadata,
  });
};

const fetchOnRequestFailure = (
  effect: string,
  err: unknown,
  metadata: { url: string; init: RequestInit }
) => {
  fetchLogger.error({
    effect,
    event: "request-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "fetchOnRequestFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "fetch",
      effect,
    });
  }
};

const fetchOnResponse = (
  effect: string,
  response: unknown,
  metadata: { url: string; init: RequestInit }
) => {
  fetchLogger.debug({
    effect,
    event: "response",
    response,
    metadata,
  });
};

const fetchOnValidateFailure = (
  effect: string,
  err: unknown,
  metadata: { url: string; init: RequestInit }
) => {
  fetchLogger.error({
    effect,
    event: "validate-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "fetchOnValidateFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "fetch",
      effect,
    });
  }
};

const fetchOnSuccess = (
  effect: string,
  response: unknown,
  metadata: { url: string; init: RequestInit }
) => {
  fetchLogger.debug({
    effect,
    event: "success",
    response,
    metadata,
  });
};

const fetchOnUnknownFailure = (
  effect: string | undefined,
  err: unknown,
  metadata: { message: string }
) => {
  fetchLogger.error({
    effect,
    event: "unknown-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "fetchOnUnknownFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "fetch",
      effect: effect ?? "unknown",
    });
  }
};

// See comment below about why this type exists.
type C<R> = {
  effect: string;
  zResponse: R;
};

export const iFetch = (() => {
  try {
    fetchOnBoot();
  } catch (err) {
    fetchOnUnknownFailure(undefined, err, {
      message: "fetchOnBoot threw an error",
    });
    throw err;
  }

  // Using C<R> because for some reason this line breaks my syntax highlighting
  // whenever it is broken into to multiple lines.
  return <R extends z.ZodTypeAny>({ effect, zResponse }: C<R>) => {
    try {
      fetchOnRegister(effect);
    } catch (err) {
      fetchOnUnknownFailure(effect, err, {
        message: "fetchOnRegister threw an error",
      });
      throw err;
    }

    return async (
      url: string,
      init: RequestInit
    ): Promise<z.infer<typeof zResponse>> => {
      try {
        fetchOnRequest(effect, { url, init });
      } catch (err) {
        fetchOnUnknownFailure(effect, err, {
          message: "fetchOnRequest threw an error",
        });
        throw err;
      }

      const response = await (async () => {
        try {
          return await fetch(url, init);
        } catch (err) {
          fetchOnRequestFailure(effect, err, { url, init });
          throw err;
        }
      })();

      try {
        fetchOnResponse(effect, response, { url, init });
      } catch (err) {
        fetchOnUnknownFailure(effect, err, {
          message: "fetchOnResponse threw an error",
        });
        throw err;
      }

      try {
        z.number().gte(200).lte(299).parse(response.status);
      } catch (err) {
        fetchOnValidateFailure(effect, err, { url, init });
        throw err;
      }

      const json = await (async () => {
        try {
          return await response.json();
        } catch (err) {
          fetchOnValidateFailure(effect, err, { url, init });
          throw err;
        }
      })();

      const validated = (() => {
        try {
          return zResponse.parse(json);
        } catch (err) {
          fetchOnValidateFailure(effect, err, { url, init });
          throw err;
        }
      })();

      try {
        fetchOnSuccess(effect, validated, { url, init });
      } catch (err) {
        fetchOnUnknownFailure(effect, err, {
          message: "fetchOnSuccess threw an error",
        });
        throw err;
      }

      return validated;
    };
  };
})();

/* ****************************************************************************
 *
 * BOOT XMTP CLIENT
 *
 * ****************************************************************************/

const xmtpServerLogger = iLogger.child({
  interface: "xmtp-server",
});

const xmtpServerOnBoot = () => {
  bootLogger.debug({
    effect: "boot xmtp-server interface",
  });
};

const xmtpServerOnBootFailure = (err: unknown) => {
  bootLogger.error({
    effect: "boot xmtp-server interface",
    err,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "xmtpServerOnBootFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "xmtp-server",
      effect: "boot xmtp-server interface",
    });
  }
};

const xmtpServerOnRegister = (effect: string) => {
  xmtpServerLogger.debug({
    effect,
    event: "register",
  });
};

const xmtpServerOnRequest = (effect: string, metadata: { event: string }) => {
  xmtpServerLogger.debug({
    effect,
    event: "request",
    metadata,
  });
};

const xmtpServerOnRequestFailure = (
  effect: string,
  err: unknown,
  metadata: { event: string }
) => {
  xmtpServerLogger.error({
    effect,
    event: "request-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "xmtpServerOnRequestFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "xmtp-server",
      effect,
    });
  }
};

const xmtpServerOnResponse = (
  effect: string,
  response: unknown,
  metadata: { event: string }
) => {
  xmtpServerLogger.debug({
    effect,
    event: "response",
    response,
    metadata,
  });
};

const xmtpServerOnValidateFailure = (
  effect: string,
  err: unknown,
  metadata: { event: string }
) => {
  xmtpServerLogger.error({
    effect,
    event: "validate-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "xmtpServerOnValidateFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "xmtp-server",
      effect,
    });
  }
};

const xmtpServerOnSuccess = (
  effect: string,
  response: unknown,
  metadata: { event: string }
) => {
  xmtpServerLogger.debug({
    effect,
    event: "success",
    response,
    metadata,
  });
};

const xmtpServerOnUnknownFailure = (
  effect: string | undefined,
  err: unknown,
  metadata: { message: string }
) => {
  xmtpServerLogger.error({
    effect,
    event: "unknown-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "xmtpServerOnUnknownFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "xmtp-server",
      effect: effect ?? "unknown",
    });
  }
};

type XmtpHandler = {
  effect: string;
  predicate: ({ message }: { message: DecodedMessage }) => boolean;
  handler: ({ message }: { message: DecodedMessage }) => Promise<void>;
};

export const iXmtpServer = await (async () => {
  try {
    xmtpServerOnBoot();
  } catch (error) {
    xmtpServerOnUnknownFailure(undefined, error, {
      message: "xmtpServerOnBoot threw an error",
    });
    throw error;
  }

  const wallet = (() => {
    try {
      return new Wallet(pk);
    } catch (error) {
      xmtpServerOnBootFailure(error);
      throw error;
    }
  })();

  const client = await (async () => {
    try {
      return await Client.create(wallet, { env: "production" });
    } catch (error) {
      xmtpServerOnBootFailure(error);
      throw error;
    }
  })();

  const stream = await (async () => {
    try {
      return await client.conversations.streamAllMessages();
    } catch (error) {
      xmtpServerOnBootFailure(error);
      throw error;
    }
  })();

  const listeners: Array<{
    effect: string;
    predicate: ({ message }: { message: DecodedMessage }) => boolean;
    handler: ({ message }: { message: DecodedMessage }) => Promise<void>;
  }> = [];

  (async () => {
    for await (const message of stream) {
      const listener = listeners.find(({ predicate }) =>
        predicate({ message })
      );

      if (listener === undefined) {
        // do nothing
      } else {
        xmtpServerOnRequest(listener.effect, { event: "message received" });
        listener
          .handler({ message })
          .then(() => {
            try {
              xmtpServerOnSuccess(listener.effect, undefined, {
                event: "message received",
              });
            } catch (error) {
              // do nothing
            }
          })
          .catch((error) => {
            xmtpServerOnRequestFailure(listener.effect, error, {
              event: "message received",
            });
          });
      }
    }
  })();

  return ({ effect, predicate, handler }: XmtpHandler) => {
    xmtpServerOnRegister(effect);
    listeners.push({ effect, predicate, handler });
  };
})();

/* ****************************************************************************
 *
 * BOOT XMTP SENDER
 *
 *
 * ****************************************************************************/

const xmtpClientLogger = iLogger.child({
  interface: "xmtp-client",
});

const xmtpClientOnBoot = () => {
  bootLogger.debug({
    effect: "boot xmtp-client interface",
  });
};

const xmtpClientOnBootFailure = (err: unknown) => {
  bootLogger.error({
    effect: "boot xmtp-client interface",
    err,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "xmtpClientOnBootFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "xmtp-client",
      effect: "boot xmtp-client interface",
    });
  }
};

const xmtpClientOnRegister = (effect: string) => {
  xmtpClientLogger.debug({
    effect,
    event: "register",
  });
};

const xmtpClientOnRequest = (
  effect: string,
  metadata: { toAddress: string; toConversationId?: string }
) => {
  xmtpClientLogger.debug({
    effect,
    event: "request",
    metadata,
  });
};

const xmtpClientOnRequestFailure = (
  effect: string,
  err: unknown,
  metadata: { toAddress: string; toConversationId?: string }
) => {
  xmtpClientLogger.error({
    effect,
    event: "request-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "xmtpClientOnRequestFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "xmtp-client",
      effect,
    });
  }
};

const xmtpClientOnResponse = (
  effect: string,
  response: unknown,
  metadata: { toAddress: string; toConversationId?: string; msg: string }
) => {
  xmtpClientLogger.debug({
    effect,
    event: "response",
    response,
    metadata,
  });
};

const xmtpClientOnValidateFailure = (
  effect: string,
  err: unknown,
  metadata: { toAddress: string; toConversationId?: string }
) => {
  xmtpClientLogger.error({
    effect,
    event: "validate-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "xmtpClientOnValidateFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "xmtp-client",
      effect,
    });
  }
};

const xmtpClientOnSuccess = (
  effect: string,
  response: unknown,
  metadata: { toAddress: string; toConversationId?: string }
) => {
  xmtpClientLogger.debug({
    effect,
    event: "success",
    response,
    metadata,
  });
};

const xmtpClientOnUnknownFailure = (
  effect: string | undefined,
  err: unknown,
  metadata: unknown
) => {
  xmtpClientLogger.error({
    effect,
    event: "unknown-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "xmtpClientOnUnknownFailure" }).captureException(err, {
      app: iConfig.name,
      interface: "xmtp-client",
      effect: effect ?? "unknown",
    });
  }
};

export const iXmtpClient = await (async () => {
  try {
    xmtpClientOnBoot();
  } catch (error) {
    xmtpClientOnUnknownFailure(undefined, error, {
      message: "xmtpClientOnBoot threw an error",
    });
    throw error;
  }

  const wallet = (() => {
    try {
      return new Wallet(pk);
    } catch (error) {
      xmtpClientOnBootFailure(error);
      throw error;
    }
  })();

  const client = await (async () => {
    try {
      return await Client.create(wallet, { env: "production" });
    } catch (error) {
      xmtpClientOnBootFailure(error);
      throw error;
    }
  })();

  return ({ effect }: { effect: string }) => {
    xmtpClientOnRegister(effect);
    return async ({ toAddress, toConversationId }: Send) => {
      xmtpClientOnRequest(effect, { toAddress, toConversationId });

      const conversation = await (async () => {
        try {
          return await client.conversations.newConversation(
            toAddress,
            (() => {
              if (toConversationId === undefined) {
                return undefined;
              } else {
                return {
                  conversationId: toConversationId,
                  metadata: {},
                };
              }
            })()
          );
        } catch (error) {
          xmtpClientOnRequestFailure(effect, error, {
            toAddress,
            toConversationId,
            msg,
          });
          throw error;
        }
      })();

      const sent = await (async () => {
        try {
          return await conversation.send(msg);
        } catch (error) {
          xmtpClientOnRequestFailure(effect, error, {
            toAddress,
            toConversationId,
            msg,
          });
          throw error;
        }
      })();

      xmtpClientOnResponse(effect, sent, { toAddress, toConversationId });

      try {
        xmtpClientOnSuccess(effect, sent, {
          toAddress,
          toConversationId,
        });
      } catch (error) {
        xmtpClientOnUnknownFailure(effect, error, {
          message: "xmtpClientOnSuccess threw an error",
        });
        throw error;
      }

      return sent;
    };
  };
})();

/* ****************************************************************************
 *
 * BOOT EXPRESS
 *
 * ****************************************************************************/

const expressLogger = iLogger.child({
  interface: "express",
});

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const expressOnBoot = () => {
  bootLogger.debug({
    effect: "boot express interface",
  });
};

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const expressOnBootFailure = (err: unknown) => {
  bootLogger.error({
    effect: "boot express interface",
    err,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "expressOnBootFailure" }).captureException(err, {
      app: config.name,
      interface: "express",
      effect: "boot express interface",
    });
  }
};

const expressOnRegister = (effect: string) => {
  expressLogger.debug({
    effect,
    event: "register",
  });
};

const expressOnRequest = (
  effect: string,
  metadata: { method: string; path: string; body: unknown; query: unknown }
) => {
  expressLogger.debug({
    effect,
    event: "request",
    metadata,
  });
};

const expressOnRequestFailure = (
  effect: string,
  err: unknown,
  metadata: { method: string; path: string; body: unknown; query: unknown }
) => {
  expressLogger.error({
    effect,
    event: "request-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "expressOnRequestFailure" }).captureException(err, {
      app: config.name,
      interface: "express",
      effect,
    });
  }
};

const expressOnResponse = (
  effect: string,
  response: unknown,
  metadata: { method: string; path: string; body: unknown; query: unknown }
) => {
  expressLogger.debug({
    effect,
    event: "response",
    response,
    metadata,
  });
};

const expressOnValidateFailure = (
  effect: string,
  err: unknown,
  metadata: { method: string; path: string; body: unknown; query: unknown }
) => {
  expressLogger.error({
    effect,
    event: "validate-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "expressOnValidateFailure" }).captureException(err, {
      app: config.name,
      interface: "express",
      effect,
    });
  }
};

const expressOnUnknownFailure = (
  effect: string | undefined,
  err: unknown,
  metadata: { message: string }
) => {
  expressLogger.error({
    effect,
    event: "unknown-fail",
    err,
    metadata,
  });
  if (iSentry === null) {
    noop();
  } else {
    iSentry({ effect: "expressOnUnknownFailure" }).captureException(err, {
      app: config.name,
      interface: "express",
      effect: effect ?? "unknown",
    });
  }
};

const expressOnSuccess = (
  effect: string,
  response: unknown,
  metadata: { method: string; path: string; body: unknown; query: unknown }
) => {
  expressLogger.debug({
    effect,
    event: "success",
    response,
    metadata,
  });
};

type Handler<B, Q, R> = ({ b, q }: { b: B; q: Q }) => Promise<R>;

type ExpressEffect<
  B extends z.ZodTypeAny,
  Q extends z.ZodTypeAny,
  R extends z.ZodTypeAny
> = {
  effect: string;
  server: Express;
  url: string;
  zBody: B;
  zQuery: Q;
  zResponse: R;
  method: "get" | "post" | "put" | "delete" | "patch";
  handler: Handler<z.infer<B>, z.infer<Q>, z.infer<R>>;
};

export const iExpress = (() => {
  // NOTE, the weird formatting of types here is because it breaks my syntax
  // when they're inlined.
  return <
    B extends z.ZodTypeAny,
    Q extends z.ZodTypeAny,
    R extends z.ZodTypeAny
  >(
    e: ExpressEffect<B, Q, R>
  ) => {
    const { effect, server, url, zBody, zQuery, zResponse, method, handler } =
      e;

    try {
      expressOnRegister(effect);
    } catch (err) {
      expressOnUnknownFailure(effect, err, {
        message: "expressOnRegister threw an error",
      });
    }

    server[method](url, async (req, res) => {
      try {
        expressOnRequest(effect, {
          method,
          path: url,
          body: req.body,
          query: req.query,
        });
      } catch (err) {
        expressOnUnknownFailure(effect, err, {
          message: "expressOnRequest threw an error",
        });
      }

      let body: z.infer<typeof zBody>;
      try {
        body = zBody.parse(req.body);
      } catch (err) {
        expressOnValidateFailure(effect, err, {
          method,
          path: url,
          body: req.body,
          query: req.query,
        });
        return res.status(400).json({ err });
      }

      let query: z.infer<typeof zQuery>;
      try {
        query = zQuery.parse(req.query);
      } catch (err) {
        expressOnValidateFailure(effect, err, {
          method,
          path: url,
          body: req.body,
          query: req.query,
        });
        return res.status(400).json({ err });
      }

      let response: z.infer<typeof zResponse>;
      try {
        response = await handler({ b: body, q: query });
      } catch (err) {
        expressOnRequestFailure(effect, err, {
          method,
          path: url,
          body: req.body,
          query: req.query,
        });
        return res.status(500).json({ err });
      }

      try {
        zResponse.parse(response);
      } catch (err) {
        expressOnUnknownFailure(effect, err, {
          message:
            "zResponse.parse threw an error, this should be impossible if we did typing correctly",
        });
        return res.status(500).json({ err });
      }

      try {
        expressOnResponse(effect, response, {
          method,
          path: url,
          body: req.body,
          query: req.query,
        });
      } catch (err) {
        expressOnUnknownFailure(effect, err, {
          message: "expressOnResponse threw an error",
        });
      }

      res.status(200).json(response);

      try {
        expressOnSuccess(effect, response, {
          method,
          path: url,
          body: req.body,
          query: req.query,
        });
      } catch (err) {
        expressOnUnknownFailure(effect, err, {
          message: "expressOnSuccess threw an error",
        });
        throw err;
      }
    });
  };
})();
