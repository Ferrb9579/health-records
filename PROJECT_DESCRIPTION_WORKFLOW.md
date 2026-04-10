# Distributed Health Records System

## 1) Project Description

This project is a containerized distributed health records demo designed to show:

- Redundancy through multiple frontend replicas and multiple backend replicas.
- Traffic distribution through a load balancer.
- Automatic failover behavior when one or more replicas go down.
- Persistent data storage in PostgreSQL.

Technology choices:

- Frontend: Vite + React + TypeScript.
- Backend: Express (Node.js).
- Database: PostgreSQL.
- Load Balancer: Nginx.
- Orchestration: Docker Compose.

The application allows users to:

- View health records.
- Add new health records.
- Observe which backend instance served a request (useful for demoing load balancing).

---

## 2) High-Level Architecture

Components:

1. `loadbalancer` (Nginx)
2. `frontend` replicas (Nginx serving built React app)
3. `backend` replicas (Express API)
4. `postgres` (persistent database)

Routing rules:

- `/` -> frontend service replicas.
- `/api/*` -> backend service replicas.

Persistence:

- PostgreSQL stores health records in a Docker volume (`postgres_data`), so data survives container restarts.

---

## 3) Workflow (How Requests Move Through the System)

### A) Frontend page load

1. User opens `http://localhost`.
2. Request first hits `loadbalancer`.
3. `loadbalancer` forwards the request to one frontend replica.
4. Frontend static files (React app) are returned to the browser.

### B) Fetching records

1. React app calls `GET /api/records`.
2. Request goes to `loadbalancer`.
3. `loadbalancer` forwards to one backend replica.
4. Backend queries PostgreSQL.
5. Records are returned to React and rendered in the table.

### C) Creating a record

1. User fills form and submits.
2. React calls `POST /api/records` with JSON payload.
3. `loadbalancer` forwards to a backend replica.
4. Backend validates payload and inserts data in PostgreSQL.
5. Backend returns created row.
6. React refreshes the records list.

---

## 4) Working of Each Service

### `frontend`

- Built using Vite and served by Nginx.
- UI shows:
  - Current API replica identifier.
  - Upstream backend address from response headers.
  - Current records list and add-record form.
- Communicates with backend only through `/api` paths.

### `backend`

- Express API with endpoints:
  - `GET /api/health`
  - `GET /api/records`
  - `POST /api/records`
- Connects to PostgreSQL using `pg`.
- Creates table `health_records` at startup if it does not exist.
- Returns response data in a frontend-friendly format.

### `postgres`

- Stores all health record data.
- Backed by a named volume for persistence.

### `loadbalancer`

- Single entry point exposed on host port `80`.
- Proxies:
  - `/` to frontend replicas.
  - `/api/` to backend replicas.
- Adds upstream headers to help demonstrate which instance served requests.

---

## 5) Fault Tolerance and Failover Behavior

The system demonstrates graceful degradation:

1. If one backend container is stopped, remaining backend replica(s) continue serving API requests.
2. If one frontend container is stopped, remaining frontend replica(s) continue serving UI.
3. Data remains safe because PostgreSQL is persistent and independent of frontend/backend container lifecycle.

Note:

- In this setup, frontend and backend are replicated manually with Compose scaling flags.
- Load balancing is done by Nginx using Docker service DNS resolution.

---

## 6) Operational Workflow (Run and Demo)

### Start the system

```bash
docker compose up --build --scale frontend=2 --scale backend=2 -d
```

### Check running containers

```bash
docker compose ps
```

### Demonstrate backend failover

```bash
docker stop health-records-backend-1
```

- Refresh the app and perform reads/writes.
- Requests continue through remaining backend replica.

### Restore backend replicas

```bash
docker compose up -d --scale backend=2
```

### Demonstrate frontend failover

```bash
docker stop health-records-frontend-1
```

- Refresh browser.
- UI continues from remaining frontend replica.

### Restore frontend replicas

```bash
docker compose up -d --scale frontend=2
```

---

## 7) Why This Is a Good Distributed Computing Demo

This project clearly shows core distributed-system concepts in a practical and visual way:

- Replication for availability.
- Load balancing for traffic distribution.
- Failover behavior under node/container failure.
- Separation of concerns across UI, API, and storage layers.
- Persistent state independent of stateless service replicas.

It is simple enough to understand quickly, but complete enough to demonstrate real distributed behavior in front of an audience.
