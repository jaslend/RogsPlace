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
scripts/create-invite.mjs           Create or rotate the family invitation link
wrangler.toml                       Worker name, bindings and routes
worker/
  src/index.ts                      Router -- every reachable route is listed here
  src/auth/session.ts               Signed session cookies
  src/auth/invite.ts                Invitation hashing and comparison
  src/auth/access.ts                Verifying Cloudflare Access tokens
  src/auth/context.ts               Resolving a role, refusing a request
  src/indexes.ts                    Rebuilding the published lists
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
  config/limits.ts                  Validation limits shared with the Worker
  context/SessionContext.tsx        The caller's role, for presentation only
  context/SiteConfigContext.tsx     Loads site.json once, shares it
  data/                             Mock site, memories and photos JSON
  hooks/useAsyncData.ts             Loading / success / error state for a fetch
  models/                           SiteConfig, Memory, Photo
  pages/                            One component per route, including /admin
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
being built in stages; the public reads, contributor invitations and
administration are all in place, as is the browser-side preparation of uploads.
What remains is hardening: rate limiting and security headers.

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `GET /api/health` | anyone | Liveness check |
| `GET /api/config` | anyone | The memorial's details |
| `GET /api/memories` | anyone | Published memories, newest first |
| `GET /api/photos` | anyone | Published photographs |
| `GET /api/photos/{id}/image` `/thumb` | anyone | The image, if published |
| `POST /api/auth/invite` | anyone | Exchange an invitation for a session |
| `GET /api/auth/session` | anyone | The caller's current role |
| `POST /api/auth/logout` | anyone | Clear the session |
| `POST /api/memories` | contributor | Submit a memory, for approval |
| `POST /api/photos` | contributor | Upload a photograph, for approval |
| `GET /api/admin/queue` | administrator | Everything waiting to be looked at |
| `POST /api/admin/memories/{id}/approve` `/remove` | administrator | Publish or delete a memory |
| `POST /api/admin/photos/{id}/approve` `/remove` | administrator | Publish or delete a photograph |
| `PUT /api/config` | administrator | Edit the memorial's details |
| `POST /api/admin/invite/rotate` | administrator | Replace the family invitation |

Running it:

```bash
npm run worker:dev          # http://localhost:8787, local simulated R2
npm run test:worker         # tests, in the real Workers runtime
npm run worker:seed -- --dry-run   # show what would be written to R2
npm run worker:invite -- --local   # create a family invitation link
```

Local development needs a signing key: copy `.dev.vars.example` to `.dev.vars`
and put a long random value in it. `.dev.vars` is never committed.

Note that `wrangler dev` binds `preview_bucket_name`, so the scripts target
`rogsplace-preview` when given `--local`. Without that they would write to the
production bucket and the local Worker would not see it.

To point the site at it, set `VITE_API_URL=http://localhost:8787` in
`.env.local` and run `npm run dev`. With that unset the site continues to use
the mock data, so neither half blocks the other.

### Who may do what

Three roles. **Visitors** read. **Contributors** have redeemed the family
invitation link and may submit. **Administrators** approve and edit -- next
stage.

The invitation is a single link the administrator shares. Redeeming it sets a
signed, `HttpOnly`, `SameSite=Lax` session cookie; there are no accounts and no
passwords, and no session is stored anywhere. Create or rotate the link with:

```bash
npm run worker:invite -- --site https://rogsplace.co.uk
```

Only the SHA-256 hash of the token is kept in R2, so the link cannot be
recovered from the bucket -- it is printed once, when it is created. Each
rotation raises a version counter that sessions carry, so **rotating the link
signs out everyone holding the old one**. That is the remedy if a link is
forwarded too widely.

**The administrator is authenticated by Cloudflare Access**, not by anything
this project stores. There is no admin password anywhere in the repository or in
R2. Access checks identity at the edge and passes a signed token; the Worker
verifies that token itself -- signature against the team's published keys,
algorithm pinned to RS256, and the audience, issuer and expiry all checked --
because a header is only a claim, and anything reaching the Worker another way
could otherwise simply assert it. `workers_dev = false` closes that other way.

Set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.toml` from the Access
application's overview page. **While they are unset no administrator exists**,
which is the safe direction for a misconfiguration to fail in.

**A session cookie can never make anyone an administrator.** The two roles are
established by entirely separate means, so there is no path from holding the
family invitation to running the site.

**Nothing submitted appears until it is approved.** A memory or photograph is
stored in its own object with a pending status and does not join the published
index, which is what the public endpoints read. A pending photograph is a 404
even to the person who uploaded it. This is what makes a shared invitation link
safe to hand around: the worst a leaked link achieves is a queue an
administrator has to clear.

**The interface is not the control.** `RequireRole` in the browser decides what
to *show*; every write endpoint in the Worker checks the session for itself, and
that is the check that matters. Anyone can bypass the former from a console and
gain nothing.

**Cross-site requests are refused twice.** `SameSite=Lax` keeps the cookie off
cross-site posts, and every write also checks the `Origin` header. Together
those remove any need for CSRF tokens.

**A missing signing key fails closed.** A Worker deployed without
`SESSION_SIGNING_KEY` refuses to issue or accept any session, so the mistake
means nobody is signed in rather than everybody.

**Photographs are reduced before they are uploaded.** `src/utils/preparePhoto.ts`
decodes each chosen file, caps its long edge, and re-encodes it as JPEG along
with a thumbnail. The Worker therefore never receives the original: a few
hundred kilobytes arrive instead of twenty megabytes, which is what keeps the
request inside the free plan's 10ms of CPU. Re-encoding also discards the EXIF
block, so the GPS coordinates family photographs routinely carry never leave the
device. A file that cannot be prepared is refused rather than sent as-is.

**One photograph per request.** A Worker has far less memory than ten files at
once would need, so the browser uploads them one at a time. One failure then
does not lose the rest, and progress is honest.

**Uploads are identified by their contents.** The Worker reads the file's magic
bytes and accepts only JPEG, PNG and WebP, whatever the browser declared. An
SVG, an HTML page or an executable renamed to `.jpg` is refused -- those are
what would otherwise turn an upload form into a way to serve script from this
origin. The Worker also names every stored object itself; a filename from a
browser is never used as a storage key.

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

### Administering the memorial

`/admin` shows everything waiting, the memorial's details, and the family
invitation. Approving publishes; rejecting deletes, because something you did
not want on the memorial should not sit in the bucket indefinitely.

The published lists are rebuilt from scratch on every approval rather than
edited. That is a handful of reads at this scale and it cannot drift -- if an
object and the index ever disagree, the next approval reconciles them. It is
safe as a single object because only one administrator, acting deliberately,
ever writes it; contributions never touch it.

An administrator can view a photograph that is still waiting, since they have to
look at it to moderate it. To everyone else it is a 404.

### Still to come

Rate limiting and security headers. A photograph stored before thumbnails
existed, or uploaded without one, still serves the full image for a thumbnail
request rather than failing.

With no `VITE_API_URL` set the site still runs entirely on mock data, and the
mock treats everyone as a contributor: there is nothing to protect when
submissions never leave the browser, and the forms say so.

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

The same applies to the downscaling in `src/utils/preparePhoto.ts`. Stripping
EXIF in the browser protects the person uploading, who is the one whose location
is in the file, and it is the right place to do it because the data then never
crosses the network at all. It is not a check on a hostile caller: someone
posting to the API directly can send whatever they like, which is why the Worker
sniffs the thumbnail as hard as the photograph and enforces
`uploadLimits.maxUploadBytes` on both.

Secrets must never be given a `VITE_` prefix.

## Accessibility

Semantic HTML, a single `h1` per page, labelled form controls, visible focus
outlines, a skip link, 48 px minimum touch targets, keyboard support in the
photograph lightbox (Escape closes, arrow keys move) and `alt` text throughout.
Raw exceptions are never shown to visitors: an error boundary and per-page error
states handle failures.
