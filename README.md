# CalendAction

CalendAction is a week planner for students. It places tasks into free holes
around classes, with rules for when work can happen, a streak, and a mascot.

- **Web (production):** https://calend-action.vercel.app/
- **API (production):** https://calendaction.onrender.com/
- **API health:** https://calendaction.onrender.com/health

Feature freeze: after **20 November 2026**, only bugfix PRs may land on `main`.
See [docs/FREEZE.md](docs/FREEZE.md).

The demo account login is in the private demo doc, not this README.
After deploying, seed the production database (see CA-32, `npm run seed` in
`my-app/backend/`) so the production URL loads that week. Deploy steps are
in [docs/DEPLOY.md](docs/DEPLOY.md).

## Prerequisites

- Node.js 22+
- npm 10+
- A MongoDB database (Atlas or local) for a full run. Tests use
  `mongodb-memory-server` and do not need a real database.

## Environment

Copy the example files and replace the placeholders. Real values stay in
`.env`, which is gitignored. `.env.example` is safe to commit.

```bash
cp my-app/backend/.env.example my-app/backend/.env
cp my-app/frontend/.env.example my-app/frontend/.env
```

`my-app/backend/.env`

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string, including the database name |
| `JWT_SECRET` | Long random string used to sign logins. Required. |
| `CLIENT_ORIGIN` | Allowed browser origin. Comma-separate more than one (for example local and production). |
| `DEFAULT_TIMEZONE` | Fallback time zone (`America/New_York`) |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | Only needed for `npm run seed`. Keep the password in the private demo doc. |

`my-app/frontend/.env`

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL (no trailing slash). Vite only exposes variables prefixed with `VITE_`. |

On macOS, AirPlay Receiver often occupies port 5000. If the API cannot start
or the page gets 403s, set `PORT=5001` and `VITE_API_URL=http://localhost:5001`.

## Install

From the repository root:

```bash
npm run install:all
```

## Run locally

```bash
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:5000 (or the `PORT` you set)

One side at a time:

```bash
npm run dev:frontend
npm run dev:backend
```

Client production build:

```bash
npm run build
```

API without the file watcher:

```bash
npm start
```

Demo week (optional), from `my-app/backend/` after `.env` has `MONGODB_URI` and
`DEMO_PASSWORD`:

```bash
npm run seed
```

## Layout

- `my-app/frontend/` — Vite + React + TypeScript. Routes are in
  `src/app/routes.tsx` (`/login`, `/week`, `/rules`). The week grid, task
  list, event panel, mascot, and nag banner live under `src/app/`.
- `my-app/backend/` — Express 5 + Mongoose 9. `npm start` runs `server.js`.
  Auth, events, tasks, rules, placement, and streaks are under `routes/`,
  `controllers/`, `models/`, and `services/`.
