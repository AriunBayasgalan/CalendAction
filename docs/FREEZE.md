# Feature freeze

After **20 November 2026**, only bugfix pull requests may land on `main`.

That means:

- No new features, refactors, or "nice to have" polish unless it fixes a bug
  that blocks the demo or production use.
- Bugfix PRs should say what broke and how the change fixes it.
- The demo script (CA-34) and production URL in the README stay as the
  official walkthrough until the freeze lifts.

Checklist before calling the freeze done:

- [ ] Latest `main` is deployed to the production web and API URLs
- [ ] `GET /health` on the API returns 200
- [ ] The demo seed has been run on the production database
- [ ] Signing in with the private demo credentials loads the demo week
- [ ] README production URL and freeze date are current
