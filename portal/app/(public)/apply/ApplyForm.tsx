'use client'
import { useState } from 'react'
import styles from './apply.module.css'

const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'Substack', 'Podcast', 'Newsletter', 'Blog', 'Other']
const AUDIENCE_SIZES = [
  { label: 'Under 1K', value: 'under-1k' },
  { label: '1K–10K',   value: '1k-10k' },
  { label: '10K–50K',  value: '10k-50k' },
  { label: '50K–100K', value: '50k-100k' },
  { label: '100K+',    value: '100k+' },
]
const STORY_MAX = 280

export function ApplyForm() {
  const [form, setForm] = useState({ name: '', email: '', platform: '', audience_size: '', story: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const storyLen = form.story.length
  const storyNearLimit = storyLen >= 240

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/affiliate-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, platform: form.platform.toLowerCase() }),
    })

    setSubmitting(false)
    if (res.ok) {
      setSubmitted(true)
    } else if (res.status === 429) {
      setError('Too many applications from this network. Please try again tomorrow.')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
  }

  if (submitted) {
    return (
      <p className={styles.confirmation}>
        Application received. Check your inbox — we'll be in touch within a few days.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label className={styles.fieldLabel}>
        Name
        <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={styles.input} autoComplete="name" />
      </label>

      <label className={styles.fieldLabel}>
        Email
        <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={styles.input} autoComplete="email" />
      </label>

      <label className={styles.fieldLabel}>
        Platform
        <select required value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className={styles.select}>
          <option value="">Select your platform</option>
          {PLATFORMS.map(p => <option key={p} value={p.toLowerCase()}>{p}</option>)}
        </select>
      </label>

      <label className={styles.fieldLabel}>
        Audience size
        <select required value={form.audience_size} onChange={e => setForm(f => ({ ...f, audience_size: e.target.value }))} className={styles.select}>
          <option value="">Select size</option>
          {AUDIENCE_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>

      <label className={styles.fieldLabel}>
        How does VirWave fit into what you share?
        <textarea
          value={form.story}
          onChange={e => setForm(f => ({ ...f, story: e.target.value.slice(0, STORY_MAX) }))}
          className={styles.textarea}
          rows={4}
          aria-describedby="story-counter"
        />
        <span
          id="story-counter"
          className={styles.charCounter}
          style={{ color: storyNearLimit ? 'var(--color-amber-400)' : 'var(--color-white-40)' }}
        >
          {storyLen} / {STORY_MAX}
        </span>
      </label>

      {error && <p className={styles.errorMsg} role="alert">{error}</p>}

      <button type="submit" disabled={submitting} className={styles.submitBtn}>
        {submitting ? 'Submitting…' : 'Apply to the program'}
      </button>
    </form>
  )
}
