// utils/tiers.ts — the affiliate tier ladder, as the portal displays it.
//
// The source of truth is settle_affiliate_month() in virwave_v3
// (supabase/migrations/20260514000008_affiliate_views_rpcs.sql). Settlement picks a
// tier each month from that month's qualifying conversions (gross_amount_usd > 0),
// applies its rate to every event in the month, and starts over the next month.
// An admin tier override replaces the calculated tier. Keep these numbers in step
// with that function — if they drift, the dashboard promises a rate we don't pay.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AffiliateTier } from '@/types/database'

export interface TierDefinition {
  id: AffiliateTier
  name: string
  ratePct: number
  minConversions: number
  perks: string[]
  unlocks: string  // what reaching this tier adds, shown as the next goal
}

export const TIERS: TierDefinition[] = [
  {
    id: 'starter', name: 'Starter', ratePct: 15, minConversions: 0,
    perks: ['Free VirWave Premium', '15% commission on every referral', 'Affiliate dashboard + analytics'],
    unlocks: '15% commission',
  },
  {
    id: 'growth', name: 'Growth', ratePct: 25, minConversions: 10,
    perks: ['Free VirWave Premium', '25% commission on every referral', 'Affiliate dashboard + analytics', 'Early access to new features'],
    unlocks: '25% commission + early feature access',
  },
  {
    id: 'partner', name: 'Partner', ratePct: 40, minConversions: 50,
    perks: ['Free VirWave Premium', '40% commission on every referral', 'Affiliate dashboard + analytics', 'Early access to new features', 'Co-marketing opportunities with VirWave'],
    unlocks: '40% commission + co-marketing',
  },
]

export interface MonthlyTier {
  tier: TierDefinition
  next: TierDefinition | null  // null at the top tier or under an override
  toNext: number               // conversions still needed for `next`
  isOverride: boolean
}

// Mirrors settlement: override wins, otherwise the highest tier this month's count reaches.
export function getMonthlyTier(conversions: number, profileTier: AffiliateTier, tierOverride: boolean): MonthlyTier {
  if (tierOverride) {
    const tier = TIERS.find(t => t.id === profileTier) ?? TIERS[0]
    return { tier, next: null, toNext: 0, isOverride: true }
  }
  const index = TIERS.reduce((found, t, i) => (conversions >= t.minConversions ? i : found), 0)
  const next = TIERS[index + 1] ?? null
  return {
    tier: TIERS[index],
    next,
    toNext: next ? next.minConversions - conversions : 0,
    isOverride: false,
  }
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)  // 'YYYY-MM' in UTC, matching event_month
}

// Counts this month's conversions the way settlement does: unsettled events with a
// positive gross amount. Refunds and reversals don't count toward a tier. RLS scopes
// the rows to the signed-in affiliate.
export async function countMonthlyConversions(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('affiliate_commission_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_month', currentMonth())
    .is('payout_id', null)
    .gt('gross_amount_usd', 0)
  return count ?? 0
}
