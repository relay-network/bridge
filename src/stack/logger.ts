import * as sEffect from "./boot/2-effect.js";

export const create = () => {
  return sEffect.create({
    api: "logger",
    feature: "logger",
    request: "log",
  });
};
