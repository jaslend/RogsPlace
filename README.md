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

| Variable       | Purpose                                                            |
| -------------- | ------------------------------------------------------------------ |
| `VITE_API_URL` | Base URL of the backend API. Leave unset to use the local mock data |

`BASE_PATH` is a build-time variable (not `VITE_` prefixed, and not available to
browser code). It sets the path the site is served from and is only needed for
GitHub Pages — see below.

Environment variables are read in exactly one place, `src/config/appConfig.ts`.
Nothing else in the application touches `import.meta.env`.

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
- Fill in `src/data/site.json`.

Every demonstration entry has an id beginning `demo-`.

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
