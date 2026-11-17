# Private demo account

Copy this file to `docs/demo-credentials.md` (gitignored) and fill in the
password. Do not put the password in the public README.

Email: demo@calendaction.app
Password: <choose a password>
Timezone: America/New_York

Then, from `my-app/backend/`:

```bash
# DEMO_PASSWORD and MONGODB_URI can live in my-app/backend/.env
npm run seed
```

The seed writes the filled-in credentials back to `docs/demo-credentials.md`.
