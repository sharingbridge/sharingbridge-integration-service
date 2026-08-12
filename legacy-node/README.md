# Legacy Node integration-service

Node.js MVP currently serving production on Render (`runtime: node` via repo-root `render.yaml`).

Keep this tree until the Spring Boot cutover at the repo root is complete. Use it for rollback or to compare behavior while porting `/v1` routes.

```bash
cd legacy-node
npm install
npm test
npm start
```

Copy repo-root `.env.example` to `.env` (or set the same keys); Node loads `.env` via dotenv on `npm start`.
