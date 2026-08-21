# How security works in RogsPlace

The design as built, and why it is the way it is. Written so it can be reviewed
or changed without reconstructing the reasoning from the code.

## The decisions this rests on

| Question | Decision |
| --- | --- |
| Who can read the memorial | **Anyone.** Memories and photographs are public |
| How the administrator signs in | **Cloudflare Access**, email one-time PIN |
| How contributors are invited | **One shared family link**, rotatable |
| When submissions appear | **After the administrator approves them** |

The last two work together deliberately. A shared link is a bearer secret: it
can be forwarded to anyone, and there is no way to know who holds it. The
approval queue is what stops a leaked link becoming defacement. Neither is
sufficient alone, and swapping one out means reconsidering the other.

## The model in one paragraph

Three roles. A **visitor** has no credential and can read. A **contributor** has
redeemed the family invitation and holds a signed session cookie, and may
submit. An **administrator** is authenticated by Cloudflare Access, and may
approve, edit and delete. The Worker is the only enforcement point: the React
application decides what to *show*, never what is *allowed*.

## What each role may do

The Worker checks this on every request. Nothing is implicit.

| Endpoint | Visitor | Contributor | Admin |
| --- | :---: | :---: | :---: |
| `GET /api/config` | yes | yes | yes |
| `GET /api/memories` (published only) | yes | yes | yes |
| `GET /api/photos` (published only) | yes | yes | yes |
| `GET /api/photos/{id}/image` `/thumb` | published only | published only | anything |
| `POST /api/auth/invite` | yes | — | — |
| `GET /api/auth/session` | yes | yes | yes |
| `POST /api/auth/logout` | yes | yes | yes |
| `POST /api/memories` (lands pending) | no | yes | yes |
| `POST /api/photos` (lands pending) | no | yes | yes |
| `GET /api/admin/queue` | no | no | yes |
| `POST /api/admin/memories/{id}/approve` `/remove` | no | no | yes |
| `POST /api/admin/photos/{id}/approve` `/remove` | no | no | yes |
| `PUT /api/config` | no | no | yes |
| `POST /api/admin/invite/rotate` | no | no | yes |

`worker/test/administration.test.ts` and `worker/test/authorisation.test.ts`
walk this table a row at a time. If a route is added later without a guard,
exactly one line goes red.

## How each role is established

### Administrator — Cloudflare Access

No administrator password exists anywhere in this project: not in the
repository, not in R2, not in a Worker secret.

Access checks identity at the edge and passes a signed token in
`Cf-Access-Jwt-Assertion`. **The Worker verifies that token itself**
(`worker/src/auth/access.ts`) rather than trusting the header, because a header
is only a claim and anything reaching the Worker another way could otherwise
simply assert it. Every check is load-bearing:

- the signature, against the team's published keys;
- `alg`, pinned to RS256, so an unsigned `alg: none` token is refused;
- `aud`, so a token minted for a different Access application in the same
  account cannot be replayed here;
- `iss`, so a token from another team is refused;
- `exp` and `nbf`.

`workers_dev = false` in `wrangler.toml` means the Worker is only reachable
through the zone where the Access policy applies. Either that or the token check
would be enough on its own; neither is expensive.

**With `ACCESS_AUD` or `ACCESS_TEAM_DOMAIN` unset, no administrator exists at
all.** A misconfiguration means nobody can administer, never that everybody can.

### Contributor — the shared invitation

A 256-bit random token, shared as `https://…/invite/<token>`. R2 holds only its
SHA-256 hash, in `configuration/invite.json`, so a leaked bucket listing grants
nothing. It is printed once when created and cannot be recovered.

Redeeming it (`POST /api/auth/invite`) sets a session cookie. The record also
carries a `version`, which sessions are issued against, so **rotating the
invitation signs out everyone holding the old link** — with no session store to
clear. That is the remedy when a link has been forwarded too widely.

### The session cookie

`rp_session`, carrying `base64url({role, ver, exp})` and an HMAC-SHA256
signature over it, keyed by the `SESSION_SIGNING_KEY` Worker secret. Stateless:
no session store, and therefore no database.

```
HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30d
```

`HttpOnly` keeps it away from JavaScript. `SameSite=Lax` stops it riding along
with a cross-site post, and every mutating request additionally checks the
`Origin` header — together these remove any need for CSRF tokens.

**A cookie can only ever make somebody a contributor.** The two roles are
established by entirely separate means, so there is no path from holding the
family invitation to running the site.

**A missing `SESSION_SIGNING_KEY` fails closed**: no session can be issued or
accepted.

## Moderation

Submissions are concurrent — several people may be writing at once — so each
gets its own object. The published index is only ever rewritten by a single
administrator acting deliberately, which is what makes it safe as one object,
and what makes the public read path a single R2 GET.

```
configuration/site.json      Memorial details (the administrator edits these)
configuration/invite.json    { tokenHash, version, rotatedAt }
memories/<id>.json           Every memory, with its moderation status
photos/originals/<id>.<ext>  Never publicly routable; served via the Worker
photos/thumbnails/<id>.jpg
metadata/photos/<id>.json    Status lives here, and in R2 custom metadata
index/memories.json          Published memories, rebuilt on every approval
index/photos.json            Published photographs, likewise
```

Nothing submitted is visible until approved. A pending photograph is a **404,
not a 403** — refusing differently would confirm that it exists and is merely
waiting. An administrator can see it, because they have to look at it to
moderate it.

Rejecting **deletes**. Something an administrator did not want on the memorial
should not sit in the bucket indefinitely.

Indexes are rebuilt from scratch rather than edited. That is a handful of reads
at this scale and it cannot drift: if an object and the index ever disagree, the
next approval reconciles them.

## Uploads

The browser checks in `src/utils/fileValidation.ts` are a courtesy. The Worker
repeats every one of them and adds:

- **magic-byte sniffing** — only JPEG, PNG and WebP are accepted, whatever the
  browser declared. An SVG, an HTML page or an executable renamed `.jpg` is
  refused; those are what would otherwise turn an upload form into a way to
  serve script from this origin;
- **server-generated ids and keys** — a filename from a browser is metadata, and
  is never used as a storage key;
- `X-Content-Type-Options: nosniff` and a sniffed `Content-Type` on the way out.

One photograph per request, because a Worker has far less memory than ten
twenty-megabyte files would need.

## What is deliberately not protected

- **Reading.** Memories and photographs are public to anyone with the URL.
  Making the site family-only later means gating the `GET` routes and the photo
  stream; the enforcement point already exists, so it is a policy change rather
  than a rewrite.
- **Contributor identity.** A shared link means there is no per-person identity,
  so there is no "edit my own" and no audit trail beyond the name someone types.
  Moving to per-person invitations later is additive: the same cookie, with a
  `sub` claim.
- **The frontend.** `src/components/RequireRole.tsx` decides what to show and
  says so in its own comment. Anyone can bypass it from a browser console and
  gain nothing.

## Secrets and configuration

| Name | Where | Secret? |
| --- | --- | --- |
| `SESSION_SIGNING_KEY` | `wrangler secret put` | Yes |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | `wrangler.toml` vars | No |
| `ALLOWED_ORIGINS` | `wrangler.toml` vars | No |
| `VITE_API_URL`, `VITE_SITE_*` | Pages build | No — public by design |

Nothing security-relevant carries a `VITE_` prefix; anything that does is
compiled into the browser bundle.

CORS is an allowlist that echoes the origin. **It must never become `*`** — that
is incompatible with credentialed requests and would let any page on the
internet call the API with a visitor's session cookie.

## Photograph metadata

Photographs are downscaled and re-encoded in the browser before upload
(`src/utils/preparePhoto.ts`). The re-encode discards the EXIF block, which is
where a camera records the GPS coordinates family photographs routinely carry —
a memorial site is exactly the sort of place where the address of a house should
not be published as a side effect of sharing a picture taken in its garden.

Doing this in the browser is deliberate: the data never crosses the network at
all. That makes it a protection for the person uploading, not a check on a
hostile one, since anybody posting to the API directly can send whatever they
like. The Worker therefore sniffs the uploaded thumbnail exactly as hard as the
photograph, and enforces `uploadLimits.maxUploadBytes` on both.

The stored orientation is applied to the pixels before the metadata is
discarded. Without that step, stripping EXIF would leave portrait photographs
lying on their side.

## Not yet built

The last stage: rate-limiting rules on `/api/auth/invite` and the upload
endpoints (Cloudflare WAF configuration, not code), and a `_headers` file for
Pages setting CSP and friends.
