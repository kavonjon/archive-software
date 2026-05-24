# archive software

This software is under development. Please use it at your own risk, as there is no warranty or guarantee that this software will work.

Backup your data! By using this software, you take full responsibility for any data loss that may occur.

## Local development

```bash
# Terminal 1: Backend + Celery
./dev.sh

# Terminal 2: Frontend (hot reload)
cd frontend && npm start
```

Frontend: http://localhost:3000 — Backend: http://localhost:8000

## Production deployment (TrueNAS Scale)

Production runs on **TrueNAS Scale 25** as a custom App using [`docker-compose.private.yml`](docker-compose.private.yml). The private server is live with real data — all changes must be backward compatible.

Deploy scripts do **not** build the React frontend. You must build locally and commit the output before pushing.

### 1. Build React on your dev machine

```bash
cd frontend
npm run build:django
```

This sets `PUBLIC_URL=/static/frontend` (required for production asset paths) and copies the build into `app/static-files/frontend/`.

Commit both your React source changes **and** the updated files under `app/static-files/frontend/` (hashed JS/CSS bundles included).

### 2. Push to `main`

### 3. Update on the TrueNAS server

SSH to the server, then:

```bash
cd ~/archive-software   # or your clone path
./deploy-update-private.sh web
```

Update types:

| Command | Use when |
|---------|----------|
| `./deploy-update-private.sh web` | Django or React code changes (most common) |
| `./deploy-update-private.sh all` | Dockerfile, nginx, Celery, or Python dependency changes |

The script pulls from git, rebuilds Docker images, and retags them for TrueNAS. It does not restart the app or touch the database volume.

### 4. Restart the app in TrueNAS UI

**Apps → Archive App → Stop → Start**

On start, the container runs migrations and `collectstatic` automatically.

### Database restore

```bash
./deploy-restore-db-private.sh [dump_file.sql]
```

Defaults to `backup/initial_restore.sql`. See [docs/deployment/database-operations.md](docs/deployment/database-operations.md) for full procedures.

### Further reading

- [Database operations on TrueNAS](docs/deployment/database-operations.md)
- [URL routing (Django + React in production)](docs/deployment/url-routing.md)
