import { z } from "zod";

type C<E extends z.ZodTypeAny> = {
  name: string;
  zEnv: E;
};

export const createInterface = <E extends z.ZodTypeAny>({
  zEnv,
  onCreate,
  onCreateError,
  onRead,
  onReadError,
  onError,
}: {
  zEnv: E;
  onCreate: () => void;
  onCreateError: ({ error }: { error: unknown }) => void;
  onRead: ({ name }: { name: string }) => void;
  onReadError: ({ name, error }: { name: string; error: unknown }) => void;
  onError: ({ name, error }: { name?: string; error: unknown }) => void;
}) => {
  try {
    onCreate();
  } catch (error) {
    onError({ error });
    throw new Error("env.ts :: createInterface :: onError did not throw");
  }

  const store = (() => {
    try {
      return zEnv.parse(process.env);
    } catch (error) {
      onCreateError({ error });
      throw new Error(
        "env.ts :: createInterface :: onCreateError did not throw"
      );
    }
  })();

  return <V extends z.ZodTypeAny>({
    name,
    zEnv,
  }: C<V>): z.infer<typeof zEnv> => {
    try {
      onRead({ name });
      return zEnv.parse(store);
    } catch (error) {
      onReadError({ name, error });
    }
  };
};
