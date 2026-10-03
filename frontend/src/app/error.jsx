"use client";
export default function ErrorPage({ reset }) {
  return (
    <main className="missing-page container">
      <h1>This page couldn’t be loaded.</h1>
      <p>Please try again. Your saved field updates are kept on this device.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <a className="text-link" href="/">
        Back to Krishyak
      </a>
    </main>
  );
}
