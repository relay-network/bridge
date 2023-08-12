import * as Effect from "./2-effect.js";
import _fetch, { RequestInit } from "node-fetch";

/* *****************************************************************************
 *
 * INTERFACE: iFetch
 *
 * ****************************************************************************/

export const create = ({ feature }: { feature: string }) => {
  const effect = Effect.create({
    api: "fetch",
    feature,
    request: "register",
  });

  effect.attempt();

  const fetch = (request: string) => async (url: string, init: RequestInit) => {
    const effect = Effect.create({
      api: "fetch",
      feature,
      request,
      metadata: { url, method: init.method },
    });

    effect.attempt();

    const response = await (async () => {
      try {
        return await _fetch(url, init);
      } catch (err) {
        effect.failure(err, "fetch(url, init) threw an error");
        throw err;
      }
    })();

    if (!response.ok) {
      effect.failure(
        null,
        `response.ok is false, status code is ${response.status}`
      );
    } else {
      effect.success();
    }

    return response;
  };

  effect.success();

  return fetch;
};
