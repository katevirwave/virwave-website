'use client'
import { useState } from 'react'
import styles from './CopyReferralLink.module.css'

export function CopyReferralLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const url = `https://virwave.com/ref/${code}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`glass-card glass-card--subtle ${styles.pill}`}>
      <span className={styles.url} aria-label={`Referral link: ${url}`}>{url}</span>
      <button onClick={handleCopy} className={`glass-card glass-card--strong ${styles.copyBtn}`} aria-label="Copy referral link">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
