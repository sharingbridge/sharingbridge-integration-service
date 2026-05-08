# sharebridge-integration-service

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

For overall project context, see the [main ShareBridge repository](https://github.com/sharebridge/sharebridge).

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

- `POST http://localhost:8080/v1/donor-setup/suggest-vendors`
- `POST http://localhost:8080/v1/donor-setup/preferences` (save donor presets)
- `GET  http://localhost:8080/v1/donor-setup/preferences` (fetch presets)
- `GET  http://localhost:8080/health`

The HTTP server is exposed as a factory (`createIntegrationServer`) in
`src/server.js`. Tests boot the same factory against a temp-directory
`PreferencesStore` to exercise full save+fetch roundtrips and dedupe
behavior; see `test/preferencesRoundtrip.test.js`.

### Auth context (MVP placeholder)

Preferences endpoints derive `user_id` from request headers (no real auth
yet — see `src/authContext.js`):

- `Authorization: Bearer demo.<user_id>` (preferred)
- `X-User-Id: <user_id>` (fallback)

If both header and request body/query carry a `user_id` they must match,
otherwise the server returns `403 user_id_mismatch`. Without any auth
context the endpoints return `401 missing_auth_context`. Body/query
`user_id` still works for legacy callers until the user-service ships.

### Preferences backend selection

- `PREFERENCES_BACKEND=local` (default) — file-backed `PreferencesStore`.
- `PREFERENCES_BACKEND=user_service` (placeholder) — requires
  `USER_SERVICE_BASE_URL`; not yet implemented. See
  `sharebridge/development/USER_SERVICE_PREFERENCES_MIGRATION.md` for the
  planned migration.

## Contributing

See the [main repository's CALL_FOR_CONTRIBUTORS.md](https://github.com/sharebridge/sharebridge/blob/main/development/CALL_FOR_CONTRIBUTORS.md) for:
- How to contribute (technical and non-technical)
- Joining GitHub Discussions
- Submitting prompts and feature ideas

Contract reference for current donor setup search flow:
- https://github.com/sharebridge/sharebridge/blob/main/design/contracts/donor_setup_suggest_vendors.openapi.yaml

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Part of the [ShareBridge](https://github.com/sharebridge/sharebridge) ecosystem
