import { createAdminClient } from '@/utils/supabase/admin'
import styles from './dashboard.module.css'

export const revalidate = 0  // always fresh — admin must see current state

export default async function AdminDashboardPage() {
  const adminClient = createAdminClient()

  const [activeRes, pendingRes, thisMonthRes, paidYTDRes, topAffiliatesRes] = await Promise.all([
    adminClient.from('affiliate_stats_mv').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    adminClient.from('affiliate_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    adminClient.from('affiliate_commission_events').select('commission_amount_usd').eq('event_month', new Date().toISOString().slice(0, 7)),
    adminClient.from('affiliate_payouts').select('total_commission_usd').eq('status', 'paid').gte('created_at', `${new Date().getFullYear()}-01-01`),
    adminClient.from('affiliate_stats_mv').select('code, full_name, this_month_net_usd').order('this_month_net_usd', { ascending: false }).limit(5),
  ])

  const thisMonthTotal = (thisMonthRes.data ?? []).reduce((s, e) => s + (e.commission_amount_usd ?? 0), 0)
  const paidYTD = (paidYTDRes.data ?? []).reduce((s, p) => s + (p.total_commission_usd ?? 0), 0)

  return (
    <div className={`${styles.page} page-enter`}>
      <h1 className={styles.title}>Program Overview</h1>
      <div className={styles.statGrid}>
        <StatCard label="Active affiliates"        value={String(activeRes.count ?? 0)} />
        <StatCard label="Pending applications"     value={String(pendingRes.count ?? 0)} accent={!!pendingRes.count} />
        <StatCard label="Commissions this month"   value={`$${thisMonthTotal.toFixed(2)}`} />
        <StatCard label="Total paid YTD"           value={`$${paidYTD.toFixed(2)}`} muted />
      </div>
      <section>
        <h2 className={styles.sectionTitle}>Top affiliates this month</h2>
        <table className={styles.table}>
          <thead><tr><th>Code</th><th>Name</th><th>This month</th></tr></thead>
          <tbody>
            {(topAffiliatesRes.data ?? []).map(a => (
              <tr key={a.code}>
                <td><a href={`/admin/affiliates/${a.code}`} className={styles.link}>{a.code}</a></td>
                <td>{a.full_name}</td>
                <td>${(a.this_month_net_usd ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function StatCard({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className={`glass-card ${styles.card}`}>
      <div className={styles.cardValue} style={{
        color: accent ? 'var(--color-amber-400)' : muted ? 'var(--color-white-70)' : 'var(--color-white-90)'
      }}>{value}</div>
      <div className={styles.cardLabel}>{label}</div>
    </div>
  )
}
