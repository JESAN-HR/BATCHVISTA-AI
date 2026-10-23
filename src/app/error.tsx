"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Something interrupted this workspace.</h1>
      <p>Your saved inspections remain in the local database.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <Link className="button" href="/">
        Back to start
      </Link>
    </main>
  );
}
