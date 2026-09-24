import { createAdminClient } from '@/utils/supabase/admin'
import { markPayoutPaid, markPayoutApproved, runSettlement } from '@/app/actions/admin'
import styles from './payouts.module.css'

export const revalidate = 0

// Cursor-based pagination — never offset. The cursor is the last row's (payout_month, id),
// matching the sort order so pages neither skip nor repeat rows.
export default async function AdminPayoutsPage({ searchParams }: { searchParams: { month?: string; id?: string } }) {
  const adminClient = createAdminClient()
  let query = adminClient
    .from('affiliate_payouts')
    .select('*, affiliate_profiles(full_name)')
    .order('payout_month', { ascending: false })
    .order('id', { ascending: false })
    .limit(50)
  const { month, id } = searchParams
  // Both values go into a PostgREST filter string — allow only month/uuid characters.
  if (month && id && /^[\w-]+$/.test(month) && /^[\w-]+$/.test(id)) {
    query = query.or(`payout_month.lt.${month},and(payout_month.eq.${month},id.lt.${id})`)
  }
  const { data: payouts } = await query

  const lastRow = payouts && payouts.length === 50 ? payouts[payouts.length - 1] : null
  const prevDate = new Date(); prevDate.setMonth(prevDate.getMonth() - 1)
  const prevMonth = prevDate.toISOString().slice(0, 7)

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    on_hold:  { label: 'On hold',    color: 'var(--color-white-60)' },
    approved: { label: 'Approved',   color: 'var(--color-teal-400)' },
    paid:     { label: 'Paid',       color: 'var(--color-mint-400)' },
    rejected: { label: 'Rejected',   color: 'var(--color-amber-400)' },
  }

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.header}>
        <h1 className={styles.title}>Payouts</h1>
        <form action={runSettlement.bind(null, prevMonth)}>
          <button type="submit" className={styles.settlementBtn}>Run settlement ({prevMonth})</button>
        </form>
      </div>
      <table className={styles.table}>
        <thead>
          <tr><th>Month</th><th>Affiliate</th><th>Net USD</th><th>Status</th><th>Method</th><th>Action</th></tr>
        </thead>
        <tbody>
          {(payouts ?? []).map(p => {
            const s = STATUS_LABELS[p.status] ?? { label: p.status, color: 'inherit' }
            const affiliateName = (p.affiliate_profiles as { full_name?: string } | null)?.full_name ?? p.affiliate_code
            return (
              <tr key={p.id}>
                <td>{p.payout_month}</td>
                <td>{affiliateName}</td>
                <td>${(p.total_commission_usd ?? 0).toFixed(2)}</td>
                <td><span style={{ color: s.color }}>{s.label}</span></td>
                <td style={{ textTransform: 'capitalize' }}>{p.payout_method ?? '—'}</td>
                <td className={styles.actionCell}>
                  {p.status === 'on_hold' && (
                    <form action={markPayoutApproved.bind(null, p.id, p.affiliate_code)}>
                      <button type="submit" className={styles.approveBtn}>Approve</button>
                    </form>
                  )}
                  {p.status === 'approved' && (
                    <MarkPaidForm payoutId={p.id} affiliateCode={p.affiliate_code} />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {lastRow && (
        <a href={`/admin/payouts?month=${encodeURIComponent(lastRow.payout_month)}&id=${encodeURIComponent(lastRow.id)}`} className={styles.nextPage}>
          Next page →
        </a>
      )}
    </div>
  )
}

// Separate Server Component so the formAction can be a proper bound server action
async function MarkPaidForm({ payoutId, affiliateCode }: { payoutId: string; affiliateCode: string }) {
  const action = markPayoutPaid.bind(null, payoutId, affiliateCode)

  async function handleForm(fd: FormData) {
    'use server'
    const ref = fd.get('ref') as string
    await markPayoutPaid(payoutId, affiliateCode, ref)
  }

  return (
    <form className={styles.payForm} action={handleForm}>
      <input type="text" name="ref" placeholder="Reference #" required className={styles.refInput} />
      <button type="submit" className={styles.payBtn}>Mark paid</button>
    </form>
  )
}
