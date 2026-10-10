import { PublicShell } from "../components/public/PublicShell";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};
export default function NotFound() {
  return (
    <PublicShell>
      <main id="main-content" className="missing-page container">
        <span className="eyebrow">PAGE NOT FOUND · 404</span>
        <h1>A path that doesn’t lead to a field.</h1>
        <p>The page may have moved, or this address may be incomplete.</p>
        <a className="button primary" href="/">
          Back to Krishyak
        </a>
        <a className="text-link" href="/app/today">
          Open my farm →
        </a>
      </main>
    </PublicShell>
  );
}
