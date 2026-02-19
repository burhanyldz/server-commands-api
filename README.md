# Server Commands API

Standalone API for command execution workflows with isolated auth and DB collections.

## Stack

- Node.js
- TypeScript
- Express
- MongoDB (Mongoose)
- JWT auth

## Main collections

- `sc_users`
- `sc_directories`
- `sc_commands`
- `sc_chain_templates`
- `sc_command_runs`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example`.
3. Start in dev mode:
   ```bash
   npm run dev
   ```

## Initial admin creation

Use one-time bootstrap endpoint before any users exist:

```bash
curl -X POST http://localhost:5100/api/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: <BOOTSTRAP_TOKEN>" \
  -d '{"email":"admin@example.com","password":"change-me-strong"}'
```

## Main endpoints

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST|PUT|DELETE /api/directories`
- `GET|POST|PUT|DELETE /api/commands`
- `GET|POST|PUT|DELETE /api/chain-templates`
- `GET|POST|DELETE /api/command-runs`
- `POST /api/command-runs/:id/retry`
