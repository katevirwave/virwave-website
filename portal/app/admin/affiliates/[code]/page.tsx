import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'

export const revalidate = 0

export default async function AffiliateDetailPage({ params }: { params: { code: string } }) {
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('affiliate_profiles')
    .select('*')
    .eq('code', params.code)
    .single()
  if (!profile) notFound()

  // TODO: Phase 2 detail view — commission history, tier override, suspend/reactivate actions
  return (
    <div style={{ padding: 'var(--sp-8)' }}>
      <h1 style={{ color: 'var(--color-white-90)', marginBottom: 'var(--sp-4)' }}>
        {profile.full_name} ({profile.code})
      </h1>
      <p style={{ color: 'var(--color-white-60)' }}>Status: {profile.status} · Tier: {profile.tier}</p>
      <p style={{ color: 'var(--color-white-40)', fontSize: '0.875rem', marginTop: 'var(--sp-6)' }}>
        Full detail view coming in a later task.
      </p>
    </div>
  )
}
