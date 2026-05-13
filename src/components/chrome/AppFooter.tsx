export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border-default bg-surface-muted">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-fg-subtle md:flex-row md:items-center">
        <span className="font-display tracking-[0.2em] uppercase">
          tkxel · AI Unlimited
        </span>
        <span>© {year} Tkxel. Internal tool.</span>
      </div>
    </footer>
  );
}
