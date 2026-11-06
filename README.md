# CalendAction

MERN starter for the WebDev@GT CalendAction MVP. This repo is the scaffold only: a Vite + React + TypeScript client with a routed shell and an empty week grid, and an Express + Mongoose API. Auth, events, and data models are later issues.

## Prerequisites

- Node.js 22+
- npm 10+

The API starts without MongoDB. If `MONGODB_URI` is missing or the connection fails, the process still listens and logs that it is running without a database.

## Environment

Copy the example files and replace the placeholders. Real values stay in `.env`, which is gitignored. `.env.example` is safe to commit.

```bash
cp my-app/backend/.env.example my-app/backend/.env
cp my-app/frontend/.env.example my-app/frontend/.env
```

`my-app/backend/.env`

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |

`my-app/frontend/.env`

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL. Vite only exposes variables prefixed with `VITE_`. |

## Install

From the repository root:

```bash
npm run install:all
```

That installs root tooling, `my-app/frontend/`, and `my-app/backend/`.

## Run locally

```bash
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:5000

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

## Layout

- `my-app/frontend/` — Vite + React + TypeScript app shell with React Router. Routes are in `src/app/routes.tsx` (`/login`, `/week`; `/` and unknown paths redirect to `/week`). The header layout is `src/app/components/Layout.tsx`, and the pages are in `src/app/pages/`. The week view (`WeekPage.tsx`) uses `WeekHeader.tsx` and `WeekGrid.tsx` from `src/app/components/`, with the date helpers in `week.ts` next to them. Weeks run Monday to Sunday, 7am to 10pm, in the browser's local timezone. Styling is plain CSS: global styles in `src/index.css`, component styles as CSS modules. The rest of the GitTogether folder skeleton is in place: `src/app/components/ui/`, `src/app/components/figma/`, `src/components/`, `src/contexts/`, `src/pages/`, `src/styles/`, and `guidelines/`. Folders without app code contain `info.txt`.
- `my-app/backend/` — `server.js` answers `GET /` inline. `controllers/`, `routes/`, `middleware/`, and `models/` are placeholders. Express, Mongoose, CORS, and dotenv are wired up. `jsonwebtoken`, `bcrypt`, and `zod` are installed for later issues and are not wired up yet.

`/week` shows an empty week grid with previous, next, and today controls. `/login` is a placeholder page. Sign-in, events, `/health`, and Mongoose models are later issues.
