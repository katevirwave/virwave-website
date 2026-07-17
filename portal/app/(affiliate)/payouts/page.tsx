import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import styles from './payouts.module.css'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  on_hold:  { label: 'On hold',             color: 'var(--color-amber-400)' },
  pending:  { label: 'Processing',          color: 'var(--color-teal-400)' },
  approved: { label: 'Approved',            color: 'var(--color-mint-400)' },
  paid:     { label: 'Sent',                color: 'var(--color-white-90)' },
  rejected: { label: 'Requires attention',  color: 'var(--color-amber-400)' },
}

export default async function PayoutsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const currentMonth = new Date().toISOString().slice(0, 7)

  const [profileRes, payoutsRes, accruingRes] = await Promise.all([
    supabase.from('affiliate_profiles').select('code').eq('user_id', user.id).single(),
    supabase.from('affiliate_payouts').select('*').order('payout_month', { ascending: false }),
    supabase.from('affiliate_commission_events')
      .select('commission_amount_usd')
      .eq('event_month', currentMonth)
      .is('payout_id', null),
  ])

  const profile = profileRes.data
  if (!profile) redirect('/')

  const payouts = payoutsRes.data ?? []
  const events = accruingRes.data ?? []
  const accruingTotal = events.reduce((sum, e) => sum + (e.commission_amount_usd ?? 0), 0)
  const hasCurrentMonthPayout = payouts.some(p => p.payout_month === currentMonth)
  const hasAnyEvents = events.length > 0 || payouts.length > 0

  const settleDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className={`${styles.page} page-enter`}>
      <h1 className={styles.title}>Payouts</h1>

      {/* Accruing card — current month, hides after settlement run */}
      {!hasCurrentMonthPayout && (
        <div className={`glass-card ${styles.accruingCard}`}>
          <div className={styles.accruingHeader}>
            <span className={styles.accruingMonth}>
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} — Accruing
            </span>
            <span className={styles.accruingTag}>Settles {settleDate}</span>
          </div>
          <div className={styles.accruingAmount}>${accruingTotal.toFixed(2)}</div>
        </div>
      )}

      {/* Settled payout history */}
      {payouts.length > 0 ? (
        <ul className={styles.payoutList} role="list">
          {payouts.map(payout => {
            const statusInfo = STATUS_MAP[payout.status] ?? { label: payout.status, color: 'var(--color-white-70)' }
            const isOnHold = payout.status === 'on_hold' && payout.hold_until
            const isRejected = payout.status === 'rejected'
            return (
              <li key={payout.id} className={`glass-card glass-card--subtle ${styles.payoutRow}`} role="listitem">
                <div className={styles.payoutMeta}>
                  <span className={styles.payoutMonth}>
                    {new Date(payout.payout_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <span className={styles.payoutAmount}>${(payout.total_commission_usd ?? 0).toFixed(2)}</span>
                </div>
                <div className={styles.payoutStatus}>
                  <span style={{ color: statusInfo.color, fontSize: '0.8125rem', fontWeight: 500 }}>
                    {isOnHold
                      ? `On hold · until ${new Date(payout.hold_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : statusInfo.label
                    }
                  </span>
                  {payout.payout_method && (
                    <span className={styles.payoutMethod}>{payout.payout_method}</span>
                  )}
                </div>
                {isRejected && payout.notes && (
                  <p className={styles.rejectedNote}>
                    {payout.notes}{' '}
                    <a href="mailto:affiliates@virwave.com" style={{ color: 'var(--color-teal-400)' }}>Email us.</a>
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className={`glass-card ${styles.emptyState}`}>
          {hasAnyEvents
            ? `Your first payout is being prepared. It will appear here after ${settleDate}'s close.`
            : 'No payouts yet — earnings from your first complete month will appear here.'
          }
        </div>
      )}
    </div>
  )
}
