import * as Effect from "./2-effect.js";

export const create = ({ feature }: { feature: string }) => {
  const effect = Effect.create({
    api: "zod",
    feature,
    request: "register",
  });

  effect.attempt();

  return (request: string) => {
    const invariant = <P>(parse: (val: unknown) => Promise<P>) => {
      const effect = Effect.create({
        api: "invariant",
        feature,
        request,
      });

      return async (val?: unknown) => {
        effect.attempt();

        const value = await (async () => {
          try {
            return await parse(val);
          } catch (err) {
            effect.failure(err, "parse(val) threw an error");
            throw err;
          }
        })();

        effect.success();

        return value;
      };
    };

    effect.success();

    return invariant;
  };
};
