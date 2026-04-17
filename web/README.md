# uw-madison-courses – web

The Next.js front-end for **[uw-madison-courses.fly.dev](https://uw-madison-courses.fly.dev/)** — a web app for UW–Madison students to search courses, check seat availability, view historical grade data, and build conflict-free schedules for Fall 2026.

## Local development

```bash
# From the repo root
pnpm install

# Start the dev server (runs on http://localhost:3000)
cd web
pnpm dev
```

The app reads course and Madgrades data from [Turso](https://turso.tech/) embedded-replica databases. Set the following environment variables (or create a `.env.local` file in this directory) before starting the dev server:

```env
TURSO_COURSE_DATABASE_URL=
TURSO_COURSE_AUTH_TOKEN=
TURSO_MADGRADES_DATABASE_URL=
TURSO_MADGRADES_AUTH_TOKEN=
MADGRADES_COURSE_REPLICA_PATH=/tmp/course-replica.db
MADGRADES_MADGRADES_REPLICA_PATH=/tmp/madgrades-replica.db
```

## Deployment

The app is deployed on [Fly.io](https://fly.io/) using `web/Dockerfile`. See the root [`README.md`](../README.md#deployment) for full deployment instructions.
