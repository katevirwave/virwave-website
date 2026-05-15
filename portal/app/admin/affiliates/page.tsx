import { createAdminClient } from '@/utils/supabase/admin'
import Link from 'next/link'
import styles from './affiliates.module.css'

export const revalidate = 0

const STATUS_COLORS: Record<string, string> = {
  active:     'var(--color-mint-400)',
  pending:    'var(--color-white-60)',
  inactive:   'var(--color-white-60)',
  suspended:  'var(--color-amber-400)',
  terminated: 'var(--color-white-55)', // white-30 fails WCAG AA on gray950 background
}

// Cursor-based pagination on affiliate_stats_mv — never offset
export default async function AdminAffiliatesPage({ searchParams }: { searchParams: { status?: string; cursor?: string } }) {
  const adminClient = createAdminClient()
  let query = adminClient
    .from('affiliate_stats_mv')
    .select('code, full_name, status, tier, this_month_net_usd, lifetime_net_usd, last_commission_at')
    .order('lifetime_net_usd', { ascending: false })
    .order('code', { ascending: true })
    .limit(50)

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.cursor) {
    // Cursor encodes (lifetime_net_usd, code) for stable pagination on this sort order
    const [lifetimeCursor, codeCursor] = decodeURIComponent(searchParams.cursor).split('|')
    query = query.or(`lifetime_net_usd.lt.${lifetimeCursor},and(lifetime_net_usd.eq.${lifetimeCursor},code.gt.${codeCursor})`)
  }

  const { data: affiliates } = await query
  const lastRow = affiliates && affiliates.length === 50 ? affiliates[affiliates.length - 1] : null

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.header}>
        <h1 className={styles.title}>Affiliates</h1>
        <div className={styles.filters}>
          {['all', 'active', 'pending', 'inactive', 'suspended', 'terminated'].map(s => (
            <Link key={s} href={s === 'all' ? '/admin/affiliates' : `/admin/affiliates?status=${s}`}
              className={`${styles.filterBtn} ${(!searchParams.status && s === 'all') || searchParams.status === s ? styles.filterActive : ''}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </div>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Status</th><th>Tier</th>
            <th>This month</th><th>Lifetime</th><th>Last commission</th>
          </tr>
        </thead>
        <tbody>
          {(affiliates ?? []).map(a => (
            <tr key={a.code} className={styles.row}>
              <td><Link href={`/admin/affiliates/${a.code}`} className={styles.link}>{a.code}</Link></td>
              <td>{a.full_name}</td>
              <td><span style={{ color: STATUS_COLORS[a.status] ?? 'inherit', textTransform: 'capitalize' }}>{a.status}</span></td>
              <td style={{ textTransform: 'capitalize' }}>{a.tier}</td>
              <td>${(a.this_month_net_usd ?? 0).toFixed(2)}</td>
              <td>${(a.lifetime_net_usd ?? 0).toFixed(2)}</td>
              <td>{a.last_commission_at ? new Date(a.last_commission_at).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lastRow && (
        <a href={`/admin/affiliates?${searchParams.status ? `status=${searchParams.status}&` : ''}cursor=${encodeURIComponent(`${lastRow.lifetime_net_usd}|${lastRow.code}`)}`}
          className={styles.nextPage}>
          Next page →
        </a>
      )}
    </div>
  )
}
