# RogsPlace

A simple, low-cost memorial website. Visitors can read about the person being
remembered, look through photographs, read the memories other people have
shared, and add memories and photographs of their own.

This repository currently contains the **frontend only**. It runs entirely on
mock data held in `src/data/`, so the whole site can be used and reviewed before
any backend exists.

## Technology

| Concern       | Choice                                  |
| ------------- | --------------------------------------- |
| UI            | React 19                                |
| Language      | TypeScript (strict)                     |
| Build tool    | Vite 8                                  |
| Routing       | React Router 7 (`BrowserRouter`)        |
| Styling       | Plain CSS with CSS Modules              |
| Tests         | Vitest + React Testing Library          |
| Dev hosting   | GitHub Pages                            |
| Prod hosting  | Cloudflare Pages (planned)              |
| API           | Cloudflare Workers (planned)            |
| File storage  | Cloudflare R2 (planned)                 |
| Database      | None                                    |

There is no UI framework and no state management library. React state and
context are sufficient at this size.

## Requirements

- Node.js 20.19 or later (22 LTS is what CI uses)
- npm 10 or later

## Getting started

```bash
git clone https://github.com/jaslend/RogsPlace.git
cd RogsPlace
npm install
npm run dev
```

The site is then available at <http://localhost:5173/>.

### Scripts

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start the Vite development server with hot reload   |
| `npm run build`     | Type-check, then build the production site to `dist/` |
| `npm run preview`   | Serve the built `dist/` locally                     |
| `npm run typecheck` | Type-check without building                         |
| `npm test`          | Run the test suite once                             |
| `npm run test:watch`| Run the tests in watch mode                         |

## Environment variables

Vite exposes anything prefixed `VITE_` to browser code, so **only public values
belong in these files**. Copy `.env.example` to `.env.local` to set them.

| Variable                    | Purpose                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| `VITE_API_URL`              | Base URL of the backend API. Leave unset to use the local mock data  |
| `VITE_SITE_TITLE`           | Heading above the name, e.g. "In Loving Memory"                      |
| `VITE_SITE_NAME`            | Name of the person being remembered                                  |
| `VITE_SITE_DATE_OF_BIRTH`   | ISO 8601 date, e.g. `1938-04-17`                                     |
| `VITE_SITE_DATE_OF_DEATH`   | ISO 8601 date, e.g. `2026-02-03`                                     |
| `VITE_SITE_WELCOME_TEXT`    | Introductory paragraph on the home page                              |
| `VITE_SITE_MAIN_PHOTO`      | Path relative to the site root, or an absolute URL                   |

The `VITE_SITE_*` variables exist so that the real memorial details never have
to be committed — see the next section. Any of them left unset falls back to the
placeholder in `src/data/site.json`.

`BASE_PATH` is a build-time variable (not `VITE_` prefixed, and not available to
browser code). It sets the path the site is served from and is only needed for
GitHub Pages — see below.

Environment variables are read in exactly one place, `src/config/appConfig.ts`.
Nothing else in the application touches `import.meta.env`.

## Keeping the real details out of the repository

`src/data/site.json` holds placeholder content only. The real details are
supplied at build time from **GitHub Actions variables**, so anyone who clones
or forks this repository gets the placeholder and nothing else — and there is no
copy of the details in the git history.

Set them once, in **Settings → Secrets and variables → Actions → Variables**, or
from the command line:

```bash
gh variable set SITE_NAME       --body "…"
gh variable set SITE_TITLE      --body "In Loving Memory"
gh variable set SITE_WELCOME_TEXT --body "…"
gh variable set SITE_DATE_OF_BIRTH --body "1938-04-17"
gh variable set SITE_DATE_OF_DEATH --body "2026-02-03"
gh variable set SITE_MAIN_PHOTO --body "photos/main.jpg"
```

The workflow maps each `SITE_*` variable to the matching `VITE_SITE_*` build
variable, `appConfig` reads it, and `siteService` layers it over the placeholder.
The next push to `main` picks up any change; nothing needs to be committed.

**These are already set on the repository.** `SITE_TITLE`, `SITE_NAME` and
`SITE_WELCOME_TEXT` hold real values. `SITE_DATE_OF_BIRTH`, `SITE_DATE_OF_DEATH`
and `SITE_MAIN_PHOTO` are blank, waiting for details nobody has supplied yet.

They hold a single space rather than an empty string, because GitHub rejects an
empty variable value. `appConfig` trims before deciding, so a whitespace-only
variable counts as unset and the placeholder shows through -- which is why the
home page reads "Dates to be added" rather than showing a blank line.

To see the real content locally, put the same values in `.env.local`, which is
ignored by git. Every `.env*` file except `.env.example` is ignored.

**This is privacy, not secrecy.** The values are compiled into the JavaScript
bundle and displayed on a public web page — that is the point of the site. What
this arrangement avoids is committing personal details to a repository that may
be public, cloned or forked. So:

- use Actions **variables**, never Actions **secrets**;
- never give a `VITE_` prefix to anything that must genuinely stay private;
- remember that a repository variable is visible to anyone with access to the
  repository's settings.

Once the Worker exists, `/api/config` becomes the source of this content and the
build-time variables no longer apply.

Memories and photographs are not covered by this: they are visitor-submitted
content and belong in R2 behind the Worker API. Until then, `memories.json` and
`photos.json` should hold demonstration data only.

## How the data layer is arranged

Components never talk to a data source. They call a service, and the service
decides where the data comes from:

```
page component  ->  service (memoryService / photoService / siteService)
                        |
                        +-- VITE_API_URL unset  ->  local JSON in src/data/
                        +-- VITE_API_URL set    ->  apiClient -> Worker API
```

Each service exports an interface plus two implementations, and picks one based
on `appConfig.useMockData`. Switching the site onto a real backend means setting
`VITE_API_URL`; no page component changes.

Planned Worker endpoints:

```
GET    /api/config

GET    /api/memories
GET    /api/memories/{id}
POST   /api/memories
PUT    /api/memories/{id}
DELETE /api/memories/{id}

GET    /api/photos
GET    /api/photos/{id}
POST   /api/photos
DELETE /api/photos/{id}
```

## Security

`docs/security-model.md` sets out the whole model: the three roles, what each
may do, how the administrator and contributors are authenticated, and what is
deliberately left unprotected.

## Deploying to Cloudflare

Nothing is deployed to Cloudflare yet. `docs/cloudflare-deployment.md` covers
it end to end -- both getting started without a domain, and the full deployment
once one exists -- along with the free-tier allowances and the handful of things
that will catch you out.

## Deployment to GitHub Pages

`.github/workflows/deploy-pages.yml` builds and publishes the site.

- **Pull requests to `main`** run type-checking, tests and a build. Nothing is
  published.
- **Pushes to `main`** do the same, then publish `dist/` to GitHub Pages.

One-off setup, in the repository's **Settings → Pages**, set **Source** to
**GitHub Actions**. No secrets or tokens are needed; the workflow authenticates
with the repository's own OIDC token.

The deployed site is at <https://jaslend.github.io/RogsPlace/>.

### Base path

A GitHub Pages project site is served from `/<repository-name>/` rather than the
domain root. The workflow therefore builds with:

```
BASE_PATH: /${{ github.event.repository.name }}/
```

Vite puts that value into `import.meta.env.BASE_URL`, `appConfig` reads it, and
React Router uses it as its `basename`. Locally, and on Cloudflare Pages, the
default of `/` applies and nothing has to change.

### Routing on GitHub Pages

The site uses `BrowserRouter` — real URLs such as `/RogsPlace/photos` — rather
than hash URLs, because that is what Cloudflare Pages will serve in production
and it keeps the URLs clean.

GitHub Pages has no SPA rewrite rule, so a direct request for
`/RogsPlace/photos` finds no such file and falls through to `404.html`. The
build therefore writes a copy of `index.html` to `dist/404.html` (a small plugin
in `vite.config.ts`). GitHub Pages serves that copy, the URL in the address bar
is untouched, and React Router renders the right page. Deep links and page
reloads both work.

This costs one copied file and no redirect trickery, and Cloudflare Pages —
which does rewrite SPA routes itself — simply ignores it. `public/.nojekyll`
stops GitHub Pages running the output through Jekyll.

## Project structure

```
.github/workflows/deploy-pages.yml  Build, test and publish to GitHub Pages
scripts/seed-r2.mjs                 One-off migration of site details into R2
wrangler.toml                       Worker name, bindings and routes
worker/
  src/index.ts                      Router -- every reachable route is listed here
  src/http.ts                       Responses, security headers, CORS, origin checks
  src/storage.ts                    R2 keys, id validation, JSON reads
  src/routes/                       One module per resource
  test/                             Tests, run in the real Workers runtime
public/
  placeholders/                     Demonstration gallery images
  favicon.svg
  .nojekyll
src/
  api/apiClient.ts                  fetch wrapper, ApiError, friendly messages
  components/                       Header, Navigation, Footer, cards, lightbox,
                                    error boundary, loading/empty/error panels
  config/appConfig.ts               The only reader of import.meta.env
  context/SiteConfigContext.tsx     Loads site.json once, shares it
  data/                             Mock site, memories and photos JSON
  hooks/useAsyncData.ts             Loading / success / error state for a fetch
  models/                           SiteConfig, Memory, Photo
  pages/                            One component per route
  services/                         Mock and HTTP implementations per data type
  styles/global.css                 Design tokens and shared primitives
  test/setup.ts                     Test setup
  App.tsx                           Layout and routes
  main.tsx                          Entry point, Router, error boundary
```

Component-specific styling lives in a `*.module.css` file beside the component.

## Placeholder content

Nothing in this repository describes a real person. Dates and the main
photograph in `src/data/site.json` are deliberately blank and the UI marks them
as still to be added.

To remove the demonstration content:

- Empty the array in `src/data/memories.json` to `[]`.
- Empty the array in `src/data/photos.json` to `[]` and delete
  `public/placeholders/`.

Every demonstration entry has an id beginning `demo-`.

Do **not** fill in `src/data/site.json` with the real details — set the
repository variables instead, as described in "Keeping the real details out of
the repository". The tests do not read any of these files, so emptying them
cannot break the build.

## The backend Worker

`worker/` holds a Cloudflare Worker that serves the API from an R2 bucket. It is
being built in stages; this first stage provides the public read endpoints only.
There are no write endpoints and no authentication yet, so nothing can be
changed through it.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/config` | The memorial's details |
| `GET /api/memories` | Published memories, newest first |
| `GET /api/photos` | Published photographs |
| `GET /api/photos/{id}/image` | Full-size photograph |
| `GET /api/photos/{id}/thumb` | Thumbnail |

Running it:

```bash
npm run worker:dev          # http://localhost:8787, local simulated R2
npm run test:worker         # tests, in the real Workers runtime
npm run worker:seed -- --dry-run   # show what would be written to R2
```

To point the site at it, set `VITE_API_URL=http://localhost:8787` in
`.env.local` and run `npm run dev`. With that unset the site continues to use
the mock data, so neither half blocks the other.

### Things worth knowing

**An empty bucket is fine.** `GET /api/config` falls back to the placeholder
committed in `src/data/site.json`, and the two indexes fall back to empty
arrays, so a fresh deployment renders instead of erroring. `npm run worker:seed`
migrates today's GitHub variable values into R2; it refuses to overwrite an
existing object without `--force`, because `configuration/site.json` is what an
administrator will be editing.

**Photographs are served through the Worker**, never from a public bucket. One
check then governs visibility, and anything not yet approved is a 404 —
indistinguishable from a photograph that does not exist, so a pending upload
cannot be found by guessing its URL.

**Image URLs are composed from the request origin** rather than stored, so the
same bucket serves local development, the test deployment and production
without rewriting any stored data.

**CORS is an allowlist**, set by `ALLOWED_ORIGINS` in `wrangler.toml`. It must
never become `*`: that is incompatible with credentialed requests and would let
any page on the internet call the API with a visitor's session cookie.

**`workers_dev = false`.** The Worker is reachable only through the zone. Later
stages put Cloudflare Access in front of the admin routes, and an edge policy
that can be side-stepped by calling `*.workers.dev` directly is not a policy.

### Storage layout

```
configuration/site.json          Memorial details (an administrator edits these)
configuration/invite.json        Invite token hash and version (later stage)
memories/<id>.json               Every memory, with its moderation status
photos/originals/<id>.<ext>
photos/thumbnails/<id>.jpg
metadata/photos/<id>.json
index/memories.json              Published memories -- rebuilt on approval
index/photos.json                Published photographs -- rebuilt on approval
```

Submissions are concurrent, so each gets its own object. The published indexes
are only ever rewritten by a single administrator acting deliberately, which is
what makes it safe for them to be one object each -- and it makes the public
read path a single R2 GET.

### Still to come

Contributor invitations and the session cookie, then Cloudflare Access with the
admin API and UI, then rate limiting, security headers and EXIF stripping. Until
those land, the Add a Memory and Upload Photos pages remain honest mock-ups.

## Planned architecture

```
Browser
   |
   v
Cloudflare Pages  (this React application)
   |
   v
Cloudflare Worker API
   |
   v
Cloudflare R2
```

React never talks to R2 directly. The expected R2 layout is:

```
configuration/site.json
memories/<memory-id>.json
photos/originals/<photo-id>.jpg
photos/thumbnails/<photo-id>.jpg
metadata/photos/<photo-id>.json
```

Each memory becomes its own object so that simultaneous submissions cannot
overwrite one another.

Authentication is not implemented. The intended levels are visitor, contributor
(possibly by invitation link) and administrator; nothing in the current
structure prevents them being added.

## Security notes

The browser-side checks in `src/utils/fileValidation.ts` (10 files per upload,
20 MB each, JPEG/PNG/WebP only, SVG rejected because it can carry script) exist
to be helpful, not to be safe. **The Worker must repeat every one of them**, and
must additionally:

- sniff the actual file format rather than trusting the reported MIME type,
- reject executable content, HTML and JavaScript,
- generate its own object ids and storage keys, never reusing a filename
  supplied by the browser.

Secrets must never be given a `VITE_` prefix.

## Accessibility

Semantic HTML, a single `h1` per page, labelled form controls, visible focus
outlines, a skip link, 48 px minimum touch targets, keyboard support in the
photograph lightbox (Escape closes, arrow keys move) and `alt` text throughout.
Raw exceptions are never shown to visitors: an error boundary and per-page error
states handle failures.
