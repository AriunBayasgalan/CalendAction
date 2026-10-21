import { Link, NavLink, Outlet } from 'react-router'
import styles from './Layout.module.css'

function Layout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/week" className={styles.brand}>
          CalendAction
        </Link>
        <nav className={styles.nav}>
          <NavLink to="/week" className={styles.link}>
            Week
          </NavLink>
          <NavLink to="/login" className={styles.link}>
            Log in
          </NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
