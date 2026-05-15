import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import styles from './inactive.module.css'
import { CopyReferralLink } from '@/components/CopyReferralLink'

export default async function InactivePage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Fetch profile separately — affiliate_profiles does not have all_time_conversions or lifetime_net columns.
  // Those come from the get_affiliate_dashboard_stats RPC which reads commission_events.
  const { data: profile } = await supabase
    .from('affiliate_profiles')
    .select('code, full_name')
    .eq('user_id', user.id)
    .eq('status', 'inactive')
    .single()

  if (!profile) redirect('/')

  type InactiveStats = { all_time_conversions: number; lifetime_net: number }
  const { data: rawStats } = await supabase
    .rpc('get_affiliate_dashboard_stats')
    .single()
  const stats = rawStats as InactiveStats | null

  const hasImpact = (stats?.all_time_conversions ?? 0) > 0 || (stats?.lifetime_net ?? 0) > 0

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.statusBadge} role="img" aria-label="Account paused">Account paused</div>
        <h1 className={styles.heading}>Your affiliate account is paused</h1>
        <p className={styles.body}>
          {"It's been a while since your last referral, so your VirWave Premium is on hold."}
          {' One new subscriber reactivates everything — instantly, automatically. No steps, no wait.'}
        </p>
        <p className={styles.bodySecondary}>
          We sent a heads-up email a while back. If you missed it, this is where things stand.
        </p>
      </section>

      <section className={`glass-card ${styles.ctaCard}`} aria-label="Reactivation call to action">
        <div className={styles.ctaHeading}>Share your link to reactivate</div>
        <p className={styles.ctaBody}>
          When someone signs up via your link and becomes a paid member, your account restores automatically.
          No email needed. No waiting.
        </p>
        <CopyReferralLink code={profile.code} />
      </section>

      {hasImpact && (
        <section className={`glass-card glass-card--subtle ${styles.statsCard}`} aria-label="Your impact">
          <div className={styles.statsTitle}>Your impact so far</div>
          <div className={styles.statsRow}>
            <span className={styles.stat}>{stats?.all_time_conversions ?? 0} people helped</span>
            <span className={styles.statSep} aria-hidden="true">·</span>
            <span className={styles.stat}>${(stats?.lifetime_net ?? 0).toFixed(2)} earned</span>
          </div>
        </section>
      )}
    </div>
  )
}
