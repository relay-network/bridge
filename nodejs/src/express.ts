import { z } from "zod";
import { Request } from "express";
import express from "express";

export type HttpMethod =
  | "all"
  | "get"
  | "post"
  | "put"
  | "delete"
  | "patch"
  | "options"
  | "head";

export type Route<B extends z.ZodTypeAny, R extends z.ZodTypeAny> = {
  url: string;
  zBody: B;
  zResponse: R;
  method: HttpMethod;
};

export const createRoute = <B extends z.ZodTypeAny, R extends z.ZodTypeAny>(
  route: Route<B, R>
): Route<B, R> => {
  return {
    ...route,
  };
};

export const createInterface = ({
  onRequest,
  onSuccess,
  onBodyValidationError,
  onHandlerError,
  onResponseValidationError,
}: {
  onRequest: ({ req }: { req: Request }) => void;
  onSuccess: ({ req, result }: { req: Request; result: unknown }) => void;
  onBodyValidationError: ({
    req,
    error,
  }: {
    req: Request;
    error: unknown;
  }) => void;
  onHandlerError: ({ req, error }: { req: Request; error: unknown }) => void;
  onResponseValidationError: ({
    req,
    result,
    error,
  }: {
    req: Request;
    result: unknown;
    error: unknown;
  }) => void;
}) => {
  const bind = <B extends z.ZodTypeAny, R extends z.ZodTypeAny>({
    toServer,
    toRoute,
    usingHandler,
  }: {
    toServer: express.Express;
    toRoute: Route<B, R>;
    usingHandler: (body: z.infer<B>) => Promise<z.infer<R>>;
  }) => {
    toServer[toRoute.method](toRoute.url, async (req, res) => {
      onRequest({ req });

      let body: z.infer<B>;
      try {
        body = toRoute.zBody.parse(req.body);
      } catch (error) {
        onBodyValidationError({ req, error });
        return res.status(400).send({ error: "Invalid body" });
      }

      let result: z.infer<R>;
      try {
        result = await usingHandler(body);
      } catch (error) {
        onHandlerError({ req, error });
        return res.status(500).send({ error: "Server error" });
      }

      try {
        const response = toRoute.zResponse.parse(result);
        try {
          onSuccess({ req, result });
        } catch (error) {
          // do nothing
        }
        return res.status(200).send(response);
      } catch (error) {
        onResponseValidationError({ req, result, error });
        return res.status(500).send({ error: "Server error" });
      }
    });
  };

  return { bind };
};
