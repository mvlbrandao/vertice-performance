export function EmptyState({
  icon = "📭",
  message,
}: {
  icon?: string;
  message: string;
}) {
  return (
    <div className="text-center py-12 px-5 text-ink-faint">
      <div className="text-3xl mb-2.5">{icon}</div>
      {message}
    </div>
  );
}
