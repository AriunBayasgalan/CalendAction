# Deploying CalendAction

This is the production setup that CA-5 started (web on Vercel, API on Render)
and that CA-33 freezes. The repo cannot create hosting accounts or push a live
deploy; someone with access to those hosts has to apply the steps below.

## Current production URLs

- Web: https://calend-action.vercel.app/
- API: https://calendaction.onrender.com/
- API health: https://calendaction.onrender.com/health (should return 200)

These URLs may still be running an older build until `main` is redeployed.
After a redeploy, run the demo seed (CA-32) against the production database
so the site loads the demo account week.

## What to set on each host

### API (Render, or any Node host)

Root directory: `my-app/backend`. Build: `npm ci`. Start: `npm start`
(`node server.js`).

| Variable | Value |
| --- | --- |
| `PORT` | Set by the host, or `10000` |
| `MONGODB_URI` | Atlas connection string, including the database name (for example `...mongodb.net/calendaction?retryWrites=true&w=majority`) |
| `JWT_SECRET` | A long random string. Changing it signs everyone out. |
| `CLIENT_ORIGIN` | The production web origin, for example `https://calend-action.vercel.app`. Comma-separate more than one, including `http://localhost:5173` if you want local dev to hit this API. |
| `DEFAULT_TIMEZONE` | `America/New_York` |

Atlas must allow the host's outbound IPs (or `0.0.0.0/0` for a demo).

### Web (Vercel, or any static host)

Root directory: `my-app/frontend`. Build: `npm ci && npm run build`. Output: `dist`.
`vercel.json` in this repo rewrites every path to `index.html` so `/week` and `/login` work.

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | The production API origin, for example `https://calendaction.onrender.com` (no trailing slash). This is baked in at **build** time, so change it and rebuild, not just restart. |

## After each production deploy

1. `GET /health` on the API returns 200.
2. The web URL loads and can reach the API (try logging in).
3. If the demo week should be current, from a trusted machine:

   ```bash
   # In my-app/backend/.env, point MONGODB_URI at the production database
   # and set DEMO_PASSWORD to the password in the private demo doc.
   npm run seed
   ```

   Do not put that password in the README.

## Local reminder

On macOS, port 5000 is often taken by AirPlay Receiver. Set `PORT=5001` in
`my-app/backend/.env` and `VITE_API_URL=http://localhost:5001` in
`my-app/frontend/.env` if the API cannot bind or the page gets 403s.
