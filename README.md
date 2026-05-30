# UF API 2026

A verified, public-only catalog of University of Florida web endpoints, re-checked live in 2026. This is the 2026 revival of [Rolstenhouse/uf_api](https://github.com/Rolstenhouse/uf_api), the original UF API project (65 stars, stale since 2022).

The original repo mapped UF's hidden public endpoints and became the reference for a generation of UF student hackers. Four years later much of it has rotted: hosts moved, the famous campus-map JSON suite was locked down, and live seat data was pulled from the Schedule of Courses. This project re-verifies every documented endpoint against live 2026 UF infrastructure, marks what survived, documents what died, and adds the substantial new surface UF exposed in the meantime (a course-catalog AJAX feed, a grade-distribution dataset, a RateMyProfessors integration, and a brand-new SOC filters endpoint).

Full catalog: see [ENDPOINTS.md](./ENDPOINTS.md).

## Credit

This project stands on the shoulders of [Will Rolstenhouse](https://github.com/Rolstenhouse) and the original [Rolstenhouse/uf_api](https://github.com/Rolstenhouse/uf_api). That repo discovered and documented the UF endpoints that made all of this possible. UF API 2026 is a respectful continuation, not a replacement. Where the original is right, we cite it; where reality has drifted, we correct it and say so.

## What changed since 2022 (headlines)

- **The Schedule of Courses API is alive and richer than ever** at `https://one.ufl.edu/apix/soc/schedule/`. Each course now carries a full description and a raw prerequisites string inline; each section carries gen-ed flags, Quest flags, writing-requirement credits, instructor names, wait-list data, and a per-section drop/add deadline.
- **But live seats and meeting times are gone.** `openSeats`, `meetTimes`, and `finalExam` are now universally null/empty. UF removed live seat availability and meeting times from the public API. Do not build a live-seats or schedule-conflict feature on this endpoint.
- **A brand-new SOC filters endpoint** at `https://one.ufl.edu/apix/soc/filters` returns the authoritative term-code list, every department code, categories, and program levels in one call. It is the bootstrap table for crawling the whole catalog.
- **Pagination changed.** The real cursor is `last-control-number` (self-advancing from the response's `LASTCONTROLNUMBER`). The 2022 `last-row` param is now a silent no-op that loops page 1 forever.
- **The campus-map JSON suite is locked down.** All eight `cmapjson` files (search, geo_buildings, dining, library, study, aed, bus_stops, wireless) return a hard 403. The gym live cams, though, still work.
- **Net-new subsystems** the 2022 repo never covered: the UF Catalog CourseLeaf CMS (course descriptions, prereqs, and degree-requirement pages), UF's official grade-distribution dataset on Tableau Public, and a public RateMyProfessors GraphQL API.

## Quick start

The crown jewel, one curl away. Fetch a single Fall 2026 course with its description and prerequisites:

```bash
curl -s 'https://one.ufl.edu/apix/soc/schedule/?category=CWSP&term=2268&course-code=EEL3135&last-control-number=0'
```

```json
[{"COURSES":[{"code":"EEL3135","name":"Introduction to Signals and Systems",
  "prerequisites":"Prereq: MAC 2313 and (COP2271 or COP2273 or ... or equivalent).",
  "sections":[{"number":"NAPP","classNumber":26214,"credits":4,
    "deptName":"Electrical and Computer Engineering",
    "instructors":[{"name":"Nicholas Napoli"}],
    "waitList":{"cap":10,"total":10}}]}],
  "LASTCONTROLNUMBER":3184,"RETRIEVEDROWS":1,"TOTALROWS":1}]
```

Bootstrap the whole catalog crawl with the new filters endpoint:

```bash
curl -s 'https://one.ufl.edu/apix/soc/filters/?term=2268'
```

Term codes follow `2 + YY + S` where `S` is 1 for Spring, 5 for Summer, 8 for Fall. So `2261` is Spring 2026, `2265` is Summer 2026, `2268` is Fall 2026. Always read the live list from the filters endpoint rather than computing it.

## 2026 status at a glance

Every endpoint was probed live and classified. Summary:

| Status | Count | Meaning |
|---|---|---|
| ✅ Live | 24 | Verified returning real data in 2026 |
| 🔒 Forbidden | 14 | Exists but auth-walled or hard-blocked (403 / SSO) |
| ❌ Dead | 8 | 404 / empty / domain does not resolve |
| ⚠️ Unknown | 1 | Host responds, no clean public data path |

Of the forbidden total, eight are the locked-down campus-map JSON files and the rest are SSO-walled student-data services (transcript, degree audit, registration) plus the Localist events API and the CourseLeaf admin backend. Of the live total, several are brand-new discoveries not in the 2022 repo, marked with a new-endpoint flag in [ENDPOINTS.md](./ENDPOINTS.md).

Highlights by subsystem:

| Subsystem | Status |
|---|---|
| SOC Schedule (course/section search) | ✅ live, richer schema, no live seats |
| SOC Filters (term/dept/category lookup) | ✅ live, new in 2026 |
| UF Catalog CourseLeaf (descriptions, prereqs, degree pages) | ✅ live, new subsystem |
| RateMyProfessors GraphQL | ✅ live, new subsystem |
| OIPR grade distributions (Tableau Public) | ✅ live, new subsystem |
| Academic calendar (CourseLeaf dates pages) | ✅ live, HTML only |
| apix infrastructure services | ✅ live, no academic data |
| Campus map cmapjson suite | 🔒 forbidden (all 8 files) |
| Gym live cams | ✅ live, the survivor |
| Official UF API gateway / developer portal | ❌ dead (does not exist) |

## Built for Gradvisr

This catalog was assembled to power [Gradvisr](https://github.com/RSCAV), an AI degree planner for UF students. Each academic endpoint maps to a planning capability:

- **Course catalog, descriptions, and prerequisites** come from the SOC Schedule API and the CourseLeaf bulk per-subject pages. The raw `prerequisites` text feeds the prereq-graph parser; the CourseLeaf `showCourse()` links give machine-extractable prerequisite edges.
- **Degree-requirement structure** (requirement buckets, model semester plans, critical tracking, total credits) comes from the CourseLeaf program pages. There is no JSON degree feed, so these are parsed from stable `sc_courselist` and `plangrid` HTML.
- **Gen-ed and Quest requirement satisfaction** comes from the per-section `genEd[]`, `quest[]`, and `grWriting` fields in the SOC response. These are clean enough to drive a requirement engine without NLP.
- **Term availability and offering history** come from crawling the SOC feed per term, using the filters endpoint for the authoritative term and department lists. Recording which terms a course appears in is the planner's sequencing intelligence.
- **Course difficulty** comes from the UF OIPR grade distributions (objective: average GPA, percent A, withdrawal rate) blended with RateMyProfessors (per-instructor difficulty, joined on the SOC instructor name).
- **Drop/add and withdrawal deadlines** come from the per-section `dropaddDeadline` in SOC plus the CourseLeaf dates-and-deadlines pages for the dates SOC does not carry.

What the API cannot do for the planner: live seat availability and schedule-conflict detection. Those fields are dead. Treat them as a product constraint, not a bug.

## SDK (recommended)

One client over every UF source, with caching and polite rate limiting built in. Source in [`src/`](./src):

```ts
import { createClient } from "uf-api";

const uf = createClient();                                  // optional: { cache, userAgent, minDelayMs, timeoutMs }

const filters = await uf.soc.filters("2268");               // 49 terms, 203 departments
const courses = await uf.soc.schedule({ term: "2268", dept: "19050000" });
const offered = await uf.soc.offeredIndex(["2261", "2265", "2268"]); // which seasons each course runs

const prof = await uf.professors.resolve("Nicholas Napoli", "EEL3135");
const tier = uf.professors.difficultyTier(prof!.avgDifficulty, prof!.numRatings); // "easy" | "medium" | "hard"

const course = await uf.catalog.course("EEL3135");          // description + machine-extractable prereq edges
```

```bash
npm install
npm run demo        # drives all three services through one client
npm run discover    # auto-discovers UF's apix surface (the bundle-grep tactic, in code)
```

Services: `uf.soc` (Schedule of Courses), `uf.professors` (RateMyProfessors), `uf.catalog` (CourseLeaf). Responses are cached by volatility (filters and descriptions for days, professor ratings for a week), and all requests share one rate limiter.

## Single-file clients

Prefer to copy one file with no SDK? Three dependency-free clients in [`clients/`](./clients) wrap the same endpoints standalone (Node 20+, `tsx`):

| Client | What it does | Run |
|---|---|---|
| `soc-client.ts` | Schedule of Courses: `fetchFilters` (terms + departments), `fetchSchedule` (paged via `last-control-number`), `buildOfferedIndex` (which seasons a course runs), term-code decoding | `npm run soc` |
| `rmp-client.ts` | RateMyProfessors: resolve a UF instructor by name, disambiguate by courses taught, map `avgDifficulty` to an easy/medium/hard tier | `npm run rmp "Cheryl Resch" COP3530` |
| `courseleaf-client.ts` | UF Catalog: fetch a course's official description and prerequisites, with machine-extractable prereq edges from `showCourse()` links | `npm run courseleaf EEL3135` |

```bash
npm install
npm run soc          # -> 49 terms, 203 departments, a sample Fall 2026 course
```

Each client documents its responsible-use rules inline (public/unauth only, cache hard, no looping). The full how-they-were-found writeup is in [DISCOVERY-METHOD.md](./DISCOVERY-METHOD.md).

## Responsible use

Everything here is public and unauthenticated. These endpoints are undocumented, unofficial, and may change without notice. Cache aggressively, refresh on a schedule, page sequentially, and never deep-crawl or harvest. Do not attempt to access auth-walled student-data services, and do not try header or User-Agent evasion on blocked paths. Anything built on these endpoints should carry a visible disclaimer that the data is sourced from UF's public web, not an official feed. See the Responsible Use section of [ENDPOINTS.md](./ENDPOINTS.md) for the full guidance.

## License

MIT, matching the spirit of the original project. Course data and content belong to the University of Florida and the respective third parties.
