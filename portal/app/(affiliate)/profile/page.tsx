import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { PayoutForm } from './PayoutForm'
import styles from './profile.module.css'

export default async function ProfilePage({ searchParams }: { searchParams: { setup?: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('affiliate_profiles')
    .select('code, full_name, email, platform, audience_size, tier, payout_method, payout_details')
    .single()

  if (!profile) redirect('/')

  const isSetup = searchParams.setup === 'payout'
  const hasPayoutDetails = profile.payout_details && Object.keys(profile.payout_details).length > 0

  return (
    <div className={`${styles.page} page-enter`}>
      <h1 className={styles.title}>Profile</h1>

      {/* Non-dismissable payout setup callout */}
      {(isSetup || !hasPayoutDetails) && (
        <div className={`glass-card glass-card--subtle ${styles.setupCallout}`} role="alert">
          <strong className={styles.calloutHeading}>Add a payout method</strong>
          <p className={styles.calloutBody}>
            Add a payout method so your earnings can reach you.
            Payouts are processed monthly, 30 days after month-end.
          </p>
        </div>
      )}

      {/* Read-only profile info */}
      <section className={`glass-card ${styles.infoCard}`}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div className={styles.infoGrid}>
          <span className={styles.infoLabel}>Name</span><span className={styles.infoValue}>{profile.full_name}</span>
          <span className={styles.infoLabel}>Email</span><span className={styles.infoValue}>{profile.email}</span>
          <span className={styles.infoLabel}>Affiliate code</span><span className={styles.infoValue}>{profile.code}</span>
          <span className={styles.infoLabel}>Tier</span><span className={styles.infoValue} style={{ textTransform: 'capitalize' }}>{profile.tier}</span>
        </div>
      </section>

      {/* Payout details form */}
      <section className={`glass-card ${styles.payoutCard}`}>
        <h2 className={styles.sectionTitle}>Payout details</h2>
        <PayoutForm
          currentMethod={profile.payout_method ?? ''}
          currentDetails={(profile.payout_details as Record<string, string>) ?? {}}
        />
      </section>
    </div>
  )
}
