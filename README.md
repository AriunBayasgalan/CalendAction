# CalendAction

MERN starter for the WebDev@GT CalendAction MVP. This repo is the scaffold only: a Vite + React + TypeScript client and an Express + Mongoose API. Auth, the week view, and data models are later issues.

## Prerequisites

- Node.js 22+
- npm 10+

The API starts without MongoDB. If `MONGODB_URI` is missing or the connection fails, the process still listens and logs that it is running without a database.

## Environment

Copy the example files and replace the placeholders. Real values stay in `.env`, which is gitignored. `.env.example` is safe to commit.

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`server/.env`

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Signing secret for later auth work |
| `CLIENT_ORIGIN` | Browser origin allowed by CORS (default `http://localhost:5173`) |
| `PORT` | API port (default `5000`) |

`client/.env`

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL. Vite only exposes variables prefixed with `VITE_`. |

## Install

From the repository root:

```bash
npm run install:all
```

That installs root tooling, `client/`, and `server/`.

## Run locally

```bash
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:5000

One side at a time:

```bash
npm run dev:client
npm run dev:server
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

- `client/` — Vite, React, TypeScript, Tailwind, and Zustand (installed, not used by a screen yet)
- `server/` — Express, Mongoose, CORS, and dotenv. `jsonwebtoken`, `bcrypt`, and `zod` are installed for later issues and are not wired up yet

Sign-in, `/login`, `/week`, `/health`, and Mongoose models are not in this scaffold.
