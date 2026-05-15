import { ApplyForm } from './ApplyForm'
import styles from './apply.module.css'

export default function ApplyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.copy}>
        <h1 className={styles.headline}>Bring VirWave to your community</h1>
        <p className={styles.subheadline}>Share what helps you breathe. Earn when your community subscribes.</p>
      </div>
      <div className={`glass-card ${styles.formCard}`}>
        <ApplyForm />
      </div>
    </div>
  )
}
