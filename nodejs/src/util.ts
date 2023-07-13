/* eslint-disable no-console */
import { z } from "zod";

export const zJsonString = z.string().transform((val, ctx) => {
  try {
    return JSON.parse(val);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid JSON string",
    });

    return z.NEVER;
  }
});

export const getRandom = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
