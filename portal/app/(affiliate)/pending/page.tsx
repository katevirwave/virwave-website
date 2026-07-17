export default function PendingPage() {
  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: 'var(--sp-8)', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-white-90)', marginBottom: 'var(--sp-4)' }}>
        Application under review
      </h1>
      <p style={{ color: 'var(--color-white-60)', lineHeight: 1.6 }}>
        {"Your application is under review. We'll be in touch within a few days."}
      </p>
    </div>
  )
}
