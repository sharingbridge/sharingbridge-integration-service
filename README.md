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

## AI-Powered Development

This project uses AI-assisted development. Code and documentation are generated through prompts stored in the /prompting folder.

## Prompting Folder

The prompting/ folder contains:
- All prompts used to generate code for this component
- Feature requests and requirements in natural language
- AI model instructions and specifications
- Prompt templates for future development

**Transparency:** Anyone can see how features were specified and generated.  
**Reproducibility:** Use similar prompts to regenerate or modify components.  
**Collaboration:** Non-coders can contribute by writing or refining prompts.

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
- `GET  http://localhost:8080/v1/donor-setup/preferences?user_id=<id>` (fetch presets)
- `GET  http://localhost:8080/health`

The HTTP server is exposed as a factory (`createIntegrationServer`) in
`src/server.js`. Tests boot the same factory against a temp-directory
`PreferencesStore` to exercise full save+fetch roundtrips and dedupe
behavior; see `test/preferencesRoundtrip.test.js`.

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
