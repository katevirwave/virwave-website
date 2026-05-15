import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/AdminNav'
import styles from './admin.module.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  // Always use getUser(), not getSession() — server-validated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const adminClient = createAdminClient()
  const { data: adminRow } = await adminClient
    .from('admin_users').select('display_name').eq('user_id', user.id).single()
  if (!adminRow) redirect('/dashboard')

  // Pending application count for badge
  const { count: pendingCount } = await adminClient
    .from('affiliate_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className={styles.shell}>
      <AdminNav adminName={adminRow.display_name} pendingCount={pendingCount ?? 0} />
      <main className={styles.content}>{children}</main>
    </div>
  )
}
