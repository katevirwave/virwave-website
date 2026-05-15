import { createAdminClient } from '@/utils/supabase/admin'
import styles from './fraud.module.css'

export const revalidate = 300

export default async function FraudPage() {
  const adminClient = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Signal 1: Refund rate >15% in 30 days
  const { data: highRefund } = await adminClient.rpc('get_affiliate_refund_rates', { since: thirtyDaysAgo })

  // Signal 2: Click volume spike (>3× 30-day daily avg in past 24h)
  const { data: spikeAffiliates } = await adminClient.rpc('get_click_volume_spikes', {
    window_start: oneDayAgo, comparison_start: thirtyDaysAgo
  })

  const hasSignals = (highRefund?.length ?? 0) + (spikeAffiliates?.length ?? 0) > 0

  return (
    <div className={`${styles.page} page-enter`}>
      <h1 className={styles.title}>Fraud signals</h1>
      <p className={styles.subtitle}>Read only. Action from the affiliate profile page.</p>

      {!hasSignals && (
        <div className={`glass-card ${styles.clear}`}>No active signals. All clear.</div>
      )}

      {(highRefund?.length ?? 0) > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>High refund rate (&gt;15%, past 30 days)</h2>
          <SignalTable rows={highRefund!} valueKey="refund_rate" valueFormat={(v: number) => `${(v * 100).toFixed(1)}%`} />
        </section>
      )}

      {(spikeAffiliates?.length ?? 0) > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Click volume spike (&gt;3× 30-day average, past 24h)</h2>
          <SignalTable rows={spikeAffiliates!} valueKey="spike_ratio" valueFormat={(v: number) => `${v.toFixed(1)}×`} />
        </section>
      )}
    </div>
  )
}

function SignalTable({ rows, valueKey, valueFormat }: { rows: Record<string, unknown>[]; valueKey: string; valueFormat: (v: number) => string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--sp-6)' }}>
      <thead><tr>
        <th style={{ textAlign: 'left', color: 'var(--color-white-60)', fontSize: '0.75rem', padding: 'var(--sp-2)', textTransform: 'uppercase' }}>Code</th>
        <th style={{ textAlign: 'left', color: 'var(--color-white-60)', fontSize: '0.75rem', padding: 'var(--sp-2)', textTransform: 'uppercase' }}>Name</th>
        <th style={{ textAlign: 'left', color: 'var(--color-white-60)', fontSize: '0.75rem', padding: 'var(--sp-2)', textTransform: 'uppercase' }}>Signal</th>
        <th></th>
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r.code)}>
            <td style={{ padding: 'var(--sp-2)', color: 'var(--color-amber-400)' }}>{String(r.code)}</td>
            <td style={{ padding: 'var(--sp-2)', color: 'var(--color-white-80)' }}>{String(r.full_name)}</td>
            <td style={{ padding: 'var(--sp-2)', color: 'var(--color-white-80)' }}>{valueFormat(Number(r[valueKey]))}</td>
            <td style={{ padding: 'var(--sp-2)' }}><a href={`/admin/affiliates/${r.code}`} style={{ color: 'var(--color-teal-400)', fontSize: '0.875rem' }}>View profile →</a></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
