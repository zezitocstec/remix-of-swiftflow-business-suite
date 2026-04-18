import { useMemo, useRef, useState, useEffect } from "react";
import { User, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface OperatorOption {
  id: string;
  nome: string;
}

interface OperatorAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  operators: OperatorOption[];
  onSelect?: (op: OperatorOption) => void;
  onEnterAdvance?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputId?: string;
}

/**
 * Input com autocomplete: ao digitar a primeira letra do nome,
 * exibe todos os operadores que começam com aquela letra (case-insensitive).
 * Suporta navegação por teclado (↑/↓/Enter/Esc) e clique.
 */
export default function OperatorAutocomplete({
  value,
  onChange,
  operators,
  onSelect,
  onEnterAdvance,
  placeholder = "Nome do operador",
  autoFocus,
  inputId,
}: OperatorAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [] as OperatorOption[];
    return operators
      .filter((o) => o.nome.toLowerCase().startsWith(q))
      .slice(0, 8);
  }, [value, operators]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions.length]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const choose = (op: OperatorOption) => {
    onChange(op.nome);
    onSelect?.(op);
    setOpen(false);
    // Focus PIN field next if a callback was given
    onEnterAdvance?.();
  };

  const showList = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        id={inputId}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (showList) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
              return;
            }
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              choose(suggestions[highlight]);
              return;
            }
          } else if (e.key === "Enter") {
            e.preventDefault();
            onEnterAdvance?.();
          }
        }}
        className="h-14 pl-10 pr-10 text-base"
      />
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

      {showList && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg py-1"
        >
          {suggestions.map((op, idx) => (
            <li
              key={op.id}
              role="option"
              aria-selected={idx === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(op);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer flex items-center gap-2 text-popover-foreground",
                idx === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{op.nome}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
