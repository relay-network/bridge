import { z } from "zod";
import * as Effect from "./2-effect.js";
import { Express } from "express";

type ZA = z.ZodTypeAny;

type Result<T> =
  | {
      status: 400 | 401 | 403 | 500;
      error: string;
      data?: undefined;
    }
  | {
      status: 200;
      error?: undefined;
      data: T;
    };

type Handler<B, Q, P, R> = (i: { b: B; q: Q; p: P }) => Promise<Result<R>>;

type Route<B extends ZA, Q extends ZA, P extends ZA, R extends ZA> = {
  server: Express;
  url: string;
  zBody: B;
  zQuery: Q;
  zParams: P;
  zResponse: R;
  method: "get" | "post" | "put" | "delete" | "patch";
  handler: Handler<z.infer<B>, z.infer<Q>, z.infer<P>, z.infer<R>>;
};

export const create = ({ feature }: { feature: string }) => {
  return (request: string) => {
    return <B extends ZA, Q extends ZA, P extends ZA, R extends ZA>(
      opts: Route<B, Q, P, R>
    ) => {
      const effect = Effect.create({
        api: "express",
        feature,
        request: "register",
      });

      effect.attempt();

      opts.server[opts.method](opts.url, async (req, res) => {
        const effect = Effect.create({
          api: "express",
          feature,
          request,
          metadata: { method: opts.method, url: opts.url },
        });

        effect.attempt();

        let p;
        try {
          p = opts.zParams.parse(req.params);
        } catch (err) {
          effect.failure(
            err,
            "opts.zParams(req.params) request params threw an error"
          );
          return res.status(400).json({ error: err });
        }

        let q;
        try {
          q = opts.zQuery.parse(req.query);
        } catch (err) {
          effect.failure(
            err,
            "opts.zQuery(req.query) request query threw an error"
          );
          return res.status(400).json({ error: err });
        }

        let b;
        try {
          b = opts.zBody.parse(req.body);
        } catch (err) {
          effect.failure(
            err,
            "opts.zBody(req.body) request body threw an error"
          );
          return res.status(400).json({ error: err });
        }

        let result;
        try {
          result = await opts.handler({ b, q, p });
        } catch (err) {
          effect.failure(err, "handler threw an error");
          return res.status(500).json({ error: err });
        }

        if (result.status !== 200) {
          return res.status(result.status).json({ error: result.error });
        }

        let validated;
        try {
          validated = opts.zResponse.parse(result.data);
        } catch (err) {
          effect.failure(
            err,
            "opts.zResponse(result.data) response threw an error"
          );
          return res.status(500).json({ error: err });
        }

        try {
          res.status(200).json(validated);

          effect.success();

          return res;
        } catch (err) {
          effect.failure(err, "res.status(200).json(validated) threw an error");
          return res.status(500).json({ error: err });
        }
      });

      effect.success();
    };
  };
};
