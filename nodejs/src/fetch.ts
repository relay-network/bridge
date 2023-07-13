import { z } from "zod";
import fetch from "node-fetch";

type U = Parameters<typeof fetch>[0];
type I = Parameters<typeof fetch>[1];
type C<R extends z.ZodTypeAny> = {
  name: string;
  zResponse: R;
};

export const createInterface = ({
  onFetch,
  onFetchError,
  onResponse,
  onFailureStatus,
  onResponseValidationError,
  onSuccess,
  onError,
}: {
  onFetch: ({
    name,
    url,
    init,
  }: {
    name: string;
    url: string;
    init: I;
  }) => void;
  onFetchError: ({
    name,
    url,
    status,
    error,
  }: {
    name: string;
    url: string;
    status: number;
    error: unknown;
  }) => void;
  onResponse: ({
    name,
    url,
    json,
  }: {
    name: string;
    url: string;
    json: unknown;
  }) => void;
  onFailureStatus: ({
    name,
    url,
    error,
    status,
  }: {
    name: string;
    url: string;
    error: unknown;
    status: number;
  }) => void;
  onResponseValidationError: ({
    name,
    url,
    error,
  }: {
    name: string;
    url: string;
    error: unknown;
  }) => void;
  onSuccess: ({
    name,
    url,
    json,
  }: {
    name: string;
    url: string;
    json: unknown;
  }) => void;
  onError: ({
    name,
    url,
    error,
  }: {
    name: string;
    url: string;
    error: unknown;
  }) => void;
}) => {
  return <R extends z.ZodTypeAny>({ name, zResponse }: C<R>) =>
    // TODO -- the type for init includes undefined, but it shouldn't
    async (url: U, init: I): Promise<z.infer<R>> => {
      try {
        onFetch({ name, url: url.toString(), init });
      } catch (error) {
        onError({ name, url: url.toString(), error });
        throw new Error("fetch.ts :: createInterface :: onError did not throw");
      }

      const response = await (async () => {
        try {
          return await fetch(url, {
            ...init,
            body: JSON.stringify(init?.body),
          });
        } catch (error) {
          // TODO - Hack, 600 := network error
          onFetchError({ name, url: url.toString(), status: 600, error });
          throw new Error(
            "fetch.ts :: createInterface :: onFetchError did not throw"
          );
        }
      })();

      if (!response.ok) {
        onFailureStatus({
          name,
          url: url.toString(),
          status: response.status,
          error: new Error("HTTP status code was not in the 200s"),
        });
        throw new Error("fetch.ts :: createInterface :: onError did not throw");
      }

      const json = await (async () => {
        try {
          return await response.json();
        } catch (error) {
          onResponseValidationError({
            name,
            url: url.toString(),
            error: "RESPONSE WAS NOT JSON",
          });
          throw new Error(
            "fetch.ts :: createInterface :: onError did not throw"
          );
        }
      })();

      try {
        onResponse({ name, url: url.toString(), json });
      } catch (error) {
        onError({ name, url: url.toString(), error });
        throw new Error("fetch.ts :: createInterface :: onError did not throw");
      }

      const validated = await (async () => {
        try {
          return zResponse.parse(json);
        } catch (error) {
          onResponseValidationError({ name, url: url.toString(), error });
          throw new Error(
            "fetch.ts :: createInterface :: onResponseError did not throw"
          );
        }
      })();

      try {
        onSuccess({ name, url: url.toString(), json: validated });
      } catch (error) {
        onError({ name, url: url.toString(), error });
        throw new Error("fetch.ts :: createInterface :: onError did not throw");
      }

      return validated;
    };
};
