import { createContext, useContext, ReactNode } from "react";
import { useScaleReader } from "@/hooks/useScaleReader";

type ScaleContextValue = ReturnType<typeof useScaleReader>;

const ScaleContext = createContext<ScaleContextValue | null>(null);

export function ScaleProvider({ children }: { children: ReactNode }) {
  const scale = useScaleReader();
  return <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>;
}

export function useScale(): ScaleContextValue {
  const ctx = useContext(ScaleContext);
  if (!ctx) throw new Error("useScale must be used within a ScaleProvider");
  return ctx;
}
