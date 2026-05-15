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

## Repository Status

🚧 **Status:** Initial Setup  
📅 **Date:** January 9, 2026

## Getting Started

```bash
npm install
npm test
npm start
```

Local endpoints:

- `POST http://localhost:8080/v1/donor-setup/suggest-vendors` (mock or AI orchestration when enabled)
- `POST http://localhost:8080/v1/donor-seeker/instruction-pack` (delivery instruction narrative)
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
`sharingbridge-user-service` (`POST /v1/auth/token`). See `src/authContext.js` and
`sharingbridge/design/contracts/donor_setup_preferences.openapi.yaml` for the contract.

### AI orchestration bridge (`sharingbridge-ai-orchestration`)

When `AI_ORCHESTRATION_BASE_URL` is set and feature flags are on, integration-service calls the orchestration service instead of fixed mocks:

| Env | Purpose |
|-----|---------|
| `AI_ORCHESTRATION_BASE_URL` | e.g. `http://localhost:8091` |
| `AI_SUGGEST_VENDORS_ENABLED` | `true` → query-ranked suggestions from orchestration |
| `AI_INSTRUCTION_PACK_ENABLED` | `true` → instruction-pack from orchestration |
| `AI_ORCHESTRATION_INTERNAL_TOKEN` | optional shared secret (`X-Internal-Token`) |

Copy `.env.example` for a local three-service stack. On orchestration failure, suggest-vendors falls back to the fixed mock list; instruction-pack falls back to a server-side template.

See `sharingbridge/testing/MANUAL_TESTING_GUIDE.md` §1d–§2j and `sharingbridge/development/AI_PLATFORM_INTEGRATION.md`.

### Preferences backend selection

- `PREFERENCES_BACKEND=local` (default) — file-backed `PreferencesStore`.
- `PREFERENCES_BACKEND=user_service` — requires `USER_SERVICE_BASE_URL`; forwards to
  user-service `GET/PUT /v1/users/{id}/donor-presets` and `POST …/delete-item`.
  See `sharingbridge/development/USER_SERVICE_PREFERENCES_MIGRATION.md`.

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
