# CalendAction

MERN starter for the WebDev@GT CalendAction MVP. This repo is the scaffold only: a Vite + React + TypeScript client and an Express + Mongoose API. Auth, the week view, and data models are later issues.

## Prerequisites

- Node.js 22+
- npm 10+

The API starts without MongoDB. If `MONGODB_URI` is missing or the connection fails, the process still listens and logs that it is running without a database.

## Environment

Copy the example file and replace the placeholders. Real values stay in `.env`, which is gitignored. `.env.example` is safe to commit.

```bash
cp my-app/backend/.env.example my-app/backend/.env
```

`my-app/backend/.env`

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |

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

- `my-app/frontend/` — stock Vite + React + TypeScript starter (`src/App.tsx`, `src/App.css`, `src/index.css`). The GitTogether folder skeleton is in place: `src/app/components/` (including `ui/` and `figma/`), `src/app/pages/`, `src/components/`, `src/contexts/`, `src/pages/`, `src/styles/`, and `guidelines/`. Folders without app code contain `info.txt`.
- `my-app/backend/` — `server.js`, `controllers/`, `middleware/`, `models/`, and `routes/`. Express, Mongoose, CORS, and dotenv are wired up. `jsonwebtoken`, `bcrypt`, and `zod` are installed for later issues and are not wired up yet. `middleware/` and `models/` are placeholders.

Sign-in, `/login`, `/week`, `/health`, and Mongoose models are not in this scaffold.
