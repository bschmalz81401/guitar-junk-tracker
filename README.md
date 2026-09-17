# Guitar Junk Tracker

A self-hosted web app for cataloging your guitar gear — guitars, amps,
cabinets, pedals, multi-FX, and anything else — with full specs, photos,
ownership history, and mod logs. Runs as a single Docker container. Your data
stays on your machine.

- **Multi-category catalog** with per-category spec sheets (guitars, amps,
  cabs, pedals, multi-FX, other).
- **Photos** per item — upload files or paste an image URL.
- **Spec auto-fill** — paste a product-page spec sheet or feature list and it
  fills the form.
- **Compare** items side-by-side within a category.
- **Ownership & mods** — acquisition details, price, serial, and a dated
  mod-history log.
- **Multi-user** with optional public catalogs at `/{username}`; price and
  serial stay private by default.
- **First-run setup wizard** — create your admin account in the browser; no
  config files to edit.
- **Optional WebGL background effect** with a one-click toggle.

Built with Next.js, Prisma, and SQLite — no external database or cloud
services required.

## Quick start (Docker)

```bash
git clone https://github.com/bschmalz81401/guitar-junk-tracker.git
cd guitar-junk-tracker
docker compose up -d --build
```

Then open **http://localhost:3131** in your browser.

On first run the app has no accounts, so it shows a **setup wizard** — create
your administrator account (email, username, password) and you're in. That's
the only setup step; there are no admin passwords to put in a config file.

Your database and photos are stored in `./data` next to the compose file
(bind-mounted into the container), so they survive rebuilds and updates. The
entrypoint creates `/data` and `/data/photos` inside the container on start if
they are missing — you do not need to create them by hand.

### Stopping / updating

```bash
docker compose down                        # stop (data is kept in ./data)
git pull && docker compose up -d --build   # update to a newer version
```

Database migrations run automatically on start.

## Configuration

Docker compose sets working defaults. Set these in the `environment:` block
of `docker-compose.yml` (or a `.env` file). Password-reset emails also need
`APP_PUBLIC_ORIGIN`; compose sets it to `http://localhost:3131`. Local
`npm run dev` should set `APP_PUBLIC_ORIGIN=http://localhost:3000`.

| Variable            | Default                        | Purpose                                                        |
| ------------------- | ------------------------------- | -------------------------------------------------------------- |
| `PORT`              | `3131`                          | Port the app listens on (match the `ports:` mapping).          |
| `DATABASE_URL`      | `file:/data/guitar-tracker.db` | SQLite database file location.                                 |
| `PHOTOS_DIR`        | `/data/photos`                 | Where uploaded photos are written.                             |
| `APP_PUBLIC_ORIGIN` | `http://localhost:3131` in Docker | Public origin used in password-reset emails. Origin only (no path). Change this to the URL you actually open. |
| `COOKIE_SECURE`     | unset                           | Set to `1` when serving over HTTPS so session cookies are secure-only. |
| `SHOWCASE_EMAIL`    | unset                           | Email of the user whose collection appears on the guest landing page (defaults to the first admin). |

Email (for password resets) is optional and configured **in the app** under
Admin → Settings (SMTP host/port/credentials). Reset links are built from
`APP_PUBLIC_ORIGIN` only — never from the incoming request or `X-Forwarded-*`
headers. If SMTP is configured but `APP_PUBLIC_ORIGIN` is missing or invalid,
password reset returns an error instead of sending a link.

For local development (`npm run dev`), set `APP_PUBLIC_ORIGIN=http://localhost:3000`
in `.env` (see `.env.example`).

### Accounts

The setup wizard creates the first **admin**. From Admin → Settings you can
enable public sign-up, or add users yourself. Any user can make their own
catalog public at `/{username}`; private fields (price, serial number) are
never shown on public catalogs.

## Data & backups

Everything lives in `./data`:

- `guitar-tracker.db` — the SQLite database
- `photos/` — uploaded images

To back up, copy that folder (ideally with the container stopped for a
consistent snapshot). A helper script is included:

```bash
./scripts/backup.sh
```

## Running without Docker (development)

Requires Node.js 22+.

```bash
npm install
npx prisma migrate deploy      # create the database
npx prisma generate
npm run dev                    # http://localhost:3000
```

First visit → setup wizard, same as the Docker flow.

Useful scripts:

```bash
npm run lint       # eslint
npm test           # unit tests (parser, privacy, categories, CSV, rate limits, password reset, outbound fetch)
npm run build      # production build
npm run gate       # lint + test + build
```

## Deploying a prebuilt image

Some hosts (e.g. NAS appliances) can't reliably `docker compose build`
on-device. Build the image elsewhere and ship it over SSH:

```bash
LOAD_HOST=user@your-server ./scripts/build-image.sh guitar-junk-tracker:prod
```

Then use `docker-compose.prod.yml` on the host (it references the prebuilt
image instead of building).

## Network exposure

By default the container publishes its port on all interfaces, so it's
reachable from other devices on your LAN. There's no protection against the
public internet beyond your own network — don't port-forward it without a
reverse proxy and HTTPS in front. See [docs/SECURITY.md](docs/SECURITY.md) for
the session/cookie/CSRF model and hardening notes.

## Tech stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Prisma** with the `better-sqlite3` driver adapter (file-based SQLite)
- Photos served through an API route from the mounted volume — never baked
  into the image

## Credits

The optional background effect is a WebGL fluid simulation based on Pavel
Dobryakov's [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
(MIT). See `src/lib/fluid/fluidSim.ts`.

## License

MIT — see [LICENSE](LICENSE).
