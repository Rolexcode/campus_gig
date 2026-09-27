"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main
      className="grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground"
      id="main-content"
      tabIndex={-1}
    >
      <section
        className="card w-full max-w-xl p-8 text-center sm:p-10"
        role="alert"
        aria-labelledby="error-title"
      >
        <AlertTriangle className="mx-auto size-9 text-amber-700" aria-hidden="true" />
        <p className="mt-5 text-sm font-bold uppercase tracking-[.1em] text-primary">
          CampusGig needs a moment
        </p>
        <h1
          className="mt-2 text-3xl font-bold tracking-[-0.04em]"
          id="error-title"
        >
          This page could not be loaded
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted">
          Your account and payment state have not been changed. Try loading the
          page again, or return home if the problem continues.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button className="btn btn-primary" type="button" onClick={reset}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </button>
          <Link className="btn btn-secondary" href="/">
            Return home
          </Link>
          <Link className="btn btn-ghost" href="/help">
            Get help
          </Link>
        </div>
      </section>
    </main>
  );
}
