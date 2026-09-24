import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { useUI } from "../store";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          "card rise relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-3xl",
          wide ? "sm:max-w-4xl" : "sm:max-w-xl",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="text-lg font-bold">{title}</div>
          <button className="btn-icon h-9 w-9" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3 safe-bottom">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={clsx("animate-spin", className)} />;
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-2 text-accent">{icon}</div>}
      <div className="text-lg font-bold">{title}</div>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-4xl leading-none font-semibold tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={clsx("inline-flex rounded-2xl border border-line bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-xl px-3 py-1.5 text-xs font-bold transition",
            value === o.value ? "bg-surface text-fg shadow" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Dots({ value, max = 5, onChange, color = "var(--accent)" }: { value: number; max?: number; onChange?: (v: number) => void; color?: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          type="button"
          key={i}
          disabled={!onChange}
          onClick={() => onChange?.(i + 1)}
          className="h-2.5 w-6 rounded-full transition disabled:cursor-default"
          style={{ background: i < value ? color : "var(--surface-3)" }}
          aria-label={`${i + 1}`}
        />
      ))}
    </div>
  );
}

export function ColorDot({ hex, size = 14, ring }: { hex: string; size?: number; ring?: boolean }) {
  return (
    <span
      className={clsx("inline-block shrink-0 rounded-full border border-black/10", ring && "ring-2 ring-accent ring-offset-2 ring-offset-surface")}
      style={{ background: hex, width: size, height: size }}
    />
  );
}

export function Toasts() {
  const { toasts, dismiss } = useUI();
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={clsx(
            "glass rise pointer-events-auto max-w-md rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg",
            t.kind === "error" && "text-bad",
            t.kind === "ok" && "text-ok",
          )}
        >
          {t.text}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** Русское склонение: plural(5, ["вещь", "вещи", "вещей"]) */
export function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  const f = a > 10 && a < 20 ? forms[2] : b > 1 && b < 5 ? forms[1] : b === 1 ? forms[0] : forms[2];
  return `${n} ${f}`;
}

export function AiBadge({ source }: { source: "ai" | "local" }) {
  return (
    <span className={clsx("chip py-1", source === "ai" ? "chip-on" : "")}>{source === "ai" ? "✦ Claude" : "⚙ локальный алгоритм"}</span>
  );
}

/** Мини-рендер markdown: жирный, списки, заголовки, ссылки. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: ReactNode[] } | null = null;
  const flush = () => {
    if (list) {
      out.push(list.ordered ? <ol key={out.length}>{list.items}</ol> : <ul key={out.length}>{list.items}</ul>);
      list = null;
    }
  };
  const inline = (s: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`|_[^_]+_)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      const t = m[0];
      if (t.startsWith("**")) parts.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
      else if (t.startsWith("[")) {
        const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!;
        parts.push(
          <a key={m.index} href={mm[2]} target="_blank" rel="noreferrer">
            {mm[1]}
          </a>,
        );
      } else if (t.startsWith("`")) parts.push(<code key={m.index}>{t.slice(1, -1)}</code>);
      else parts.push(<em key={m.index}>{t.slice(1, -1)}</em>);
      last = m.index + t.length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  };
  lines.forEach((ln, i) => {
    const ul = /^\s*[-*•]\s+(.*)$/.exec(ln);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(ln);
    const h = /^#{1,4}\s+(.*)$/.exec(ln);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push(<li key={i}>{inline((ul ?? ol)![1])}</li>);
      return;
    }
    flush();
    if (h) out.push(<h4 key={i}>{inline(h[1])}</h4>);
    else if (ln.trim()) out.push(<p key={i}>{inline(ln)}</p>);
  });
  flush();
  return <div className="prose-chat text-sm leading-relaxed">{out}</div>;
}
