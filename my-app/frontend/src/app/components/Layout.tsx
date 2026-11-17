import { Link, NavLink, Outlet, useLocation } from 'react-router'
import mascotUrl from '../../assets/mascot.svg'
import { useAuth } from '../../contexts/auth.ts'
import styles from './Layout.module.css'

function Layout() {
  const { token, logout } = useAuth()
  const { pathname } = useLocation()
  const quiet = pathname === '/' || pathname === '/login' || pathname === '/register'

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link to={token ? '/week' : '/'} className={styles.brand}>
          <img src={mascotUrl} alt="" width={32} height={32} />
          <span>CalendAction</span>
        </Link>
        <nav className={styles.nav} aria-label="Main">
          {token ? (
            <>
              <NavLink to="/week" className={styles.link}>
                Week
              </NavLink>
              <NavLink to="/rules" className={styles.link}>
                Rules
              </NavLink>
              <button type="button" className={`${styles.link} ${styles.logout}`} onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={styles.link}>
                Log in
              </NavLink>
              <NavLink to="/register" className={styles.signup}>
                Sign up
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className={quiet ? `${styles.main} ${styles.quiet}` : styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
