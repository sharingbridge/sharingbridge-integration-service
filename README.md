# sharingbridge-integration-service

> Vendor integrations and donor–seeker bridge — **Spring Boot rewrite in progress**

## Status

**Production runtime:** Node.js MVP under [`legacy-node/`](./legacy-node/) (Render `runtime: node`).  
**Beachhead:** Spring Boot 3.3.5 / Java 21 at the repo root (`/health`, auth/CORS/path-alias scaffolding). Business `/v1` routes are not cut over yet.

| Runtime | How to run |
|---------|------------|
| Node (production / rollback) | `cd legacy-node && npm install && npm test && npm start` |
| Spring beachhead | JDK 21 + Maven: `mvn test` then `mvn spring-boot:run` |

Spring does **not** load `.env` automatically — export vars from `.env.example` into the shell before `spring-boot:run`.

Health (either runtime): `GET http://localhost:8080/health`

**Doc map:** [STATUS.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/STATUS.md) · [AGENT_SESSION.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/AGENT_SESSION.md) · [backend-render.md](https://github.com/sharingbridge/sharingbridge/blob/main/configuration/backend-render.md)

## Environment

See [environment-variables.md](https://github.com/sharingbridge/sharingbridge/blob/main/configuration/environment-variables.md) and `.env.example`.

Shared DB knobs (same names as user-service): `DB_POOL_*`, `DB_RETRY_*`, `DB_SUPABASE_POOL_6543_4TR_5432_4SESN` (`5432` session \| `6543` transaction). Prefer session pooler for this long-lived process.

## Deploy (Render)

Still **Node** via `render.yaml` — set the **dashboard** Build/Start (blueprints do not overwrite existing services):

- Build: `npm install --prefix legacy-node`
- Start: `npm start --prefix legacy-node`
- `NODE_VERSION=20` (legacy-node `engines` is pinned to 20)

Dockerfile is present for a future Spring cutover — not wired to Render yet.

## Contributing

See [CALL_FOR_CONTRIBUTORS.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/CALL_FOR_CONTRIBUTORS.md).

Part of [SharingBridge](https://github.com/sharingbridge/sharingbridge).
