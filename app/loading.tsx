export default function Loading() {
  return (
    <main
      className="min-h-screen bg-background text-foreground"
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
    >
      <div className="border-b border-border bg-surface">
        <div className="page-shell flex min-h-20 items-center justify-between gap-6">
          <div className="h-10 w-44 animate-pulse rounded-lg bg-muted-surface" />
          <div className="hidden gap-3 sm:flex">
            <div className="h-10 w-24 animate-pulse rounded-lg bg-muted-surface" />
            <div className="h-10 w-24 animate-pulse rounded-lg bg-muted-surface" />
            <div className="h-10 w-24 animate-pulse rounded-lg bg-muted-surface" />
          </div>
        </div>
      </div>
      <section className="page-shell py-12 sm:py-16" role="status">
        <span className="sr-only">Loading CampusGig…</span>
        <div className="h-4 w-28 animate-pulse rounded bg-muted-surface" />
        <div className="mt-5 h-12 max-w-xl animate-pulse rounded-xl bg-muted-surface" />
        <div className="mt-4 h-6 max-w-2xl animate-pulse rounded bg-muted-surface" />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div className="card p-6" key={item}>
              <div className="h-5 w-24 animate-pulse rounded bg-muted-surface" />
              <div className="mt-5 h-7 animate-pulse rounded bg-muted-surface" />
              <div className="mt-3 h-4 animate-pulse rounded bg-muted-surface" />
              <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-muted-surface" />
              <div className="mt-8 h-10 animate-pulse rounded-lg bg-muted-surface" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
