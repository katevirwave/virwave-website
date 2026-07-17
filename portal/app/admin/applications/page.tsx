import { createAdminClient } from '@/utils/supabase/admin'
import { approveAffiliate, rejectApplication } from '@/app/actions/admin'
import styles from './applications.module.css'

export const revalidate = 0

export default async function ApplicationsPage() {
  const adminClient = createAdminClient()
  const { data: applications } = await adminClient
    .from('affiliate_profiles')
    .select('id, code, full_name, email, platform, audience_size, application_notes, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (
    <div className={`${styles.page} page-enter`}>
      <h1 className={styles.title}>
        Applications
        {applications && applications.length > 0 && (
          <span className={styles.count}>{applications.length} pending</span>
        )}
      </h1>
      {!applications?.length && (
        <div className={`glass-card ${styles.empty}`}>No pending applications.</div>
      )}
      <ul className={styles.list} role="list">
        {(applications ?? []).map(app => (
          <li key={app.id} className={`glass-card glass-card--subtle ${styles.card}`}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.name}>{app.full_name}</span>
                <span className={styles.meta}>{app.platform} · {app.audience_size} · {app.email}</span>
              </div>
              <span className={styles.date}>{new Date(app.created_at).toLocaleDateString()}</span>
            </div>
            {app.application_notes && (
              <p className={styles.story}>{app.application_notes}</p>
            )}
            <div className={styles.actions}>
              <a href={`/admin/applications/${app.id}`} className={styles.detailLink}>View full →</a>
              <form action={approveAffiliate.bind(null, app.id, app.email, app.code)}>
                <button type="submit" className={styles.approveBtn}>Approve</button>
              </form>
              <form action={rejectApplication.bind(null, app.id, app.code, 'Rejected by admin')}>
                <button type="submit" className={styles.rejectBtn}>Reject</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
