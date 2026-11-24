# Falvenco

A community website for professionals: ask questions, get answers from people who know the subject, and share work.
Built with Next.js, Prisma 7 + SQLite (PostgreSQL planned), Better Auth.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

Needs a `.env` file (database address, auth secret, email settings). It is never committed.

## Useful commands

| Command | What it does |
|---|---|
| `npm run build` / `npm run lint` | check the project before every release |
| `npm run db:seed` | fill a local database with sample data |
| `npm run staff`, `review`, `mods`, `appeals` | admin tools from the terminal |
| `npm run news:collect` | collect news articles |
| `npm run check:i18n` | check that every language file has all texts |
| `npm run test:ads`, `test:<name>` | run the tests in `scripts/` |

## Folders

- `src/app` pages and routes: `(site)` public site, `admin` panel, `api` endpoints
- `src/components` page parts, `src/lib` the rules and database code, `src/config` all adjustable numbers
- `src/i18n` languages (en, zh, hi, es, fr, ar)
- `prisma` database design and migrations, `scripts` admin tools and tests
- `storage/` uploaded files (never committed)
