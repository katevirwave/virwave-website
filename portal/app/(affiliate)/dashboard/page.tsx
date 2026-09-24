import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import styles from './dashboard.module.css'
import { CopyReferralLink } from '@/components/CopyReferralLink'
import { getMonthlyTier, countMonthlyConversions } from '@/utils/tiers'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [profileRes, statsRes, monthConversions] = await Promise.all([
    supabase.from('affiliate_profiles').select('code, tier, tier_override, payout_details, full_name, status, needs_rc_grant').eq('user_id', user.id).single(),
    // Lifetime + current month earnings — .single() unwraps the RETURNS TABLE row from array
    supabase.rpc('get_affiliate_dashboard_stats').single(),
    // Conversions this month, counted the way settlement counts them — drives the tier
    countMonthlyConversions(supabase),
  ])

  const profile = profileRes.data
  if (!profile) redirect('/')

  // Redirect to payout setup if no payout details
  if (!profile.payout_details || Object.keys(profile.payout_details).length === 0) {
    redirect('/profile?setup=payout')
  }
  if (profile.status === 'inactive') redirect('/inactive')
  if (profile.status !== 'active') redirect('/pending')

  type DashboardStats = { this_month_net: number; lifetime_net: number; active_subscribers: number; attributed_users: number; all_time_conversions: number; conversion_rate: number; last_conversion_at: string | null }
  const stats: DashboardStats = (statsRes.data as DashboardStats | null) ?? { this_month_net: 0, lifetime_net: 0, active_subscribers: 0, attributed_users: 0, all_time_conversions: 0, conversion_rate: 0, last_conversion_at: null }
  const daysSinceLastConversion = stats.last_conversion_at
    ? Math.floor((Date.now() - new Date(stats.last_conversion_at).getTime()) / 86_400_000)
    : 999  // never converted — treat as inactive
  const nextPayoutDate = getNextPayoutDate()
  const { tier, next, toNext, isOverride } = getMonthlyTier(monthConversions, profile.tier, profile.tier_override)

  return (
    <div className={`${styles.page} page-enter`}>
      {/* Hero block */}
      <section className={styles.hero} aria-label="Earnings summary">
        <div className={styles.heroMain}>
          <span className={styles.heroAmount}>${stats.this_month_net.toFixed(2)}</span>
          <span className={styles.heroLabel}>This month</span>
        </div>
        <div className={styles.heroSecondary}>
          Lifetime · ${stats.lifetime_net.toFixed(2)}
        </div>
        <div className={styles.heroTertiary}>
          {stats.active_subscribers} active subscribers
        </div>
        <div className={styles.heroPayoutNotice}>
          Next payout: ~{nextPayoutDate}
        </div>

        <CopyReferralLink code={profile.code} />
      </section>

      {/* Free premium entitlement badge.
          Four states:
          - Restoring (needs_rc_grant=TRUE): auto-reactivated, RC grant pending (<24h)
          - Never converted (999): neutral — no warning, they haven't had a chance yet
          - Active (< 90 days): normal mint badge
          - Warning (90–119 days): amber badge — cron deactivates at 120 days */}
      {profile.needs_rc_grant ? (
        <div className={`glass-card glass-card--subtle ${styles.premiumBadge}`}>
          <span className={styles.premiumMark} aria-hidden="true">★</span>
          <span className={styles.premiumText}>VirWave Premium — restoring your access now, usually within a few minutes.</span>
        </div>
      ) : daysSinceLastConversion === 999 ? (
        <div className={`glass-card glass-card--subtle ${styles.premiumBadge}`}>
          <span className={styles.premiumMark} aria-hidden="true">★</span>
          <span className={styles.premiumText}>VirWave Premium — included while you're part of the program.</span>
        </div>
      ) : daysSinceLastConversion < 90 ? (
        <div className={`glass-card glass-card--subtle ${styles.premiumBadge}`}>
          <span className={styles.premiumMark} aria-hidden="true">★</span>
          <span className={styles.premiumText}>VirWave Premium — included in your affiliate plan</span>
        </div>
      ) : (
        <div role="status" aria-live="polite" className={`glass-card glass-card--subtle ${styles.premiumBadge} ${styles.premiumBadgeWarn}`}>
          <span className={styles.premiumMarkWarn} aria-hidden="true">⚠︎</span>
          <span className={styles.premiumText}>
            Your premium benefit stays active as long as you're referring new members — last referral {daysSinceLastConversion} days ago.
          </span>
        </div>
      )}

      {/* Tier — the tier this month's referrals have reached, which is the rate settlement pays */}
      {isOverride ? (
        <div className={styles.tierCustom}>{tier.name} tier · {tier.ratePct}% commission · set by the VirWave team</div>
      ) : !next ? (
        <div className={styles.tierCustom}>{tier.name} tier this month · {tier.ratePct}% commission on every referral · top tier</div>
      ) : (
        <section className={styles.tierBlock} aria-label="Tier progress">
          <div className={styles.tierLabel}>{tier.name} tier this month · {tier.ratePct}% commission on every referral</div>
          <div className={styles.progressTrack} role="progressbar"
            aria-valuenow={monthConversions}
            aria-valuemin={0}
            aria-valuemax={next.minConversions}
            aria-label={`${monthConversions} of ${next.minConversions} referrals for ${next.name} tier`}
          >
            <div className={styles.progressFill} style={{ width: `${Math.min(100, (monthConversions / next.minConversions) * 100)}%` }} />
          </div>
          <div className={styles.progressCaption}>
            {monthConversions} of {next.minConversions} referrals this month · {toNext} more for {next.name} ({next.ratePct}% on all of them)
          </div>
          <div className={styles.progressCaption}>Tiers are worked out each month and start fresh on the 1st.</div>
        </section>
      )}

      {/* Stat cards */}
      <div className={styles.statGrid} role="list">
        <StatCard label="Referrals this month" value={String(monthConversions)} />
        <StatCard label="People breathing better" value={String(stats.active_subscribers)} />
        <StatCard label="All-time referrals" value={String(stats.all_time_conversions)} muted />
        <StatCard label="Conversion rate" value={`${stats.conversion_rate.toFixed(1)}%`} muted />
      </div>

      {/* Tier perks — show what they've unlocked and what's next */}
      <section className={styles.perksBlock} aria-label="Your affiliate perks">
        <div className={styles.perksTitle}>Your perks</div>
        <ul className={styles.perksList} aria-label={`${tier.name} tier perks`}>
          {tier.perks.map(perk => (
            <li key={perk} className={styles.perkItem}>
              <span className={styles.perkCheck} aria-hidden="true">✓</span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        {next && (
          <div className={styles.perksNext}>
            Unlock more at {next.name}: {next.unlocks}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`glass-card ${styles.statCard}`} role="listitem">
      <div className={styles.statValue} style={{ color: muted ? 'var(--color-white-70)' : 'var(--color-white-90)' }}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

function getNextPayoutDate(): string {
  const now = new Date()
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  lastOfMonth.setDate(lastOfMonth.getDate() + 30)
  return lastOfMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

