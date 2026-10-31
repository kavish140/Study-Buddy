# Study Buddy on Cloudflare Workers

This app uses TanStack Start SSR with Cloudflare's Vite plugin. The adapter builds
the browser assets and the Worker together. It is no longer a static GitHub Pages
deployment: do not upload `dist` to Pages or add an SPA `404.html` fallback.

Official deployment reference:
https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/

## Workers Builds settings

Connect `kavish140/Study-Buddy`, production branch `main`, with:

| Setting | Value |
| --- | --- |
| Worker name | `study-buddy` (must match `wrangler.jsonc`) |
| Root directory | `/` |
| Build command | `bun run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as **build variables**.
Only use the public anon/publishable key, never a service-role key. Vite embeds
these public values into the browser build; runtime-only variables cannot replace
them after building. `VITE_SITE_URL` is optional; the sitemap otherwise uses the
request origin. Set it once the production domain is chosen.

Keep `bun.lock` in sync with `package.json`. After changing dependencies, run
`bun install` and commit the updated lockfile. Keep `package-lock.json`
synchronized for npm users.

Cloudflare's plugin generates `.wrangler/deploy/config.json`, pointing Wrangler at
the built server configuration. Keep the root `main` set to
`@tanstack/react-start/server-entry` as documented; do not replace it with an
assumed output path. Use `npm run preview` to test the built Worker locally.
For a repeatable HTTP smoke check, start preview on port 4182 and run
`node scripts/check-ssr.mjs http://127.0.0.1:4182`. It checks page content without
executing browser JavaScript, plus HTTP 404, XML sitemap and static assets.

## Rendering and authentication

Public pages (`/landing`, `/login`, `/privacy`, `/terms`, `/sources`) render HTML
on the server and hydrate in the browser. `/sitemap.xml` is a real XML server route
and lists public pages only. Unknown URLs return HTTP 404.

Private tools render a loading shell while the browser restores its existing
Supabase session, then load account data using the same authenticated API and RLS
as before. This migration does not introduce server-side private account fetching
or cookie-based authentication. Do not use the module-level Supabase client for
authenticated server loaders: those need a per-request cookie-aware client.

Visible branding is Study Buddy. Existing lowercase `aceprep` browser-storage keys
remain stable so a deployment on the same origin does not discard preferences.

## Migration order

1. Push the tested SSR code and lockfiles to the connected repository.
2. Verify a successful Workers deployment and public pages on the workers.dev URL.
3. Add the chosen custom domain through the Worker's Domains settings, following
   https://developers.cloudflare.com/workers/configuration/routing/custom-domains/.
4. Update Supabase Site URL and allowed redirects before testing sign-in there.
5. Update Google branding/home/privacy/terms links. Keep the existing Supabase
   callback URI unless the Supabase authentication domain also changes.
6. Update any restricted Edge Function `ALLOWED_ORIGIN`, configure the old-site
   redirect, and test Google login, saved progress and AI requests.

The GitHub Actions workflow now validates the Workers build rather than deploying
to GitHub Pages. The already-published GitHub Pages site remains available until
hosting/domain settings are changed separately. Local edits do not deploy.
