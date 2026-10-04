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
It deploys the brundlefly Worker when a website change reaches main.
Configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID as repository Actions secrets.
Use a token with permission to deploy Workers in the intended account.
A custom domain belongs in cloudflare.config.ts after the owner chooses it.

## Brand and copy

Edit canonical artwork in the root assets/brand directory.
The sync script copies the banner and avatar before development and builds.
DESIGN.md owns website tokens. COPY.md owns website strings.
Root GLOSSARY.md, VISION.md, and brand rules remain authoritative.

Nuxt's [static export](https://nuxt.com/docs/4.x/getting-started/deployment) feeds
Cloudflare's [Vite asset packaging](https://developers.cloudflare.com/cf/projects/cloudflare-config/).

The build also creates ZIP downloads with each complete skill directory and its license.
Visitors can download the skills without GitHub access.

The [brand kit](../docs/brand/kit.md) lists all artwork and selects the living instrument layout.
The [generation prompts](../assets/prompts/brand-kit.json) record references and exact prompts for the three new artifacts.
The sync script also copies these materials into the static site.
