import styles from './PlaceholderPage.module.scss'

export function PlaceholderPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Finders Eaters</h1>
      <p className={styles.body}>Recipes, plans and shopping are on their way.</p>
    </main>
  )
}
