import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CopyReferralLink } from '@/components/CopyReferralLink'
import styles from './stats.module.css'

const METHOD_LABELS: Record<string, string> = {
  fingerprint:       'Recognized automatically',
  play_referrer:     'Google Play install',
  universal_link:    'Direct link tap',
  clipboard_paste:   'Copied code',
  onboarding_manual: 'Entered code manually',
  settings_manual:   'Entered code manually',
}

export default async function StatsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [profileRes, attributionsRes, earningsRes] = await Promise.all([
    supabase.from('affiliate_profiles').select('code').eq('user_id', user.id).single(),
    supabase.from('affiliate_attributions').select('attribution_method').eq('converted', true),
    supabase.from('affiliate_commission_events')
      .select('event_month, commission_amount_usd')
      .order('event_month', { ascending: true }),
  ])

  const profile = profileRes.data
  if (!profile) redirect('/')

  const attributions = attributionsRes.data ?? []
  const earnings = earningsRes.data ?? []

  // Aggregate attribution methods (collapse manual variants)
  const methodCounts: Record<string, number> = {}
  for (const a of attributions) {
    const label = METHOD_LABELS[a.attribution_method] ?? a.attribution_method
    methodCounts[label] = (methodCounts[label] ?? 0) + 1
  }
  const methodEntries = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])
  const maxCount = methodEntries[0]?.[1] ?? 1

  // Aggregate monthly earnings
  const monthlyMap: Record<string, number> = {}
  for (const e of earnings) {
    monthlyMap[e.event_month] = (monthlyMap[e.event_month] ?? 0) + (e.commission_amount_usd ?? 0)
  }
  const monthlyEntries = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]))
  const maxEarning = Math.max(...monthlyEntries.map(e => e[1]), 1)

  const hasData = attributions.length > 0

  return (
    <div className={`${styles.page} page-enter`}>
      <h1 className={styles.title}>Stats</h1>

      {!hasData ? (
        <div className={`glass-card ${styles.emptyState}`}>
          <p>No data yet — share your referral link to get started.</p>
          <div className={styles.emptyLink}><CopyReferralLink code={profile.code} /></div>
        </div>
      ) : (
        <>
          {/* Attribution funnel */}
          <figure className={`glass-card ${styles.chartCard}`}>
            <figcaption className={styles.chartTitle}>How affiliates found your code</figcaption>
            <div className={styles.funnelChart} role="img" aria-label="Attribution method breakdown">
              {methodEntries.map(([label, count]) => (
                <div key={label} className={styles.funnelRow}>
                  <span className={styles.funnelLabel}>{label}</span>
                  <div className={styles.funnelBarTrack}>
                    <div
                      className={styles.funnelBarFill}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className={styles.funnelCount}>{count}</span>
                </div>
              ))}
            </div>
            {/* Accessible table for screen readers */}
            <table className="sr-only">
              <caption>Attribution method breakdown</caption>
              <thead><tr><th>Method</th><th>Count</th></tr></thead>
              <tbody>
                {methodEntries.map(([label, count]) => (
                  <tr key={label}><td>{label}</td><td>{count}</td></tr>
                ))}
              </tbody>
            </table>
          </figure>

          {/* Monthly earnings trend */}
          {monthlyEntries.length > 0 && (
            <figure className={`glass-card ${styles.chartCard}`}>
              <figcaption className={styles.chartTitle}>
                Monthly net earnings,{' '}
                {new Date(monthlyEntries[0][0] + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}–
                {new Date(monthlyEntries.at(-1)![0] + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </figcaption>
              <div className={styles.trendChart} role="img" aria-label="Monthly net earnings trend">
                {monthlyEntries.map(([month, amount]) => (
                  <div key={month} className={styles.trendBar}>
                    <div
                      className={styles.trendBarFill}
                      style={{ height: `${(amount / maxEarning) * 100}%` }}
                      title={`${month}: $${amount.toFixed(2)}`}
                    />
                    <span className={styles.trendMonth}>
                      {new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
              <table className="sr-only">
                <caption>Monthly net earnings</caption>
                <thead><tr><th>Month</th><th>Amount (USD)</th></tr></thead>
                <tbody>
                  {monthlyEntries.map(([month, amount]) => (
                    <tr key={month}><td>{month}</td><td>${amount.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </figure>
          )}
        </>
      )}
    </div>
  )
}
