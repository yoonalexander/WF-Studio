import { useState } from "react";

export type Appearance = "light" | "dark";
const key = "wf-equation-theme";
export function useAppearance() {
  const [appearance, update] = useState<Appearance>(() => {
    try {
      return localStorage.getItem(key) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const setAppearance = (value: Appearance) => {
    update(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Storage is optional. */
    }
  };
  return [appearance, setAppearance] as const;
}
