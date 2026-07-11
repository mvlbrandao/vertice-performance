export function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-ink-faint text-sm gap-2.5">
      <span className="inline-block w-4 h-4 border-2 border-line border-t-pitch-dark rounded-full animate-spin" />
      Carregando…
    </div>
  );
}
