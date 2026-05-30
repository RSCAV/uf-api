# How to Find UF's Hidden Endpoints (Discovery Playbook)

> "IDK how they found all this, but if they can do it, we can do it."
>
> This is the reusable, public-only methodology for mapping UF's `apix` gateway and the other public data hosts. Everything here is observation of what UF's own public web pages already fetch in a browser. Nothing bypasses authentication. Re-run this after any UF redesign, because the bundle hashes change on every deploy.

---

## The core idea

UF's student portal **ONE.UF** is a single-page app. The pretty page you see is a thin shell; all the real data arrives over JSON from a gateway at `https://one.ufl.edu/apix/<service>/<operation>`. The 2022 repo found the `soc/schedule` endpoint by hand. The systematic way to find the rest is to read the app's own JavaScript and watch its network calls. That is how every endpoint in [`uf-api/ENDPOINTS.md`](./uf-api/ENDPOINTS.md) was confirmed.

---

## The 7-step recipe

### 1. Read `robots.txt` first (cheap, sets expectations)
```bash
curl -s https://one.ufl.edu/robots.txt
```
For ONE.UF this only disallows `/soc` (the HTML page, not the JSON). It confirms there is no sitemap of hidden APIs to lean on, and it tells you what UF asks crawlers to avoid. Respect it.

### 2. Do NOT waste time guessing a spec URL
There is **no** OpenAPI/Swagger index. Verified dead (all 404): `/apix/`, `/apix/openapi.json`, `/apix/swagger`, `/apix/v3/api-docs`, `/apix/soc/swagger`, `/apix/soc/api-docs`. Skip this entirely; the spec does not exist.

### 3. The real method: grep the JS bundles
Fetch the SPA shell HTML with a real User-Agent and pull the script chunk names:
```bash
curl -s -A 'Mozilla/5.0' https://one.ufl.edu/soc/ | grep -oE 'src="[^"]+\.js"'
# SOC app loads        ../soc/soc.<hash>.min.js
# dashboard loads      ../workspace/workspace.<hash>.min.js
# both share chunks at ../dist/<id>.<hash>.min.js
```
Download every chunk and grep for the gateway paths:
```bash
curl -s -A 'Mozilla/5.0' 'https://one.ufl.edu/dist/<id>.<hash>.min.js' \
  | grep -hoE '/apix/[a-zA-Z0-9/_.-]+' | sort -u
```
One grep yields the entire **eager** API surface the app loads up front.

### 4. The auth heuristic (the trick that makes it readable)
Every call in the bundle is wrapped in a helper of the form:
```js
(0,x.Ay)("/apix/<service>/<operation>", "get"|"post", {}, true)
//                                                          ^^^^
//   the trailing boolean = auth-required. true → needs SSO. false/absent → public.
```
So you can classify public-vs-private **without** ever attempting a login. If it ends in `true`, leave it alone (it is student-private and out of bounds). If it is `false`, it is fair game to verify.

### 5. The human-readable service catalog
UF ships a public list that maps every ONE.UF feature to its required login tier:
```bash
curl -s 'https://one.ufl.edu/apix/search/getpubliclists'
```
This is the map: it names `/transcript`, `/degreeaudit`, `/myschedule`, etc. and the tier each needs (student / staff / applicant). It is how you **confirm a private feature exists** without poking at it. The auth-walled routes live in lazy-loaded chunks behind SSO; you never need to touch them.

### 6. Verify liveness per endpoint
```bash
curl -s -m 15 -A 'Mozilla/5.0' '<url>'   # primary
```
Classify each as live / dead / forbidden / unknown. Note: a generic web-fetch tool that strips `<script>` tags **cannot** see bundle URLs, so use `curl + grep` for the JavaScript step and the fetch tool only for pretty-printing JSON responses.

### 7. Catch the dynamic calls the static grep misses
Some query strings are built at runtime and never appear as literals in the bundle. Drive the live page in **DevTools Network tab** (or Playwright) and watch the XHRs fire as you click around the course search. This catches the parameterized calls the static grep cannot reconstruct.

---

## Field notes (hard-won specifics)

- **Term codes** are `2 + YY + S`, where `S` = `1` Spring, `5` Summer, `8` Fall. So `2261` = Spring 2026, `2265` = Summer 2026, `2268` = Fall 2026. Summer sub-terms append `6W1` / `6W2` (Summer A / B). **Never hardcode these** — pull the live list from `/apix/soc/filters`.
- **Host alias.** `one.ufl.edu` (original, verified live in 2026) and `one.uf.edu` (the `l` dropped) both serve the same `apix` data. Prefer `one.ufl.edu`; keep a liveness probe in case UF consolidates.
- **User-Agent / Referer gating.** `campusmap.ufl.edu` returns `403` to a bare User-Agent. The campus-map JSON (`geo_buildings.json`, etc.) is public but UA/Referer-gated. A realistic browser UA plus a `Referer: https://campusmap.ufl.edu/` header is sometimes the difference between `403` and data. (Note: as of 2026 the entire `/library/` cmapjson subtree is hard-blocked regardless. Documented in ENDPOINTS.md.)
- **RateMyProfessors token.** RMP's own frontend ships a public Basic token `Authorization: Basic dGVzdDp0ZXN0` (base64 of `test:test`). It is in their JS, not a secret. The UF school is the Relay global id `U2Nob29sLTExMDA=` (base64 `School-1100`), **not** the raw `1100` — passing `1100` returns nothing. POST GraphQL to `https://www.ratemyprofessors.com/graphql`.
- **Tableau Public** (the grade-distribution host) has a clean metadata JSON at `public.tableau.com/profile/api/workbook/<name>` you can use as a liveness/version check before scraping the viz itself.

---

## New surface this method already found (2026)

Beyond `soc/schedule`, the bundle grep surfaced these public infra endpoints the 2022 repo never listed:

| Endpoint | What it is |
|---|---|
| `/apix/soc/filters` | term codes + ~243-department dictionary + categories + program levels (the bootstrap table) |
| `/apix/search/all/?query=<q>` | ONE.UF global search |
| `/apix/search/getpubliclists` | the public service catalog (feature → login tier) |
| `/apix/maintenance/getmaintenancetime/` | scheduled maintenance window |
| `/apix/featuretoggle/checkfeaturetoggle/` | feature-flag state |
| `/apix/response-cache/soc` | SOC cache passthrough |
| `/apix/login/getadmissionlink` | admissions status deep-link |

Plus three net-new **subsystems** off-portal: UF Catalog CourseLeaf (descriptions, prereqs, degree pages), UF OIPR grade distributions (Tableau Public), and the RateMyProfessors GraphQL API.

---

## Responsible use (non-negotiable)

1. **Public + unauthenticated only.** If the auth-bool is `true` or a call needs SSO, stop. Never attempt a login, token, or session.
2. **No private student data.** `transcript`, `degreeaudit`, `myschedule`, `holds`, `financialaid` are off-limits, full stop.
3. **A few requests, not a harvest.** Verify with 1-3 calls per endpoint. Page sequentially with `last-control-number`; never loop or deep-crawl.
4. **No evasion.** Do not rotate User-Agents or spoof headers to get around a `403` on a blocked path. A block is an answer; record it and move on.
5. **Cache aggressively.** The catalog changes slowly. Snapshot raw extracts so a broken upstream degrades to last-known-good.
6. **Disclose.** Anything built on these carries a visible note: data is sourced from UF's public web, not an official feed.

---

## When the trail goes cold (re-discovery)

UF redesigns periodically and the bundle hashes rotate (e.g. `soc.59d5c440.min.js` becomes a new hash). Hardcoding bundle URLs will rot. Re-run from step 3: discover the fresh chunk names from the SPA shell, re-grep, and diff against this catalog. A weekly liveness probe (filters + one schedule record + one CourseLeaf course) is the early-warning system.
