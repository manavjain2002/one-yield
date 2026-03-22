# Railway “frontend” root directory

If Railway’s **Root Directory** for the frontend service is `frontend`, this folder must exist (otherwise the build fails with “Could not find root directory: frontend”).

**Preferred:** In Railway → frontend service → Settings → Source, set **Root Directory** to empty (repository root). The Vite app lives at the repo root next to the root `Dockerfile`.

This directory only holds `railway.toml` so a misconfigured `frontend` root can still build using [`/Dockerfile`](../Dockerfile) from the repository root.
