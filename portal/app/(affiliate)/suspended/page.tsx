export default function SuspendedPage() {
  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: 'var(--sp-8)', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-white-90)', marginBottom: 'var(--sp-4)' }}>
        Account paused
      </h1>
      <p style={{ color: 'var(--color-white-60)', lineHeight: 1.6 }}>
        Your affiliate account is currently paused. If you think this is a mistake,{' '}
        <a href="mailto:affiliates@virwave.com" style={{ color: 'var(--color-teal-400)' }}>reach out to us</a>.
      </p>
    </div>
  )
}
