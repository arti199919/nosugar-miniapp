import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, type Health } from "./api";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "ok" | "error";
}

interface UIState {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  health: Health | null;
  checkHealth: () => Promise<void>;
  toasts: Toast[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismiss: (id: number) => void;
  /** Что сейчас надето на аватаре в примерочной */
  fitting: string[];
  setFitting: (ids: string[]) => void;
}

let toastSeq = 1;

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme;
        set({ theme });
      },
      health: null,
      checkHealth: async () => {
        try {
          set({ health: await api.health() });
        } catch {
          set({ health: { ok: false, ai: false, model: "" } });
        }
      },
      toasts: [],
      toast: (text, kind = "info") => {
        const id = toastSeq++;
        set({ toasts: [...get().toasts, { id, text, kind }] });
        setTimeout(() => get().dismiss(id), kind === "error" ? 6000 : 3500);
      },
      dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      fitting: [],
      setFitting: (fitting) => set({ fitting }),
    }),
    { name: "atelier-ui", partialize: (s) => ({ theme: s.theme, fitting: s.fitting }) },
  ),
);

export const toast = (text: string, kind?: Toast["kind"]) => useUI.getState().toast(text, kind);
export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
