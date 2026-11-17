import { useEffect } from 'react'
import { Link, Navigate } from 'react-router'
import mascotUrl from '../../assets/mascot.svg'
import { useAuth } from '../../contexts/auth.ts'
import styles from './HomePage.module.css'

const features = [
  {
    title: 'See the week',
    body: 'Classes and placed tasks share one calendar, with today marked so the day is easy to scan.',
  },
  {
    title: 'Place a task',
    body: 'Add what you need to do. Place finds the next open slot around the classes already on the grid.',
  },
  {
    title: 'Set your hours',
    body: 'Rules keep new tasks inside the times you choose, such as mornings or a full study day.',
  },
  {
    title: 'Keep a streak',
    body: 'Start a block on its day to count it. The bird tells you what is next and when something is close.',
  },
]

function HomePage() {
  const { token } = useAuth()

  useEffect(() => {
    document.title = 'CalendAction'
  }, [])

  if (token) return <Navigate to="/week" replace />

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Week planner for students</p>
          <h1 id="home-title" className={styles.headline}>
            Your week, with time left for the work.
          </h1>
          <p className={styles.lede}>
            CalendAction puts classes on a calendar and places tasks in the open hours you allow.
            Start a block to keep a streak, and let the bird tell you what is next.
          </p>
          <div className={styles.actions}>
            <Link className={styles.ctaPrimary} to="/register">
              Create account
            </Link>
            <Link className={styles.ctaSecondary} to="/login">
              Log in
            </Link>
          </div>
        </div>

        <div className={styles.showcase}>
          <div className={styles.mini} aria-hidden="true">
            {[
              ['Mon', 'class', 'CS 2340'],
              ['Tue', 'task', 'P-set'],
              ['Wed', 'class', 'Math'],
              ['Thu', 'none', ''],
              ['Fri', 'class', 'Studio'],
            ].map(([day, kind, label], index) => (
              <div key={day} className={index === 1 ? `${styles.col} ${styles.today}` : styles.col}>
                <span className={styles.day}>{day}</span>
                {kind === 'class' && <span className={styles.chip}>{label}</span>}
                {kind === 'task' && <span className={styles.task}>{label}</span>}
              </div>
            ))}
          </div>
          <div className={styles.bird}>
            <img src={mascotUrl} alt="CalendAction bird mascot" width={72} height={72} />
            <p>Next up: problem set, today at 4:00 PM.</p>
          </div>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-title">
        <h2 id="features-title">How it works</h2>
        <ol className={styles.grid}>
          {features.map((feature, index) => (
            <li key={feature.title} className={styles.card}>
              <span className={styles.step} aria-hidden="true">
                {index + 1}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export default HomePage
