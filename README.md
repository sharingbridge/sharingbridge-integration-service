# sharingbridge-integration-service

> Vendor integrations (Swiggy, Zomato, Uber Eats)

## Overview

This repository contains the **Integration Service** - handles all third-party vendor integrations for food delivery and payments.

**Key Responsibilities:**
- 🍽️ Food delivery platform integrations (Swiggy, Zomato, Uber Eats) via deep links and secure data sharing
- 🔄 Unified vendor API abstraction layer (fallback for future API access)
- 💳 Payment redirect to vendor platforms (zero payment liability)
- 📍 Restaurant/vendor search by location
- 📋 Menu retrieval and item selection
- 🚚 Order placement via deep links with secure beneficiary identification
- 📊 Delivery tracking via secure link endpoints and vendor webhooks
- 🔁 Fallback logic if primary vendor fails
- 🏪 Direct vendor program integration (MVP approach)
- 🔒 Privacy-compliant beneficiary data sharing (time-limited secure links with role-scoped token access, audit logging, and expiry controls)

**Technology Stack:** Node.js with NestJS for API orchestration and webhook handling

For overall project context, see the [main SharingBridge repository](https://github.com/sharingbridge/sharingbridge).

## Status

**Shipped:** Donor setup, instruction-pack, order intents (`POST/GET /v1/donor-seeker/order-intents`). **Doc map:** [AGENT_HANDOFF.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/AGENT_HANDOFF.md) § Documentation map.

## Getting Started

```bash
npm install
npm test
npm start
```

Copy `.env.example` to `.env` for local overrides (loaded automatically on `npm start` via dotenv).

## Deploy (Render)

Deploy **after** user-service and ai-orchestration. [configuration/backend-render.md](https://github.com/sharingbridge/sharingbridge/blob/main/configuration/backend-render.md). Blueprint: `render.yaml`.

Local endpoints:

- `POST http://localhost:8080/v1/donor-setup/suggest-vendors` (mock or AI orchestration when enabled)
- `POST http://localhost:8080/v1/donor-seeker/instruction-pack` (delivery instruction narrative)
- `POST http://localhost:8080/v1/donor-seeker/order-intents` (register or update order intent when donor copies instructions)
- `GET  http://localhost:8080/v1/donor-seeker/order-intents` (list donation intents for signed-in donor; newest first)

**Browser clients:** set `WEB_CORS_ORIGINS` (comma-separated) or `*` for local dev so `sharingbridge-web-app` can call the API.
- `POST http://localhost:8080/v1/donor-setup/preferences` (save donor presets)
- `GET  http://localhost:8080/v1/donor-setup/preferences` (fetch presets)
- `DELETE http://localhost:8080/v1/donor-setup/preferences?user_id=…` (clear all; `user_id` optional when bearer identifies user)
- `POST http://localhost:8080/v1/donor-setup/preferences/delete-item` (remove one preset by `restaurant_name` + `order_url`)
- `GET  http://localhost:8080/health`

The HTTP server is exposed as a factory (`createIntegrationServer`) in
`src/server.js`. Tests boot the same factory against a temp-directory
`PreferencesStore` to exercise full save+fetch roundtrips and dedupe
behavior; see `test/preferencesRoundtrip.test.js`.

### Auth context

Preferences and suggest flows use **signed JWT bearer tokens** (HS256) minted by
`sharingbridge-user-service` (Google Sign-In or locally signed JWT). See `src/authContext.js` and
`sharingbridge/design/contracts/donor_setup_preferences.openapi.yaml` for the contract.

### AI orchestration bridge (`sharingbridge-ai-orchestration`)

When `AI_ORCHESTRATION_BASE_URL` is set and feature flags are on, integration-service calls the orchestration service instead of fixed mocks:

| Env | Purpose |
|-----|---------|
| `AI_ORCHESTRATION_BASE_URL` | e.g. `http://localhost:8091` |
| `AI_SUGGEST_VENDORS_ENABLED` | `true` → query-ranked suggestions from orchestration |
| `AI_INSTRUCTION_PACK_ENABLED` | `true` → instruction-pack from orchestration |
| `AI_ORCHESTRATION_INTERNAL_API_KEY` | optional static service key (`X-Internal-Api-Key`) |
| `AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS` | suggest-vendors HTTP timeout (default `15000`; legacy alias `AI_ORCHESTRATION_TIMEOUT_MS`) |
| `AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS` | instruction-pack HTTP timeout (default `60000`) |

Copy `.env.example` for a local three-service stack. On orchestration failure, suggest-vendors falls back to the fixed mock list; instruction-pack falls back to a server-side template.

See `sharingbridge/testing/MANUAL_TESTING_GUIDE.md` §1d–§2j and `sharingbridge/development/AI_PLATFORM_INTEGRATION.md`.

### Donor presets

Requires **`USER_SERVICE_BASE_URL`** — integration forwards to user-service (`donor_presets` in Postgres). No file-backed preset store at runtime. One-off JSON import: `npm run backfill:user-service-presets` (see `USER_SERVICE_PREFERENCES_MIGRATION.md`).

## Contributing

See the [main repository's CALL_FOR_CONTRIBUTORS.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/CALL_FOR_CONTRIBUTORS.md) for:
- How to contribute (technical and non-technical)
- Joining GitHub Discussions
- Submitting prompts and feature ideas

Contract references (main `sharingbridge` repo):

- [Suggest vendors](https://github.com/sharingbridge/sharingbridge/blob/main/design/contracts/donor_setup_suggest_vendors.openapi.yaml)
- [Integration preferences](https://github.com/sharingbridge/sharingbridge/blob/main/design/contracts/donor_setup_preferences.openapi.yaml)
- [User-service donor presets](https://github.com/sharingbridge/sharingbridge/blob/main/design/contracts/user_service_donor_presets.openapi.yaml)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Part of the [SharingBridge](https://github.com/sharingbridge/sharingbridge) ecosystem
