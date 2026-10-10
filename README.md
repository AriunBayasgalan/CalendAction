# CalendAction

MERN starter for the WebDev@GT CalendAction MVP. This repo is the scaffold only: a Vite + React + TypeScript frontend and an Express + Mongoose API. Auth, the week view, and data models are later issues.

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
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Signing secret for later auth work |
| `CLIENT_ORIGIN` | Browser origin allowed by CORS (default `http://localhost:5173`) |
| `PORT` | API port (default `5000`) |

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

Frontend production build:

```bash
npm run build
```

API without the file watcher:

```bash
npm start
```

## Layout

- `my-app/frontend/` — Vite, React, and TypeScript. `src/app/App.tsx` renders the starter screen in `src/app/pages/`, and CSS lives in `src/styles/`. Tailwind and Zustand are installed; Zustand is not used by a screen yet.
- `my-app/backend/` — Express entry point `server.js`, with the root route in `routes/` and its handler in `controllers/`. Mongoose, CORS, and dotenv are wired up. `jsonwebtoken`, `bcrypt`, and `zod` are installed for later issues and are not wired up yet. There are no models or custom middleware in this scaffold.

Sign-in, `/login`, `/week`, `/health`, and Mongoose models are not in this scaffold.
