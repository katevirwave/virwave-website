'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './AdminNav.module.css'

const ITEMS = [
  { href: '/admin/dashboard',    label: 'Overview',      icon: '◈' },
  { href: '/admin/applications', label: 'Applications',  icon: '◎', badge: true },
  { href: '/admin/affiliates',   label: 'Affiliates',    icon: '◉' },
  { href: '/admin/payouts',      label: 'Payouts',       icon: '◐' },
  { href: '/admin/fraud',        label: 'Fraud signals', icon: '⚠' },
]

export function AdminNav({ adminName, pendingCount }: { adminName: string; pendingCount: number }) {
  const pathname = usePathname()
  return (
    <nav className={styles.sidebar} aria-label="Admin navigation">
      <div className={styles.header}>
        <span className={styles.wordmark}>VirWave Admin</span>
        <span className={styles.adminName}>{adminName}</span>
      </div>
      <ul className={styles.list} role="list">
        {ITEMS.map(item => {
          const isActive = pathname.startsWith(item.href)
          const showBadge = item.badge && pendingCount > 0
          return (
            <li key={item.href}>
              <Link href={item.href}
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.icon} aria-hidden="true">{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
                {showBadge && (
                  <span className={styles.badge} aria-label={`${pendingCount} pending`}>
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
