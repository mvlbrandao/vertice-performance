export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-paper border border-line rounded-md px-3.5 py-3 min-w-0">
      <span className="text-[11px] text-ink-faint uppercase tracking-wide block mb-0.5">
        {label}
      </span>
      <b className="text-xl font-display break-words">{value}</b>
      {hint && <span className="block text-[11px] text-ink-faint mt-0.5">{hint}</span>}
    </div>
  );
}
