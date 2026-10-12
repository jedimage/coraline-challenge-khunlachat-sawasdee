# Backend service 1

A minimal Go HTTP service listening on port 3000.

- `GET /` returns `Hello, World!`.
- `GET /health` returns HTTP 200 with `{"status":"ok"}`.

From this directory, run locally with Go 1.23 or newer:

```sh
go run .
```

Or build and run with Docker Compose:

```sh
docker compose up --build -d
curl http://localhost:3000/
curl http://localhost:3000/health
docker compose ps
```

Compose maps host port 3000 to container port 3000. Configure health checks
in Google Cloud Run using the `/health` endpoint on port 3000.

To stop the container:

```sh
docker compose down
```
