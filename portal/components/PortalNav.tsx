'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './PortalNav.module.css'

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '◈' },
  { href: '/payouts',   label: 'Payouts',   icon: '◎' },
  { href: '/stats',     label: 'Stats',     icon: '◉' },
  { href: '/profile',   label: 'Profile',   icon: '◐' },
]

export function PortalNav() {
  const pathname = usePathname()
  return (
    <>
      {/* Sidebar — desktop (≥1280px) collapsible, tablet (768–1279px) expanded */}
      <nav className={styles.sidebar} aria-label="Portal navigation">
        <div className={styles.sidebarLogo}>
          <span className={styles.wordmark}>VirWave</span>
        </div>
        <ul className={styles.sidebarList} role="list">
          {ITEMS.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.sidebarItem} ${isActive ? styles.active : ''}`}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                >
                  <span className={styles.icon} aria-hidden="true">{item.icon}</span>
                  <span className={styles.label}>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom tab bar — mobile (<768px) */}
      <nav className={styles.tabBar} aria-label="Portal navigation">
        {ITEMS.map(item => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.tabIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.tabLabel}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
