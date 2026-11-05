# Ghostfolio — Podman Setup Guide (Windows / EPAM)

Ghostfolio publishes an official image on Docker Hub (`ghostfolio/ghostfolio:latest`).
This guide uses that pre-built image via `docker/docker-compose.yml` — no Node.js build step required.

---

## Daily Start / Stop

Once the one-time setup below is complete, these are the only commands you need every day.

### Start

```powershell
podman machine start
podman compose -f docker/docker-compose.yml up -d
```

Open **http://localhost:3333** in your browser.

### Stop

```powershell
podman compose -f docker/docker-compose.yml down
podman machine stop
```

### Check status

```powershell
podman ps
```

All three containers should show `(healthy)`:

```
NAMES        STATUS                    PORTS
gf-redis     Up N seconds (healthy)    6379/tcp
gf-postgres  Up N seconds (healthy)    5432/tcp
ghostfolio   Up N seconds (healthy)    0.0.0.0:3333->3333/tcp
```

### View logs

```powershell
podman logs ghostfolio    # app logs (migrations, errors)
podman logs gf-postgres   # database logs
podman logs gf-redis      # cache logs
```

---

## One-Time Setup

Follow these steps once on a new machine.

### Step 1 — Install WSL 2 (run as Administrator)

Open PowerShell **as Administrator** and run:

```powershell
wsl --install --no-distribution
```

Reboot if prompted. WSL 2 is the Linux kernel layer Podman runs on top of.

### Step 2 — Install Podman CLI

```powershell
winget install RedHat.Podman
```

After install, **close and reopen your terminal**, then verify:

```powershell
podman --version    # should print: podman version 5.x.x
```

> **Note:** Podman Desktop (the GUI app) and the Podman CLI are separate installs.
> The CLI is what actually runs containers — install it with `winget` as above.

### Step 3 — Initialize and start the Podman Machine

This creates a small WSL 2-backed Linux VM (done once):

```powershell
podman machine init
podman machine start
```

### Step 4 — Configure the environment file

From the repo root, the `.env` file is already created with the correct values.
If you ever need to recreate it from scratch, copy `.env.example` to `.env` and fill in these four values:

| Variable            | What it is                                                                 | Example                 |
| ------------------- | -------------------------------------------------------------------------- | ----------------------- |
| `REDIS_PASSWORD`    | Password you set on Redis                                                  | `ghostfolio-redis-2024` |
| `POSTGRES_PASSWORD` | Password you set on PostgreSQL                                             | `ghostfolio-pg-2024`    |
| `ACCESS_TOKEN_SALT` | Random string for hashing access tokens — **never change after first run** | 40-char random string   |
| `JWT_SECRET_KEY`    | Random string for signing JWT sessions — **never change after first run**  | 40-char random string   |

Generate random strings in PowerShell:

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
```

Run it twice — once for each secret.

Leave `REDIS_HOST`, `POSTGRES_USER`, `POSTGRES_DB`, and `DATABASE_URL` at their defaults — they are pre-wired for the compose network.

### Step 5 — Pull images and start the stack

```powershell
podman compose -f docker/docker-compose.yml up -d
```

This pulls three images on first run (~500 MB total) and starts:

- `ghostfolio` — the app (auto-runs DB migrations + seed on first start)
- `gf-postgres` — PostgreSQL 15
- `gf-redis` — Redis

Wait ~30 seconds, then verify all three are healthy:

```powershell
podman ps
```

### Step 6 — Create the first admin user

Open **http://localhost:3333** and click **Get Started**.
The first user registered automatically receives the `ADMIN` role.

---

## Troubleshooting

### `podman` not recognised after install

The PATH hasn't refreshed in the current terminal. Open a new terminal window, or add it to the current session:

```powershell
$env:PATH = "C:\Program Files\RedHat\Podman;" + $env:PATH
```

### `podman machine start` fails after a Windows update

WSL 2 kernel may need updating:

```powershell
wsl --update
```

### App container exits immediately / shows `(starting)` for a long time

Check the app logs — it usually means DB migration failed:

```powershell
podman logs ghostfolio
```

If you see an authentication error, the Postgres volume credentials may be stale. Reset everything:

```powershell
podman compose -f docker/docker-compose.yml down -v   # -v removes volumes too
podman compose -f docker/docker-compose.yml up -d
```

### Port 3333, 5432 or 6379 already in use

Find and stop the conflicting process, or add port overrides to `.env`:

```
POSTGRES_PORT=5433
REDIS_PORT=6380
```

Then update `DATABASE_URL` in `.env` to use the new Postgres port, and restart the stack.

### Health check — confirm the API is responding

```powershell
Invoke-RestMethod -Uri "http://localhost:3333/api/v1/health"
# Expected: @{status=OK}
```
