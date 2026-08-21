# Deploying RogsPlace to Cloudflare

Written so that this can be picked up cold, without the conversation that
produced it. It covers two routes: getting started **without a domain**, and the
**full deployment** once one exists.

Everything here fits inside Cloudflare's free tiers. A domain is the only thing
that costs money.

There is also a step-by-step walkthrough of the full route, formatted for
following in a browser:
<https://claude.ai/code/artifact/2b495017-4bf7-4ebf-b518-81426e87c18c>. This
document is the version that lives with the code, and covers both routes.

For why the deployment is shaped this way -- why the domain matters, why
`workers_dev` has to be off, why Access rather than a password -- see
[security-model.md](security-model.md).

---

## Where the project stands

The frontend and the backend Worker are both written. Nothing is deployed yet,
but the account now exists: **rogsplace.co.uk** was registered through Cloudflare
Registrar on 21 August 2026 and its zone is live, served by Cloudflare's
nameservers. Workers is on the free plan.

That means Route B below is the one to follow. Route A is kept for reference,
and for anyone picking this up without a domain of their own.

| Piece | State |
| --- | --- |
| React frontend | Built. Deployed to GitHub Pages, running on mock data |
| Worker: public reads | Built, tested, not deployed |
| Worker: contributor invitations, moderation queue | Built, tested, not deployed |
| Worker: administration via Cloudflare Access | Built, tested, not deployed |
| Rate limiting, security headers, EXIF stripping, thumbnails | **Not built** — the last stage |

211 tests pass (74 browser, 137 Worker). `npm test` runs both.

The live site is <https://jaslend.github.io/RogsPlace/>. It uses the mock
services, so memories and photographs submitted there never leave the browser,
and the pages say so.

### A note on branches

Stages 2 and 3 were delivered as stacked pull requests and merged into their
bases rather than into `main`. PR #6 reconciles that. **If `worker/src/auth/`
does not exist on `main`, that reconciliation has not been merged yet** and the
complete code is on `feature/contributor-invites`.

---

## Deciding which route to take

The domain is not decoration. Two things depend on it:

- **Session cookies must be first-party.** They are `SameSite=Lax`, so a browser
  will not send them from a site on one domain to an API on another.
- **Cloudflare Access attaches to a hostname in a zone you control.** There is
  no way to protect a `workers.dev` address with it.

So:

| | Without a domain | With a domain |
| --- | --- | --- |
| R2 storage | works | works |
| Worker deployed | works, on `workers.dev` | works, on your domain |
| Public reads (memories, photographs) | works | works |
| Contributor invitations | **no** — cookie cannot cross sites | works |
| Administration | **no** — Access needs a zone | works |

Route A gets the storage, the deployment and the seeding proven. Route B is
needed before anyone else can use the site.

---

## Route A — without a domain

The point of this route is to prove R2, the deploy and the seed script against
the real thing, without changing any code and without breaking the site that is
already live.

### A1. Account and R2

1. Create a free account at <https://dash.cloudflare.com>.
2. Open R2 and enable it. **It asks for a payment method** even though the free
   allowance (10 GB, 1M writes, 10M reads a month, no egress charges) costs
   nothing. Cloudflare uses it to verify the account.
3. From the repository:

```bash
npx wrangler login
npx wrangler r2 bucket create rogsplace
```

Check: `npx wrangler r2 bucket list` shows it.

### A2. The signing key

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
npx wrangler secret put SESSION_SIGNING_KEY   # paste it when prompted
```

Never in `wrangler.toml`, which is committed.

### A3. Temporarily allow a workers.dev address

`wrangler.toml` has `workers_dev = false` deliberately. Without a zone there is
no other way to reach the Worker, so flip it for this route:

```toml
workers_dev = true
```

> **Set it back to `false` before configuring Access.** Access guards the admin
> routes at the edge of your zone, and a `workers.dev` address is a way around
> that. It is safe only while Access is unconfigured, because the Worker then
> grants nobody administration whatever route they arrive by.

Do not commit this change.

### A4. Deploy and seed

```bash
npx wrangler deploy
npm run worker:seed     # migrates the memorial details from the GitHub variables into R2
```

`worker:seed` will not overwrite an object that already exists without
`--force`, because `configuration/site.json` is what an administrator edits.

### A5. Check it

Substitute the address `wrangler deploy` printed:

```bash
curl https://rogsplace-api.<subdomain>.workers.dev/api/health      # {"status":"ok"}
curl https://rogsplace-api.<subdomain>.workers.dev/api/config      # the memorial details
curl https://rogsplace-api.<subdomain>.workers.dev/api/memories    # []
curl -X POST https://rogsplace-api.<subdomain>.workers.dev/api/memories -d '{}'   # 401
```

### A6. Stop here

**Do not set `VITE_API_URL` on the GitHub Pages build.** Setting it turns off
mock mode, so the contribution pages would go from a working demonstration to
visibly broken — the cookie cannot cross from `github.io` to `workers.dev`, so
redeeming an invitation would appear to succeed and then do nothing.

Leave the public site on mock data until you have a domain.

### If you want the whole thing working without a domain

It is possible, but it needs a code change: the session cookie has to become
`SameSite=None; Secure` so browsers will send it cross-site. The `Origin` check
on every write still carries the CSRF defence, so it is defensible — but it is a
weaker posture that should be reverted once the site and API share an origin,
and it still does not get you administration.

---

## Route B — with a domain

### B1. Get the domain onto Cloudflare

**Done.** `rogsplace.co.uk` was registered through Cloudflare Registrar (sold at
cost) on 21 August 2026, so the zone was created in the account automatically and
no nameserver change was needed. It expires 21 August 2027.

If you are following this for a different domain: either register through
Registrar, or add one you already own and change its nameservers at your current
registrar. Check that it shows **Active** in the dashboard -- Pending means the
nameservers have not propagated yet. From the command line, `host -t SOA
<domain>` answering from `*.ns.cloudflare.com` says the same thing.

### B2. R2, signing key, route

Do A1 and A2 above if you have not already.

The route is already set in `wrangler.toml`, along with the production origin in
`ALLOWED_ORIGINS`:

```toml
[[routes]]
pattern = "rogsplace.co.uk/api/*"
zone_name = "rogsplace.co.uk"
```

`zone_name` must match the zone exactly or the deploy is rejected, and the origin
must be in `ALLOWED_ORIGINS` or every write from the live site is refused by the
Origin check. Then:

```bash
npx wrangler deploy
npm run worker:seed
```

Check: `curl https://rogsplace.co.uk/api/health` returns `{"status":"ok"}`.

### B3. The site on Cloudflare Pages

In Workers & Pages, create a Pages project from the `jaslend/RogsPlace`
repository:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL` = `https://rogsplace.co.uk`

Then add `rogsplace.co.uk` as a custom domain on the project.

> **`VITE_API_URL` must be the full origin.** Not `/api` — the client appends
> `/api/…` itself, so that produces `/api/api/memories`. Not blank — blank means
> "no backend configured" and silently drops the whole site back to mock data.

Leave `BASE_PATH` alone: it exists for GitHub Pages serving under `/RogsPlace/`,
and Cloudflare serves from the root.

### B4. The family invitation

```bash
npm run worker:invite -- --site https://rogsplace.co.uk
```

Printed once — only its hash is stored. Running it again rotates it, which signs
out everyone holding the old link.

Check: open the link in a private window, submit a memory, then look at the site
signed out. It should not be there; it is waiting for approval.

### B5. Cloudflare Access, for administration

1. Open the Zero Trust dashboard and turn it on. It asks for a team name, which
   becomes `yourteam.cloudflareaccess.com`. Free for 50 users, no card.
2. Under Access → Applications, add **two** self-hosted applications:
   `rogsplace.co.uk/admin` and `rogsplace.co.uk/api/admin`.
3. Give each an Allow policy naming your email address, with one-time PIN as the
   login method.
4. Put the application's **Audience (AUD) tag** and your team domain into the
   `[vars]` block of `wrangler.toml`:

```toml
ACCESS_TEAM_DOMAIN = "yourteam.cloudflareaccess.com"
ACCESS_AUD = "the-application-audience-tag"
```

5. `npx wrangler deploy` again — those are build-time variables.

Neither value is secret. The team domain appears in every sign-in URL, and the
audience tag names an application rather than authorising anything; the Worker
still verifies the token's signature against Cloudflare's published keys.

Check: `rogsplace.co.uk/admin` in a private window should ask for your email and
send a PIN. `curl https://rogsplace.co.uk/api/admin/queue` with no token must
answer 403.

---

## Things that will catch you out

**`wrangler dev` binds `preview_bucket_name`, not `bucket_name`.** The helper
scripts target `rogsplace-preview` when given `--local` for exactly this reason.
Without that they write to the production bucket and the local Worker never sees
it.

**`VITE_API_URL` must be an origin, never a path, never blank.** See B3.

**`workers_dev` must be `false` once Access is configured.** See A3.

**The Workers free plan allows 10 ms of CPU per request.** A photograph upload
reads the whole file into memory before writing it to R2, and a 20 MB image may
not fit that budget — the symptom is large uploads failing while small ones
work. Two fixes: stream the request body straight through to R2 instead of
buffering it, or move to the paid plan at $5/month. Try the code change first.

**Every photograph view is a Worker request**, because images are served through
the Worker rather than from a public bucket. They are cached as immutable for a
year, so repeat views are absorbed by the CDN. The free plan's 100,000 requests
a day is nowhere near a constraint at family scale.

**A missing `SESSION_SIGNING_KEY` fails closed** — no session can be issued or
accepted. A missing `ACCESS_AUD` or `ACCESS_TEAM_DOMAIN` likewise means no
administrator exists at all. Both are the safe direction, but both look like
"nothing works" rather than an obvious error.

---

## Costs

| Service | Free allowance | Cost |
| --- | --- | --- |
| Domain | — | ~£10/yr, the only real expense |
| R2 | 10 GB, 1M writes, 10M reads a month, no egress charges | £0 (card required) |
| Workers | 100,000 requests/day, 10 ms CPU, 128 MB | £0 |
| Pages | Unlimited requests and bandwidth | £0 |
| Zero Trust (Access) | 50 users, indefinitely | £0 (no card) |

Verified August 2026. Worth re-checking in the dashboard before committing.

---

## Still to build

The last stage of the security plan: rate limiting (Cloudflare WAF rules, not
code), a `_headers` file for Pages setting CSP and friends, EXIF stripping on
upload — family photographs routinely carry GPS coordinates — and real
thumbnails, generated in the browser before upload. Until thumbnails exist, a
request for one falls back to the original image.

None of it blocks deploying what is already built.
