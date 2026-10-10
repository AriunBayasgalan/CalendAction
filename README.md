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

The directory tree matches [GitTogether](https://github.com/AriunBayasgalan/GitTogether). Folders that do not have CalendAction code yet contain a short `info.txt` (`Info.txt` under `models/`) describing what belongs there.

The frontend UI is the stock Vite + React + TypeScript starter (counter, `src/App.css`, `src/index.css`, and the React and Vite logos). `routes.tsx` and `Layout.tsx` are described in `info.txt` files instead of being modules, so they are not imported and the starter is the only screen. No router dependency is installed.

- `my-app/frontend/` — Vite, React, and TypeScript. Tailwind and Zustand are installed; the starter does not import them.
  - `src/main.tsx` mounts `src/App.tsx`.
  - `src/app/`, `src/app/components/` (including `ui/` and `figma/`), `src/app/pages/`, `src/components/`, `src/contexts/`, `src/pages/`, `src/styles/`, and `guidelines/` are placeholders.
  - `public/` holds the starter favicon and icons. `src/assets/` holds the starter images.
- `my-app/backend/` — Express entry point `server.js`. Mongoose, CORS, and dotenv are wired up. `jsonwebtoken`, `bcrypt`, and `zod` are installed for later issues and are not wired up yet.
  - `routes/` and `controllers/` serve `GET /`.
  - `middleware/` and `models/` are placeholders. CORS and `express.json()` stay in `server.js`.
- `.github/workflows/blank.yml` — starter CI workflow.

Sign-in, `/login`, `/week`, `/health`, and Mongoose models are not in this scaffold.
