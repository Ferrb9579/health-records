# Distributed Health Records Demo

This project demonstrates a simple distributed system using Docker containers:

- Multiple frontend replicas (Vite + React + TypeScript)
- Multiple backend replicas (Express + PostgreSQL)
- A single load balancer (Nginx) that routes and balances traffic
- PostgreSQL as the persistent data store

## Pages and Features

The frontend now includes five pages:

1. `Dashboard` - Summary cards and recent visit feed.
2. `Patients` - Searchable patient directory, create patient form, and detail panel.
3. `Visits` - Filterable visit records and new visit form.
4. `Analytics` - Diagnosis distribution and daily visit trend charts.
5. `System` - API replica status, DB/API uptime, and live health information.

New backend capabilities include:

- Patient management (`GET/POST /api/patients`, `GET /api/patients/:id`)
- Summary endpoint (`GET /api/summary`)
- Visit filtering (`GET /api/records` query params)
- Analytics endpoints (`GET /api/analytics/*`)
- System metrics endpoint (`GET /api/system/status`)

## Architecture

- `loadbalancer` routes:
  - `/` -> `frontend` service replicas
  - `/api/*` -> `backend` service replicas
- `backend` stores and reads health records from PostgreSQL
- `postgres` keeps data in a persistent Docker volume

## Run

From repository root:

```bash
docker compose up --build --scale frontend=2 --scale backend=3
```

Open:

- App: http://localhost
- Load balancer health endpoint: http://localhost/lb-health

## Demonstrate Load Balancing / Failover

1. Watch backend replica assignment in the UI fields:
   - `API Replica`
   - `Load Balancer Upstream`
2. Stop one backend container:

```bash
docker stop health-records-backend-1
```

3. Keep refreshing and adding records; requests continue through remaining replicas.
4. Stop one frontend container and refresh the browser; app should remain available:

```bash
docker stop health-records-frontend-1
```

To list containers with generated names:

```bash
docker compose ps
```

Then stop a specific replica:

```bash
docker stop <container_name>
```

## API

- `GET /api/health`
- `GET /api/system/status`
- `GET /api/summary`
- `GET /api/patients`
- `GET /api/patients/:id`
- `POST /api/patients`
- `GET /api/records`
- `POST /api/records`
- `GET /api/analytics/diagnoses`
- `GET /api/analytics/visits-by-day`

Example payload:

```json
{
  "patientName": "Maya Patel",
  "diagnosis": "Stage-1 Hypertension",
  "lastVisit": "2026-04-10"
}
```
