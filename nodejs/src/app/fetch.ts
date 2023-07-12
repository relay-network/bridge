import { z } from "zod";
import fetch from "node-fetch";

type U = Parameters<typeof fetch>[0];
type I = Parameters<typeof fetch>[1];
type C<R extends z.ZodTypeAny> = {
  name: string;
  zResponse: R;
};

type Fetcher<R extends z.ZodTypeAny = z.ZodTypeAny> = (
  url: U,
  init: I,
  { name, zResponse }: C<R>
) => Promise<z.infer<typeof zResponse>>;

export const createInterface = ({
  onFetch,
  onFetchError,
  onResponse,
  onResponseError,
  onSuccess,
  onError,
}: {
  onFetch: ({ url }: { url: string }) => void;
  onFetchError: ({ url, error }: { url: string; error: unknown }) => void;
  onResponse: ({ url, response }: { url: string; response: unknown }) => void;
  onResponseError: ({ url, error }: { url: string; error: unknown }) => void;
  onSuccess: ({ url, response }: { url: string; response: unknown }) => void;
  onError: ({ url, error }: { url: string; error: unknown }) => void;
}): Fetcher => {
  return async (url, init, channel) => {
    try {
      onFetch({ url: url.toString() });
    } catch (error) {
      onError({ url: url.toString(), error });
      throw new Error("fetch.ts :: createInterface :: onError did not throw");
    }

    const response = await (async () => {
      try {
        return await fetch(url, init);
      } catch (error) {
        onFetchError({ url: url.toString(), error });
        throw new Error(
          "fetch.ts :: createInterface :: onFetchError did not throw"
        );
      }
    })();

    try {
      onResponse({ url: url.toString(), response });
    } catch (error) {
      onError({ url: url.toString(), error });
      throw new Error("fetch.ts :: createInterface :: onError did not throw");
    }

    const validated = (() => {
      try {
        return channel.zResponse.parse(response);
      } catch (error) {
        onResponseError({ url: url.toString(), error });
        throw new Error(
          "fetch.ts :: createInterface :: onResponseError did not throw"
        );
      }
    })();

    try {
      onSuccess({ url: url.toString(), response: validated });
    } catch (error) {
      onError({ url: url.toString(), error });
      throw new Error("fetch.ts :: createInterface :: onError did not throw");
    }

    return validated;
  };
};
