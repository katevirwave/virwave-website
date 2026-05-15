'use client'
import { useState, useTransition } from 'react'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import styles from './profile.module.css'

const FIELDS: Record<string, string[]> = {
  paypal: ['PayPal email'],
  wise: ['Wise email or account number', 'Currency'],
  bank: ['Bank name', 'Account holder name', 'Account number / IBAN', 'Routing number / SWIFT'],
}

export function PayoutForm({ currentMethod, currentDetails }: {
  currentMethod: string
  currentDetails: Record<string, string>
}) {
  const [method, setMethod] = useState(currentMethod)
  const [details, setDetails] = useState<Record<string, string>>(currentDetails)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/affiliate-portal-update-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ payout_method: method, payout_details: details }),
      })

      setStatus(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setStatus('idle'), 3000)
    })
  }

  const fields = FIELDS[method] ?? []

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label className={styles.fieldLabel}>
        Payout method
        <select
          value={method}
          onChange={e => { setMethod(e.target.value); setDetails({}) }}
          className={styles.select}
        >
          <option value="">Select a method</option>
          <option value="paypal">PayPal</option>
          <option value="wise">Wise</option>
          <option value="bank">Bank transfer</option>
        </select>
      </label>

      {fields.map(field => (
        <label key={field} className={styles.fieldLabel}>
          {field}
          <input
            type="text"
            value={details[field] ?? ''}
            onChange={e => setDetails(d => ({ ...d, [field]: e.target.value }))}
            className={styles.input}
            required
          />
        </label>
      ))}

      {method && (
        <button type="submit" disabled={pending} className={styles.submitBtn}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : 'Save payout details'}
        </button>
      )}
      {status === 'error' && (
        <p className={styles.errorMsg}>Failed to save. Please try again or contact us.</p>
      )}
    </form>
  )
}
