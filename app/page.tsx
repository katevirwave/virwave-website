export default function Home() {
  return (
    <main className="shell">
      <p className="eyebrow">VirWave Events</p>
      <h1>The room knows before you walk in.</h1>
      <p className="muted">
        Scan a QR code at your event to join. If you&apos;re a host, sign in to open your dashboard.
      </p>
      <a href="/host" className="btn btn-ghost">Host sign-in</a>
    </main>
  );
}
