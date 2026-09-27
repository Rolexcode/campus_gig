import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground"
      id="main-content"
      tabIndex={-1}
    >
      <section className="card w-full max-w-xl p-8 text-center sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[.1em] text-primary">
          Error 404
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted">
          The address may be outdated or the page may have moved.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link className="btn btn-primary" href="/gigs">
            Browse gigs
          </Link>
          <Link className="btn btn-secondary" href="/help">
            Help centre
          </Link>
        </div>
      </section>
    </main>
  );
}
