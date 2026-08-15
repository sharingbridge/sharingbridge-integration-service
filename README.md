# sharingbridge-integration-service

> Experience API / BFF — **Spring Boot 3 / Java 21**

## Status

**Current runtime:** Spring Boot (Docker on Render).

| Runtime | How to run |
|---------|------------|
| Spring | JDK 21 + Maven: `mvn test` then `mvn spring-boot:run` |

Spring does **not** load `.env` automatically — export vars from `.env.example` into the shell before `spring-boot:run`.

Health: `GET http://localhost:8080/health`

**Doc map:** [STATUS.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/STATUS.md) · [AGENT_SESSION.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/AGENT_SESSION.md) · [backend-render.md](https://github.com/sharingbridge/sharingbridge/blob/main/configuration/backend-render.md)

## Environment

See [environment-variables.md](https://github.com/sharingbridge/sharingbridge/blob/main/configuration/environment-variables.md) and `.env.example`.

Shared DB knobs (same names as user-service): `DB_POOL_*`, `DB_RETRY_*`, `DB_SUPABASE_POOL_6543_4TR_5432_4SESN` (`5432` session \| `6543` transaction). Prefer session pooler for this long-lived process. **`GIS_SCHEMA=extensions`** is required.

## Deploy (Render)

`runtime: docker` — see `Dockerfile` and `render.yaml`. Clear leftover Node build/start commands. Dashboard: **Settings → Build → Source → Edit** → **Docker**, empty Build/Start, health `/health`.

## Contributing

See [CALL_FOR_CONTRIBUTORS.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/CALL_FOR_CONTRIBUTORS.md).

Part of [SharingBridge](https://github.com/sharingbridge/sharingbridge).
