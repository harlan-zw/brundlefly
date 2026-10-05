# Dialogue Worker

The Worker serves the static scene and two same-origin APIs.
`GET /api/visit` assigns an anonymous session's daily ordinal and seeded greeting.
`POST /api/dialogue` sends bounded history and text to GPT-6 Luna through AI Gateway.

The configuration declares `AI`, `DIALOGUE_DB`, and `ASSETS` bindings.
The build extracts the canonical prompt from `docs/brand/mascot-dialogue.md` into a server-only module.
The Gateway ID is `brundlefly`. Unified Billing must have credits for the frontier model.

Run `pnpm build`, then `pnpm preview:cloudflare` to exercise the exported site and real AI binding.
The preview initializes a local D1 store. Local visitor counts never enter the production database.
The Nuxt development server alone does not supply the dialogue APIs.

For a new database, apply `schema.sql` with the Cloudflare D1 query command before deploying.
Use the existing GitHub Actions workflow for production deployment.

The server rejects cross-site origins and unrecognized history roles.
It accepts 1,000 input characters, eight history messages, and a 16 KB request body.
Atomic quota reservations limit daily requests and rapid repeat submissions.
Gateway logs omit raw dialogue. D1 stores anonymous ordinals and quota records.
Each visit removes records older than the previous seven UTC dates. Idle deployments retain metadata until another visit.
Only speech drives the voice. Movement cues remain silent.
