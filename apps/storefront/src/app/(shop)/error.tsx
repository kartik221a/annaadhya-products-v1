"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-5xl" aria-hidden>⚠️</p>
      <h1 className="font-display mt-5 text-3xl font-semibold text-forest">Something went wrong</h1>
      <p className="mt-3 text-sm text-ink-soft">
        An unexpected error occurred while preparing this page. It has been logged — please try again.
      </p>
      <button className="btn-primary mt-8 px-6 py-2.5 text-sm" onClick={reset}>Try again</button>
      {error.digest && <p className="mt-4 font-mono text-[0.7rem] text-ink-soft">ref: {error.digest}</p>}
    </div>
  );
}
