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

**Technology Stack:** Node.js 20 HTTP (MVP). NestJS is a scale target only.

For overall project context, see the [main SharingBridge repository](https://github.com/sharingbridge/sharingbridge).

## Status

**Shipped:** Donor setup, instruction-pack, order intents, seeker demands, marketplace (Actions board), connections API, device tokens, connection webhook. Requires **`DATABASE_URL`** and **`USER_SERVICE_BASE_URL`** at `npm start`.

**Doc map:** [STATUS.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/STATUS.md) · [AGENT_SESSION.md](https://github.com/sharingbridge/sharingbridge/blob/main/development/AGENT_SESSION.md)

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
`src/server.js`. Tests inject temp `PreferencesStore` or `test/support/inMemoryMarketplaceStore.js`; production uses SQL stores only. Standard-offers test catalog: `test/fixtures/standardOffersCatalog.js` (mirror of `configuration/seed-standard-offers.sql`).

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
| `AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS` | suggest-vendors HTTP timeout (default `15000`) |
| `AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS` | instruction-pack HTTP timeout (default `60000`) |

Copy `.env.example` for a local three-service stack. When `AI_MOCK_FALLBACK_ENABLED=false` (production default), orchestration failures return **503** instead of mock/template text.

See `sharingbridge/testing/MANUAL_TESTING_GUIDE.md` §1d–§2j and `sharingbridge/development/AI_AS_BUILT.md`.

### Donor presets

Requires **`USER_SERVICE_BASE_URL`** — integration forwards to user-service (`donor_presets` in the database). No file-backed preset store at runtime. Marketplace + eco kitchen SQL **M1–M5**: [database-setup-sequence.md](https://github.com/sharingbridge/sharingbridge/blob/main/configuration/database-setup-sequence.md).

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
