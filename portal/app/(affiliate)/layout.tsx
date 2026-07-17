import { PortalNav } from '@/components/PortalNav'
import styles from './portal.module.css'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <PortalNav />
      <main className={styles.content}>{children}</main>
    </div>
  )
}
