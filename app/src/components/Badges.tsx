export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "maroon" | "gold" | "blue" | "green";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface2 text-muted ring-line",
    maroon: "bg-maroon/25 text-maroon-light ring-maroon/40",
    gold: "bg-gold/15 text-gold ring-gold/30",
    blue: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    green: "bg-good/15 text-good ring-good/30",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// small round icon button used for inline warnings on cards
export function IconDot({
  symbol,
  tone,
  title,
  onClick,
}: {
  symbol: string;
  tone: "warn" | "danger";
  title: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const tones = {
    warn: "bg-warn/20 text-warn ring-warn/40",
    danger: "bg-danger/20 text-danger ring-danger/40",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-inset ${tones[tone]}`}
    >
      {symbol}
    </button>
  );
}
