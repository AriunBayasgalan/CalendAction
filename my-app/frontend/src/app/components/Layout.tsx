import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../../contexts/auth.ts'
import styles from './Layout.module.css'

function Layout() {
  const { token, logout } = useAuth()

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
          {token ? (
            <button type="button" className={styles.link} onClick={logout}>
              Log out
            </button>
          ) : (
            <NavLink to="/login" className={styles.link}>
              Log in
            </NavLink>
          )}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
