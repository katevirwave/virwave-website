'use client'
import { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { requestOTP, verifyOTP, signInWithGoogle } from '@/app/actions/login'
import styles from './login.module.css'

type Step = 'email' | 'code' | 'done'

function LoginContent() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      await requestOTP(email)
      setStep('code')
    })
  }

  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await verifyOTP(email, code)
      if (!result.success) {
        setError("That code isn't right — try again or request a new one.")
        return
      }
      // Session set; route via /callback for profile-linking + status-routing
      router.push('/callback')
    })
  }

  const loginError = searchParams.get('error')

  return (
    <div className={styles.page}>
      <div className={`glass-card ${styles.card}`}>
        <h1 className={styles.heading}>Welcome back</h1>

        {loginError === 'access_revoked' && (
          <p className={styles.errorBanner} role="alert">
            That account isn't active. Reach out to us if you think this is a mistake.
          </p>
        )}

        {step === 'email' && (
          <>
            {/* Google OAuth — primary CTA */}
            <form action={signInWithGoogle}>
              <button type="submit" className={styles.googleBtn}>
                <GoogleIcon /> Continue with Google
              </button>
            </form>

            <div className={styles.divider}><span>or</span></div>

            {/* Email OTP — secondary */}
            <p className={styles.subheading}>{"We'll send a 6-digit code to your inbox."}</p>
            <form onSubmit={handleRequestOTP} className={styles.form}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" required
                className={styles.input} aria-label="Email address" autoComplete="email"
              />
              <button type="submit" disabled={pending} className={styles.submit}>
                {pending ? 'Sending…' : 'Send code'}
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <p className={styles.subheading}>
              Enter the 6-digit code from your inbox for <strong>{email}</strong>.
            </p>
            <form onSubmit={handleVerifyCode} className={styles.form}>
              <input
                id="otp-input"
                type="text" inputMode="numeric" pattern="[0-9]{6}"
                maxLength={6} value={code} onChange={e => setCode(e.target.value)}
                placeholder="123456" required
                className={styles.input}
                aria-label="6-digit login code"
                aria-describedby={error ? 'otp-error' : 'otp-hint'}
                aria-invalid={!!error}
                autoComplete="one-time-code"
              />
              <span id="otp-hint" className={styles.hint}>Check your inbox and spam folder.</span>
              {error && <p id="otp-error" className={styles.errorMsg} role="alert">{error}</p>}
              <button type="submit" disabled={pending || code.length !== 6} className={styles.submit}>
                {pending ? 'Verifying…' : 'Verify code'}
              </button>
              <button type="button" disabled={pending} onClick={() => {
                setError(''); setCode('')
                startTransition(async () => { await requestOTP(email) })
              }} className={styles.resendLink}>
                Resend code
              </button>
              <button type="button" onClick={() => { setStep('email'); setCode(''); setError('') }}
                className={styles.backLink}>
                Use a different email
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
      <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
      <path d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" fill="#FBBC05"/>
      <path d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" fill="#EA4335"/>
    </svg>
  )
}
