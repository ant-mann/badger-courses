# Badger Courses – web

The Next.js front-end for **[badgercourses.dev](https://badgercourses.dev/)** — a web app for UW–Madison students to search courses, check seat availability, view historical grade data, and build conflict-free schedules for the current term.

## Local development

```bash
# From the repo root
pnpm install

# Start the dev server (runs on http://localhost:3000)
cd web
pnpm dev
```

The app reads course and Madgrades data from Postgres. Set the connection string (or put it in a `.env.local` file in this directory) before starting the dev server:

```env
SUPABASE_DATABASE_URL=postgresql://...
```

Any Postgres works. To run against a local one, start it and load it from the SQLite files built by the root pipeline:

```bash
docker run -d --name badger-pg -e POSTGRES_PASSWORD=pw -p 54329:5432 postgres:17
export SUPABASE_DATABASE_URL='postgres://postgres:pw@localhost:54329/postgres'
pnpm run publish:course-db:postgres && pnpm run publish:madgrades-db:postgres   # from the repo root
```

## Deployment

The app is deployed on [Fly.io](https://fly.io/) using `web/Dockerfile`. See the root [`README.md`](../README.md#deployment) for full deployment instructions.
