// types/database.ts — Supabase table row types for the affiliate portal

export type AffiliateStatus = 'pending' | 'active' | 'inactive' | 'suspended' | 'terminated'
export type AffiliateTier = 'starter' | 'growth' | 'partner'
export type PayoutMethod = 'paypal' | 'wise' | 'bank'
export type PayoutStatus = 'on_hold' | 'pending' | 'approved' | 'paid' | 'rejected'

export interface AffiliateProfile {
  id: string
  created_at: string
  code: string
  email: string
  full_name: string
  status: AffiliateStatus
  tier: AffiliateTier
  tier_override: boolean
  platform: string
  audience_size: string
  application_notes: string | null
  user_id: string | null
  payout_method: PayoutMethod | null
  payout_details: Record<string, string> | null
  approved_at: string | null
  suspended_at: string | null
  notes: string | null
  needs_rc_grant: boolean
  inactivity_warning_sent_at: string | null
}

export interface AffiliatePayout {
  id: string
  created_at: string
  affiliate_code: string
  payout_month: string
  total_commission_usd: number | null
  status: PayoutStatus
  payout_method: string | null
  payout_reference: string | null
  hold_until: string | null
  approved_at: string | null
  paid_at: string | null
  notes: string | null
}

export interface AffiliateCommissionEvent {
  id: string
  created_at: string
  affiliate_code: string
  event_type: string
  event_month: string
  commission_amount_usd: number | null
  payout_id: string | null
  supabase_user_id: string | null
}

export interface AffiliateAttribution {
  id: string
  created_at: string
  affiliate_code: string
  supabase_user_id: string | null
  attribution_method: string
  converted: boolean
}

export interface AffiliateStatsMV {
  code: string
  full_name: string
  status: AffiliateStatus
  tier: AffiliateTier
  tier_override: boolean
  all_time_conversions: number
  this_month_conversions: number
  lifetime_net_usd: number
  this_month_net_usd: number
  attributed_users: number
  click_count: number
  last_commission_at: string | null
}

export interface DashboardStats {
  this_month_net: number
  lifetime_net: number
  active_subscribers: number
  attributed_users: number
  all_time_conversions: number
  conversion_rate: number
  last_conversion_at: string | null
}
