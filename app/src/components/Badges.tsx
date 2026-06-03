export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "maroon" | "amber" | "blue" | "green";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-600 ring-gray-200",
    maroon: "bg-maroon-50 text-maroon-700 ring-maroon-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
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

export function Flag({ label }: { label: string }) {
  return (
    <span
      title={label}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700"
    >
      !
    </span>
  );
}
