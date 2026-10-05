# Brundlefly website

The site uses Nuxt, Nuxt UI, and the canonical brand artwork.
The browser-local demos show small parts of the three skill workflows.
They do not run an agent or send input to a model.

## Develop

```sh
cd website
pnpm install
pnpm dev
```

## Check

```sh
pnpm check
```

Nuxt generates static HTML, browser scripts, and self-hosted fonts.
The Cloudflare Vite plugin packages that output as an assets-only Worker.
The empty client entry satisfies Vite's build requirement. Nuxt supplies the actual browser application.

## Preview Cloudflare

After building, run:

```sh
pnpm preview:cloudflare
```

## Deployment

The Website workflow is the production deployment path.
It deploys the brundlefly Worker when website, brand artwork, or Skill changes reach main.
Configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID as repository Actions secrets.
Give the token Workers Scripts Write and Account Settings Read for the intended account.
Give it Workers Routes Write and Zone Read for the brundlefly.dev zone.
The custom domain is brundlefly.dev in cloudflare.config.ts.
Pull requests run checks. Main builds deploy after those checks pass.
Deployment runs finish before another main build starts.
The workflow checks live pages, browser scripts, scene artwork, models, and Skill downloads against the build.

To rerun the current main deployment, use the Website workflow's manual dispatch.
To check an existing build against a host, run:

```sh
node scripts/verify-deployment.ts https://brundlefly.dev
```

## Brand and copy

Edit canonical artwork in the root assets/brand directory.
The sync script copies the banner and avatar before development and builds.
DESIGN.md owns website tokens. COPY.md owns website strings.
Root GLOSSARY.md, VISION.md, and brand rules remain authoritative.

Nuxt's [static export](https://nuxt.com/docs/4.x/getting-started/deployment) feeds
Cloudflare's [Vite asset packaging](https://developers.cloudflare.com/cf/projects/cloudflare-config/).

The build also creates ZIP downloads with each complete skill directory and its license.
Visitors can download the skills without GitHub access.

The [brand kit](../docs/brand/kit.md) lists all artwork and defines the task-first workspace.
The [generation prompts](../assets/prompts/brand-kit.json) record references and exact prompts for the three new artifacts.
The sync script also copies these materials into the static site.

## Modular brand kit

Run pnpm kit:dev for the standalone kit app.
Visit /brand-kit/ in the combined build. Compose layouts, import presets, and copy working Vue.
Download the complete [Nuxt layer](layers/brand/README.md), including artwork and 3D source.
The tool app extends the same layer.
[Modular generation prompts](../assets/prompts/modular-kit.json) record the new design and parts.

The build uses explicit Vite packaging and validates cf deploy --prebuilt --dry-run.
The production workflow uses cf deploy --prebuilt for the same build output.
