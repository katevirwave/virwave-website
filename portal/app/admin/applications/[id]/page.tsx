import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import { approveAffiliate, rejectApplication } from '@/app/actions/admin'

export const revalidate = 0

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const adminClient = createAdminClient()
  const { data: app } = await adminClient
    .from('affiliate_profiles')
    .select('*')
    .eq('id', params.id)
    .eq('status', 'pending')
    .single()
  if (!app) notFound()

  return (
    <div style={{ padding: 'var(--sp-8)', maxWidth: 600 }}>
      <h1 style={{ color: 'var(--color-white-90)', marginBottom: 'var(--sp-2)' }}>{app.full_name}</h1>
      <p style={{ color: 'var(--color-white-60)', marginBottom: 'var(--sp-4)' }}>
        {app.email} · {app.platform} · {app.audience_size}
      </p>
      {app.application_notes && (
        <blockquote style={{ color: 'var(--color-white-70)', borderLeft: '3px solid var(--glass-medium-border)', paddingLeft: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
          {app.application_notes}
        </blockquote>
      )}
      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <form action={approveAffiliate.bind(null, app.id, app.email, app.code)}>
          <button type="submit" style={{ background: 'var(--color-teal-400)', color: '#fff', border: 'none', padding: 'var(--sp-2) var(--sp-5)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
            Approve
          </button>
        </form>
        <form action={rejectApplication.bind(null, app.id, app.code, 'Rejected via detail page')}>
          <button type="submit" style={{ background: 'var(--glass-medium-bg)', color: 'var(--color-amber-400)', border: '1px solid var(--color-amber-400)', padding: 'var(--sp-2) var(--sp-5)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
            Reject
          </button>
        </form>
      </div>
    </div>
  )
}
