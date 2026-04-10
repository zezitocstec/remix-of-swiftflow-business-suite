import { useEffect } from "react";

interface ShortcutActions {
  onSearch: () => void;
  onPark: () => void;
  onRecall: () => void;
  onFinalize: () => void;
  onCancel: () => void;
  onDebtors?: () => void;
  onCloseCashRegister?: () => void;
}

export function usePDVShortcuts(actions: ShortcutActions, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";
      switch (e.key) {
        case "F1": e.preventDefault(); actions.onSearch(); break;
        case "F2": e.preventDefault(); actions.onPark(); break;
        case "F3": e.preventDefault(); actions.onRecall(); break;
        case "F4": e.preventDefault(); actions.onDebtors?.(); break;
        case "F5": e.preventDefault(); actions.onCloseCashRegister?.(); break;
        case " ": if (!isInput) { e.preventDefault(); actions.onFinalize(); } break;
        case "Escape": e.preventDefault(); actions.onCancel(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions, enabled]);
}
