import { PrismaClient } from "@prisma/client";

export const createInterface = ({
  onQuery,
  onQueryError,
}: {
  onQuery: (opts: { operation: string; model: string; args: unknown }) => void;
  onQueryError: (opts: {
    operation: string;
    model: string;
    args: unknown;
    error: unknown;
  }) => void;
}) => {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          try {
            onQuery({ operation, model, args });
            return await query(args);
          } catch (error) {
            onQueryError({ operation, model, args, error });
            throw new Error(
              "prisma.ts :: createInterface :: onQueryError did not throw"
            );
          }
        },
      },
    },
  });
};
