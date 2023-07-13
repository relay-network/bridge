import { z } from "zod";
import * as Console from "./console.js";
import * as Process from "./process.js";
import * as Express from "./express.js";

type Request = {
  url: string;
  method: string;
  body: unknown;
};

/* ****************************************************************************
 *
 * BOOT LOGGER
 *
 * ****************************************************************************/

const _logger = Console.createInterface({ level: "debug" });

/* ****************************************************************************
 *
 * BOOT ENV
 *
 * ****************************************************************************/

const _env = Process.createInterface({
  zEnv: z.object({
    XMTPB_CANARY_PORT: z.string(),
  }),
  onCreate: () => {
    _logger.debug("ATTEMPTING TO CREATE INTERFACE FOR PROCESS-ENV");
  },
  onCreateError: (err) => {
    _logger.error("ERROR WHILE CREATING INTERFACE FOR PROCESS-ENV", { err });
  },
  onRead: ({ name }) => {
    _logger.debug("READING INTERFACE FOR PROCESS-ENV", {
      description: name,
    });
  },
  onReadError: ({ error, name }) => {
    _logger.error("ERROR WHILE READING INTERFACE FOR PROCESS-ENV", {
      error,
      description: name,
    });
  },
  onError: ({ name, error }) => {
    _logger.error("UNCAUGHT ERROR WITHIN INTERFACE FOR PROCESS-ENV", {
      error,
      description: name,
    });
  },
});

/* ****************************************************************************
 *
 * BOOT EXPRESS
 *
 * ****************************************************************************/

const onRequest = ({ req }: { req: Request }) => {
  _logger.debug("EXPRESS HANDLER GOT A REQUEST", {
    url: req.url,
    method: req.method,
    body: req.body,
  });
};

const onSuccess = ({ req, result }: { req: Request; result: unknown }) => {
  _logger.debug("EXPRESS HANDLER RETURNED A RESPONSE", {
    url: req.url,
    method: req.method,
    result,
  });
};

const onBodyValidationError = ({
  req,
  error,
}: {
  req: Request;
  error: unknown;
}) => {
  _logger.error("EXPRESS HANDLER GOT AN INVALID BODY", {
    url: req.url,
    method: req.method,
    error,
  });
};

const onResponseValidationError = ({
  req,
  result,
  error,
}: {
  req: Request;
  result: unknown;
  error: unknown;
}) => {
  _logger.error("EXPRESS HANDLER IMPL RETURNED AN INVALID VALUE", {
    url: req.url,
    method: req.method,
    result,
    error,
  });
};

const onHandlerError = ({ req, error }: { req: Request; error: unknown }) => {
  _logger.error("UNCAUGHT ERROR INSIDE EXPRESS HANDLER", {
    url: req.url,
    method: req.method,
    error,
  });
};

const _express = Express.createInterface({
  onRequest,
  onSuccess,
  onBodyValidationError,
  onResponseValidationError,
  onHandlerError,
});

/* ****************************************************************************
 *
 * EXPORT INTERFACES
 *
 * ****************************************************************************/

export const logger = _logger;
export const env = _env;
export const express = _express;
