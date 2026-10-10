export const metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};
export default function OfflinePage() {
  return (
    <main className="workspace-loading">
      <h1>You’re offline.</h1>
      <p>
        Reconnect to open this page. Opted-in farm records may be available in
        your saved workspace.
      </p>
      <a className="button primary" href="/app/today">
        Open saved workspace
      </a>
      <a href="/">Return to website</a>
    </main>
  );
}
