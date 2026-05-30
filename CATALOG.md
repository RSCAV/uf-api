# UF Endpoint Catalog — Breadth Discovery 2026

> Auto-generated from the live multi-agent discovery sweeps (`discovery/*.json`). The wide map; curated badge-annotated subset in [ENDPOINTS.md](./ENDPOINTS.md); working clients in [`src/`](./src).

Liveness: ✅ live · 🔒 forbidden/auth · ❌ dead · ⚠️ unknown. Planner relevance: 🎯 core · ➕ enrichment · 🏛 heritage · · none.


**Totals:** 9 surfaces, 70 live endpoints (plus the apix gateway).

---


## ONE.UF `apix` gateway (from `discover.ts`)

Automated bundle-grep: **10 paths** / **7 public services** + **15 login-gated features**.


| Service | Paths |
|---|---|
| `/apix/featuretoggle/` | `/apix/featuretoggle/checkfeaturetoggle/`, `/apix/featuretoggle/checkfeaturetoggle/displayStaticCard` |
| `/apix/login/` | `/apix/login/getadmissionlink` |
| `/apix/logout/` | `/apix/logout` |
| `/apix/maintenance/` | `/apix/maintenance/getmaintenancetime/` |
| `/apix/response-cache/` | `/apix/response-cache/` |
| `/apix/search/` | `/apix/search/all/`, `/apix/search/getpubliclists` |
| `/apix/soc/` | `/apix/soc/filters`, `/apix/soc/schedule` |

---

## UF Catalog CourseLeaf (catalog.ufl.edu) — full Ribbit + program/course/sitemap API surface

**Host:** `catalog.ufl.edu` — 9 endpoints, 8 live


Mapped the entire CourseLeaf (Leepfrog) API for the 2026 catalog. The Ribbit CGI gateway lives at /ribbit/index.cgi and serves XML-with-CDATA fragments. Three live ?page=*.rjs endpoints confirmed: getcourse.rjs (course description + Attributes/gen-ed flags + prereq edges as <a> links — VERIFIED LIVE), getcourseeco.rjs (a REVERSE INDEX: course code -> every degree program that requires it, each as a fully-qualified /UGRD/colleges-schools/<COLLEGE>/<PROGRAM>/ URL — major new discovery, builds the course->program graph for free), and getprogram.rjs (live <programinfo> XML envelope but UF does not populate it via page-code params; program data is fully server-rendered into the HTML pages instead…


**New discoveries:**

- getcourseeco.rjs is a course->program REVERSE INDEX never touched by the 2022 uf_api repo: given a course code it returns every degree program referencing it, each as a fully-qualified /UGRD/colleges-schools/<COLLEGE>/<P…

- getcourse.rjs requires the SPACE form code (COP%203530); the no-space form (COP3502) silently returns an empty <courseinfo/> envelope. This is the #1 integration gotcha and likely why naive callers think the endpoint is …

- getcourse.rjs Attributes field carries gen-ed / Quest / writing-requirement flags verbatim (e.g. 'General Education - Social Science, Satisfies 2000 Words of Writing Requirement') — directly usable for Gradvisr's gen-ed …

- /sitemap.xml is a complete 785-URL master index (568 program pages + 138 subject course pages) with per-page lastmod dates — the canonical crawl seed and incremental-sync driver.

- Each /UGRD/courses/<subject>/ subject page returns ALL courses for that subject in one request with prereq edges already encoded as <a class='bubblelink code' onclick=showCourse(this,'DEPT NNNN')> — bulk prereq-graph ext…

- Program pages carry TWO complementary requirement tables: sc_plangrid (ordered semester plan with Critical-Tracking/Quest/State-Core annotations inline) and sc_courselist (formal requirement groups with or-alternatives, …


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| Ribbit getcourse.rjs (course detail + prereqs + gen-ed fla… | GET | ✅ | – | 🎯 core | Primary single-course fetch: description, credits, grading scheme, prerequisite EDGES… |
| Ribbit getcourseeco.rjs (course->program reverse index) | GET | ✅ | – | 🎯 core | NEW DISCOVERY — builds the course->degree reverse graph: given a course, returns ever… |
| Ribbit getprogram.rjs (program info envelope) | GET | ✅ | – | 🏛 heritage | Route exists but returns no data on UF's install — do NOT rely on it. Get degree requ… |
| Ribbit getcourselist.rjs / getplan.rjs / getsection.rjs / … | GET | ❌ | – | · none | None — do not use. Section/term data comes from the ONE.UF Schedule-of-Courses API, n… |
| Course catalog sitemap (master crawl seed) | GET | ✅ | – | 🎯 core | The canonical enumeration of every catalog page. Partition into program vs subject UR… |
| Subject course bulk page (all courses for a subject) | GET | ✅ | – | 🎯 core | PRIMARY bulk ingest for descriptions + prereq edges + gen-ed flags. 138 requests cove… |
| Program/degree requirement page (plangrid + courselist) | GET | ✅ | – | 🎯 core | PRIMARY degree-requirement source. sc_courselist = the structured requirement DAG (gr… |
| Catalog search results (/search/?P=) | GET | ✅ | – | ➕ enrich | This is the href target behind every prereq <a> link (bubblelink code -> /search/?P=C… |
| CourseLeaf JS bundle (API discovery source) | GET | ✅ | – | 🏛 heritage | Reference only — documents how the catalog builds Ribbit calls (the SPACE-form code r… |

**How to use:** SDK recipe for Gradvisr. (1) DISCOVERY: GET https://catalog.ufl.edu/sitemap.xml -> parse <loc>+<lastmod>; partition into program pages (/UGRD/colleges-schools/) and subject course pages (/UGRD/courses/). Use lastmod to drive incremental re-sync. (2) COURSES + DESCRIPTIONS + PREREQ EDGES + GEN-ED FLAGS (bulk, preferred): for each of the 138 subject pages GET /UGRD/courses/<subject>/, parse every div.courseblock — p.courseblocktitle (code+title+span.credits), p.courseblockdesc (description), p.courseblockextra containing 'Grading Scheme'/'Prerequisite'/'Attributes'. Prereq edges = every <a class='bubblelink code'> inside the Prerequisite paragraph (the onclick showCourse(this,'DEPT NNNN') gives the canonical SPACE-form target code); also parse the surrounding boolean text ('(A or B) and C, minimum grade of C') for AND/OR logic and grade mins. Attributes text carries gen-ed/Quest/writing fl…


---

## RateMyProfessors GraphQL — full introspection + depth

**Host:** `https://www.ratemyprofessors.com/graphql` — 9 endpoints, 8 live


Introspection is ENABLED (not disabled) — full __schema/__type queries return live, this run, against https://www.ratemyprofessors.com/graphql. Single POST endpoint, Relay-style GraphQL. queryType exposes 6 root fields: newSearch, node, oauthURL, spammedTeachers, teacherTags, user. The two surfaces Gradvisr needs are newSearch (search teachers/schools within UF) and node(id) (fetch any Teacher/School/Rating by global Relay ID). AUTH: the well-known header Authorization: Basic dGVzdDp0ZXN0 (base64 of test:test, a hardcoded public client constant baked into RMP's own frontend bundle) is what every public guide uses — BUT I verified this run that data queries (node, __typename) succeed even WIT…


**New discoveries:**

- Introspection is ENABLED on RMP's production GraphQL (most public guides assume it's off and rely on hardcoded queries) — __schema and __type(name) both return full field/inputField/arg maps live. The SDK can self-discov…

- The Authorization: Basic dGVzdDp0ZXN0 header is NOT actually required for data — node() and __typename returned HTTP 200 with real data WITHOUT it this run. It is base64('test:test'), a vestigial public client constant. …

- Teacher.ratings supports a courseFilter:String argument (a UF course code) that the 2022 uf_api repo era tooling rarely used — lets Gradvisr pull ONLY the reviews for the exact course a student is planning, instead of al…

- Teacher.courseCodes{courseName,courseCount} exposes the real UF course codes a professor has been rated for (JPT3500, IDS2935, JPN4956...) with frequency counts — a free teaching-history signal to map instructors to cour…

- ratingsDistribution{r1,r2,r3,r4,r5,total} gives the full 1-5 star histogram per professor (not just the average) — enables a confidence/variance signal in the planner instead of a single avg.

- School.departments[] returns a clean ~50-entry UF department taxonomy with stable integer ids (Accounting=1, Computer Science=11) usable as departmentID to scope teacher searches.


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| graphql.__schema introspection | POST | ✅ | – | ➕ enrich | Schema discovery — lets the SDK auto-validate query shape and detect when RMP changes… |
| newSearch.schools (find UF school ID) | POST | ✅ | – | 🎯 core | One-time lookup to hardcode UF school id (U2Nob29sLTExMDA=). All teacher searches sco… |
| newSearch.teachers (search UF prof by name) | POST | ✅ | – | 🎯 core | Primary lookup: map an instructor name (from SOC sections) to an RMP Teacher node id … |
| node(id) on Teacher (full detail) | POST | ✅ | – | 🎯 core | The instructor-quality record: overall quality/difficulty/would-take-again, star dist… |
| Teacher.ratings (paginated reviews) | POST | ✅ | – | 🎯 core | Per-course student reviews with text, difficulty, helpfulness, self-reported grade, a… |
| node(id) on School (UF quality + departments) | POST | ✅ | – | ➕ enrich | departments[] gives a clean UF department taxonomy (id+name) usable to scope teacher … |
| Teacher.relatedFullTeachers / relatedTeachers | POST | ✅ | – | ➕ enrich | Suggest alternative instructors teaching similar/same UF courses (same department) — … |
| teacherTags (global tag catalog) | POST | ✅ | – | ➕ enrich | Reference dictionary of all possible tag names to normalize/parse the '--'-delimited … |
| spammedTeachers / user / oauthURL (root queries) | POST | ⚠️ | 🔒 | · none | None — these are account/moderation surfaces, not course/instructor data. Listed for … |

**How to use:** All calls are POST https://www.ratemyprofessors.com/graphql with headers: Content-Type: application/json and Authorization: Basic dGVzdDp0ZXN0 (optional but recommended — it is base64('test:test'), a public constant; omit it and queries still work). Body is {"query": "...", "variables": {...}}.  RECIPE 1 — Find UF school ID (one-time, hardcode result): query SchoolSearch($q: SchoolSearchQuery!){ newSearch{ schools(query:$q){ edges{ node{ id legacyId name city state } } } } } with variables {"q":{"text":"University of Florida"}}. Returns id "U2Nob29sLTExMDA=" / legacyId 1100. Hardcode this; never re-query.  RECIPE 2 — Search a UF professor by name: query TeacherSearch($q: TeacherSearchQuery!){ newSearch{ teachers(query:$q, first:5){ edges{ cursor node{ id legacyId firstName lastName avgRatingRounded avgDifficultyRounded numRatings wouldTakeAgainPercentRounded department school{ id name } …


---

## UF Directory (directory.ufl.edu / phonebook.ufl.edu) + GatorEvals official course-evaluation public results (gatorevals.aa.ufl.edu)

**Host:** `directory.ufl.edu, phonebook.ufl.edu, gatorevals.aa.ufl.edu, public.tableau.com` — 8 endpoints, 6 live


Two distinct surfaces. (1) UF DIRECTORY is a server-rendered Java/JSP app (jsessionid in URLs), NOT a JSON API. Public people search = POST (also accepts GET-with-params but GET without POST returns the empty form) to /directory/SearchPerson with firstName/lastName/email/auth. auth=false returns Faculty+Staff with NO login (verified live: returned Dobson records with name, phone, email, dept). auth=true requires GatorLink SSO (adds students) — out of scope. Results are HTML 'list-card' blocks (name, phone, email, opaque detail link). Following the detail link (/directory/indv/<token>/<idx>) yields name + affiliation type ('Staff'/'Faculty') + Department (e.g. 'RE-HUB') + email + phone. This …


**New discoveries:**

- UF Directory exposes a NO-LOGIN Faculty/Staff search via POST /directory/SearchPerson with auth=false — the 2022 uf_api repo never covered this; it's a clean instructor-name -> {ufl.edu email, department, faculty/staff f…

- Directory is a server-rendered JSP app (jsessionid), not JSON: GET on /SearchPerson without form POST returns the empty form (size 34148); you MUST POST (or GET with the firstName/lastName/auth params) to get list-card r…

- Individual detail pages /directory/indv/<token>/<index> carry the Department field and the Faculty-vs-Staff affiliation in the h1, enabling 'J. Smith' disambiguation across SOC sections.

- GatorEvals public-results is NOT a bespoke API — it's a Tableau Public embed of workbook 'GatorEvalsTableauPublic3TermstoFall2025' (author john.j6434).

- Tableau Public's metadata API (public.tableau.com/profile/api/workbook/<name>) returns JSON and exposed a HIDDEN raw-data sheet 'GatorEvals Public Data' alongside the visible dashboard — that sheet is the extraction targ…

- Official UF eval scores ARE machine-extractable (via Tableau bootstrapSession / the open-source tableauscraper lib), giving Gradvisr an institutional difficulty/quality signal to complement RateMyProfessors — but it's a …


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| Directory People Search (Faculty/Staff, public) | POST (also GET w/ query params) | ✅ | – | 🎯 core | Resolve SOC instructor names -> official ufl.edu email + faculty/staff flag; the cano… |
| Directory Individual Detail (dept/title/affiliation) | GET | ✅ | – | 🎯 core | Get an instructor's home department + faculty-vs-staff classification to disambiguate… |
| Directory People Search (auth=true, full incl. students) | POST | 🔒 | 🔒 | · none | Do NOT use — student data behind SSO; auth=false already covers all instructors (facu… |
| phonebook.ufl.edu (legacy host) | GET | ✅ | – | 🏛 heritage | Legacy alias — always hit directory.ufl.edu directly; phonebook just redirects. |
| GatorEvals Public Results page (Tableau embed shell) | GET | ✅ | – | ➕ enrich | Discovery anchor — tells you the exact Tableau Public workbook holding official UF ev… |
| Tableau Public Workbook Metadata API (GatorEvals) | GET | ✅ | – | ➕ enrich | Cheap freshness/version check (lastUpdateDate) and confirms the hidden raw-data sheet… |
| GatorEvals raw data sheet (Tableau bootstrapSession) | GET view then POST bootstrap | ✅ | – | ➕ enrich | OFFICIAL UF course-evaluation scores per course/instructor/term — the institutional c… |
| Tableau Public direct CSV export (GatorEvals) | GET | 🔒 | – | · none | Don't rely on it — use the bootstrapSession/tableauscraper path instead. |

**How to use:** DIRECTORY instructor resolver (core for Gradvisr): To resolve a SOC instructor name to dept/email, POST https://directory.ufl.edu/directory/SearchPerson with form body `firstName=&lastName=<LAST>&email=&auth=false` (Content-Type application/x-www-form-urlencoded), UA Mozilla/5.0. Parse HTML for `<div class="list-card">` blocks: name is in the gray-box anchor ('Last, First M'), phone + email are labeled anchors, and the detail href `/directory/indv/<token>/<n>` (strip the `;jsessionid=...`). For department, GET https://directory.ufl.edu/directory/indv/<token>/<n> and parse the `heading-black-titles` h1 ('Name, Affiliation') + the `Department:` label's sibling value. Match SOC instructor names (which are 'Last, First' style) directly. Keep to a handful of requests; this is a JSP app, not a bulk API — cache results. GATOREVALS eval scores (enrichment): Step 1 GET https://public.tableau.com/…


---

## UF Libraries (uflib) — LibCal hours/spaces, Primo VE catalog search, LibGuides

**Host:** `libcal.uflib.ufl.edu (LibCal vanity for uflib.libcal.com) + ufl-flvc.primo.exlibrisgroup.c…` — 14 endpoints, 11 live


UF Libraries surface mapped and verified live. Two genuinely usable UNAUTHENTICATED JSON APIs the 2022 uf_api repo never covered: (1) LibCal hours via the UF vanity host libcal.uflib.ufl.edu (api_hours_today.php / api_hours_grid.php / api_hours_date.php, iid=6, all 17 location ids parsed, holiday-note aware) and (2) Primo VE public catalog search via ufl-flvc.primo.exlibrisgroup.com/primaws/rest/pub/pnxs (vid=01FALSC_UFL:UFL, no apikey, no JWT — returned 9825 real hits for 'organic chemistry' with full PNX records). The 'official' credentialed layers were all probed and confirmed walled: LibCal /api/1.1/ (403 OAuth), Ex Libris api-na Primo (UNAUTHORIZED apikey), LibGuides lgapi 1.2 (401 apik…


**New discoveries:**

- uflib.libcal.com is unreachable in sandbox DNS but the UF vanity CNAME libcal.uflib.ufl.edu serves the IDENTICAL LibCal backend (iid=6) — use it for all LibCal calls

- LibCal exposes THREE fully-open unauthenticated hours endpoints the 2022 uf_api repo never touched: api_hours_today.php, api_hours_grid.php (with weeks= and holiday 'note' fields), api_hours_date.php — all return clean J…

- Parsed all 17 UF library location ids in one call (Library West=7728, Marston Science=8622, Marston Makerspace=22838, Smathers=8625, Education=8627, Health Science Center=8871, Architecture/Fine Arts=8626, plus Jacksonvi…

- Primo VE public search REST (primaws/rest/pub/pnxs) is the big find: completely unauthenticated UF catalog discovery returning full PNX bibliographic records — 9825 local hits for 'organic chemistry' — no apikey, no JWT …

- Primo public configuration REST (primaws/rest/pub/configuration/vid/...) exposes valid scopes/tabs/query-fields so the SDK can build correct queries without guessing

- Confirmed the credential walls precisely: LibCal /api/1.1/ => 403 (OAuth), Ex Libris api-na Primo => UNAUTHORIZED (apikey), LibGuides lgapi-us.libapps.com 1.2 => clean 401 (apikey). The open widget/primaws layers fully s…


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| LibCal Hours Today (open, unauthenticated) | GET | ✅ | – | ➕ enrich | Real-time 'is the library open right now / today' for a where-to-study layer. 17 UF l… |
| LibCal Hours Grid (multi-week) | GET | ✅ | – | ➕ enrich | Weekly study-hours planner + holiday closure detection (note field surfaces 'Memorial… |
| LibCal Hours by Date | GET | ✅ | – | ➕ enrich | Hours for an arbitrary future date — 'will Marston be open the day my exam ends'. Lig… |
| LibCal Hours Grid Widget (alias) | GET | ✅ | – | ➕ enrich | Backup/alias of the grid endpoint; use api_hours_grid.php as primary. |
| LibCal Spaces Availability Grid (study-room booking grid) | POST | ✅ | – | ➕ enrich | Live study-room availability for the where-to-study layer. Recipe: scrape gid from th… |
| LibCal Calendar Events List (ajax) | GET | ✅ | – | ➕ enrich | Library workshops / research-skills events feed (low planner value). De-prioritize; t… |
| LibCal Equipment Availability Nextdate | GET | ✅ | – | · none | Equipment-loan availability. Not relevant to degree planning; skip. |
| LibCal v1.1 REST (documented Springshare API) — OAuth WALL… | GET | 🔒 | 🔒 | ➕ enrich | The richer official API (full space inventory, booking objects, calendar metadata) bu… |
| Primo VE Public Search (primaws/pnxs) — UNAUTH catalog dis… | GET | ✅ | – | ➕ enrich | Live, fully-unauthenticated UF catalog discovery. For a course like CHM2210, query th… |
| Primo VE Public Configuration REST | GET | ✅ | – | ➕ enrich | Read once to discover valid tab/scope/query-field values for the pnxs search (the sco… |
| Ex Libris Hosted Primo REST (api-na) — APIKEY WALLED | GET | 🔒 | 🔒 | ➕ enrich | The 'official' Primo API but requires an apikey. SKIP IT — the unauthenticated primaw… |
| LibGuides v1.2 API (lgapi-us) — APIKEY WALLED | GET | 🔒 | 🔒 | ➕ enrich | Subject research guides + databases-A-Z. Course-relevant ('research guide for ENC1101… |
| LibGuides Public Site (guides.uflib.ufl.edu) — scrapable H… | GET | ✅ | – | ➕ enrich | If course/subject research guides are wanted without an API key, scrape the public HT… |
| UF Libraries main site (uflib.ufl.edu) — hours/find portal | GET | ✅ | – | · none | Discovery hub only — gave us the Primo vid and the LibCal vanity host. Not a data API… |

**How to use:** SANDBOX DNS NOTE: uflib.libcal.com does NOT resolve here — use UF's vanity CNAME libcal.uflib.ufl.edu for ALL LibCal calls (identical Springshare backend, iid=6). Likewise generic primo.exlibrisgroup.com fails; use ufl-flvc.primo.exlibrisgroup.com.  TWO endpoints are the keepers (open, JSON, no auth): 1) LIBRARY HOURS (campus-life layer): GET https://libcal.uflib.ufl.edu/api_hours_today.php?iid=6&lid=0&format=json (all 17 locations, today) — or api_hours_grid.php?...&weeks=N for a week grid (holiday notes included), or api_hours_date.php?...&date=YYYY-MM-DD for one day. Filter one library with &lid=<id> (7728=Library West, 8622=Marston Science, 8625=Smathers). iid=6 is mandatory. 2) CATALOG SEARCH (find-this-book layer): GET https://ufl-flvc.primo.exlibrisgroup.com/primaws/rest/pub/pnxs?vid=01FALSC_UFL:UFL&tab=Everything&scope=MyInst_and_CI&q=any,contains,<urlencoded%20terms>&limit=10&of…


---

## Campus + Events + Transit (campusmap.ufl.edu, stars.facilities.ufl.edu, calendar.ufl.edu LiveWhale, Passio GO transit, recsports.ufl.edu + Connect2Concepts)

**Host:** `campusmap.ufl.edu (+ stars.facilities.ufl.edu, calendar.ufl.edu, passio3.com, recsports.uf…` — 13 endpoints, 12 live


Re-attacked the locked 2022 cmapjson endpoints and the rest of the campus/events/transit surface, all verified live this run. KEY CORRECTIONS to the 2022 uf_api picture: (1) The /library/cmapjson/*.json static files (dining/study/bus_stops/geo_buildings/aed) are PERMANENTLY DEAD — hard Apache 403 even with realistic browser UA + Referer (deny-all on the directory, not a WAF). (2) campusmap.ufl.edu is now an Angular SPA whose bundle revealed entirely new live backends. The data MOVED to two places: a building/room directory API at /library/api/searchBldg (4149 rows, 2789 buildings, each with LAT/LON — the gold for time-between-classes), and 60+ GeoJSON layer files at /assets/<name>.json (bus_…


**New discoveries:**

- campusmap.ufl.edu/library/api/searchBldg — undocumented building+room directory API, 4149 rows / 2789 buildings, each geocoded LAT/LON. Never in the 2022 uf_api repo. This is the single most useful thing found: it powers…

- The 2022 cmapjson/*.json files are not just blocked — the data RELOCATED to campusmap.ufl.edu/assets/*.json (60+ GeoJSON layers) under the new Angular SPA. Found by fetching main-es2015.js and grepping for asset/api path…

- campusmap.ufl.edu/assets/sidenav.json is a self-describing manifest listing every layer's FILENAME and category — a discovery index for the whole campus layer set.

- stars.facilities.ufl.edu/public/api/photos/photo?bldg=<code> returns a real public JPEG photo of any building keyed by the same BLDG code as searchBldg.

- UF events are on LiveWhale Calendar, NOT Localist (the brief's assumption). Localist /api/2/* 404s; the real feeds are calendar.ufl.edu/live/json|ical|rss/events. events.ufl.edu does not resolve.

- UF transit AVL is Passio GO, system id 3826 / username 'UniFlorida' (found via passio3.com getSystems). The non-obvious working signature is POST mapGetData.php with a json={...} form field — bare query params return 'er…


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| CampusMap searchBldg (building + room directory w/ lat-lon… | GET | ✅ | – | 🎯 core | THIS is the gold for 'time between back-to-back classes'. Map each section's building… |
| CampusMap layer assets (60+ GeoJSON FeatureCollections) | GET | ✅ | – | ➕ enrich | Enrichment layer for a campus-aware planner: place student amenities (libraries, comp… |
| CampusMap sidenav layer manifest | GET | ✅ | – | ➕ enrich | Self-describing manifest — fetch this first to discover every available campus layer … |
| CampusMap boundaries / parking_polys (large GeoJSON) | GET | ✅ | – | 🏛 heritage | Map-rendering polish only (draw campus footprint / parking zones). Not planner-critic… |
| STARS facilities public building photo | GET | ✅ | – | ➕ enrich | Show a real photo of each class building in the schedule/planner UI keyed by BLDG cod… |
| CampusMap legacy cmapjson static files (DEAD) | GET | 🔒 | – | 🏛 heritage | DO NOT USE. The 2022 uf_api cmapjson endpoints are permanently 403'd. Their data live… |
| UF Events — LiveWhale Calendar JSON feed | GET | ✅ | – | ➕ enrich | Surface UF events alongside the academic calendar (deadlines, athletics, group events… |
| UF Events — LiveWhale iCal feed | GET | ✅ | – | ➕ enrich | Drop-in iCal subscription for users who want UF events in their own calendar app; or … |
| UF Transit (Passio GO) — stops + routes | POST | ✅ | – | ➕ enrich | 67 geocoded UF shuttle stops on 3 named routes (Central/North-South/East-West). Combi… |
| UF Transit (Passio GO) — live vehicle positions | POST | ✅ | – | 🏛 heritage | Real-time bus AVL. Low planner value (only useful day-of, and empty during breaks/sum… |
| Passio GO system directory (getSystems) | GET | ✅ | – | 🏛 heritage | Discovery only — confirms UF system id 3826. Hardcode 3826 in the SDK; no need to re-… |
| RecSports gym occupancy (Connect2Concepts / goboardapi) | GET | ✅ | – | ➕ enrich | Live real-time gym/pool crowding (% capacity) for SWRC, Southwest, Lake Wauburg, etc.… |
| RecSports live gym cameras | GET | ✅ | – | 🏛 heritage | Live gym webcams (8 feeds). Pure student-life flavor — pair with the occupancy JSON f… |

**How to use:** CORE recipe (time-between-classes): GET https://campusmap.ufl.edu/library/api/searchBldg?q=x with a desktop browser User-Agent and Referer https://campusmap.ufl.edu/ -> get full array of {BLDG, NAME, ABBREV, LAT, LON}; build a {ABBREV/BLDG -> (LAT,LON)} lookup. For each pair of consecutive sections in a student's schedule (building from ONE.UF soc), haversine the two LAT/LONs, divide by ~1.4 m/s walk speed, flag tight transitions. Optionally route via shuttle: POST https://passio3.com/www/mapGetData.php form-encoded with json={"s0":"3826","sA":1}&getStops=2 -> nearest stop to each building by lat/lon, same route -> shuttle option. ENRICHMENT layers: GET https://campusmap.ufl.edu/assets/sidenav.json once to enumerate layer filenames, then lazy GET https://campusmap.ufl.edu/assets/<filename>.json (GeoJSON) for libraries/dining/printers/rec near class buildings. Building photo: GET https://…


---

## ONE.UF SOC deep (apix/soc) — definitive query reference + satellite services

**Host:** `one.uf.edu` — 5 endpoints, 3 live


Exhausted the ONE.UF Schedule-of-Courses surface live (2026-05-30, term Spring 2026 = 2261). There are exactly TWO data-bearing SOC endpoints — /apix/soc/filters (dictionaries) and /apix/soc/schedule (the course/section list) — both public, unauthenticated, GET, JSON, returning 200 this run. Every other /apix/soc/* subpath (courses, section, syllabus, prereqs, etc.) is 404. The canonical query-param vocabulary was extracted directly from the SOC SPA bundle (one.uf.edu/soc/soc.59d5c440492d70a0ad41.min.js) and then each param was tested live against a baseline of TOTALROWS=4622 to prove which actually filter in 2026. KEY CORRECTION vs the 2022 uf_api repo and common assumptions: boolean flags …


**New discoveries:**

- BOOLEAN FILTER VALUE = `true` (not `on`/`1`): every gen-ed/writing/online/day/eep/elal/ai/auf flag is silently ignored unless its value is exactly `true`; with `=on` the API returns the full unfiltered set (baseline 4622…

- GE param names are ge-b/ge-c/ge-h/ge-m/ge-n/ge-p/ge-s (extracted from bundle), NOT a single ge=B param. ge-d is defined in the label map (Diversity) but returns 0 rows in 2026. Live narrowing confirmed: ge-c=11, ge-h=63,…

- Writing flags are wr-2000 / wr-4000 / wr-6000 (words), NOT writing-2/4/6. They are real bools and filter (wr-4000=true & dept=English -> 0, i.e. applied) but are sparse.

- Quest flags are qst-1..qst-4 (=true); qst-1&prog-level=UGRD -> 2468 (QUEST 1 is broad).

- Credits use credits=<n> + cred-srch=EQ|LE|GE (uppercase). credits=4&cred-srch=EQ -> 869, credits=2&cred-srch=LE -> 1843. Confirmed catalog-level band via level-min=3000&level-max=3999 -> 684.

- Pagination is cursor-style: page size 50; response returns LASTCONTROLNUMBER which you pass back as last-control-number for the next page (NOT a simple offset that auto-increments — you must echo the server's value).


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| SOC schedule (course/section list) | GET | ✅ | – | 🎯 core | Primary source for sections/terms, course descriptions, prerequisites (free-text edge… |
| SOC filters (dictionaries) | GET | ✅ | – | 🎯 core | Dept-code(8-digit)->name dictionary, full term-code list (history back to Fall 2018),… |
| response-cache/soc (+/filters +/schedule) | GET | ✅ | – | · none | Server-side cache-warm / session-prime only. Returns no data. Do not use. |
| SimpleSyllabus document (UF tenant) | GET | 🔒 | 🔒 | ➕ enrich | Use section.simpleSyllabusParams as structured metadata (which term/subject/catalog/s… |
| myschedule course-search (authenticated SOC twin) | GET | 🔒 | 🔒 | · none | Authenticated personalization variant of the public schedule endpoint. Out of scope (… |

**How to use:** CANONICAL SCHEDULE REQUEST: GET https://one.uf.edu/apix/soc/schedule?category=CWSP&term=<TERMCODE>&last-control-number=0  (no auth, no headers needed beyond a normal UA). Required: category + term + last-control-number. category values: CWSP (Campus/Web/Special — the default, use this), UFOL (UF Online), IA (Innovation Academy). TERMCODE from /apix/soc/filters terms[].CODE, e.g. 2261=Spring2026, 2268=Fall2026, 2265=Summer2026 (sub-terms: 22656W1=SummerA, 22656W2=SummerB, 22651=SummerC). PATTERN of the term code: 2 + last2-of-year + {1=Spring,5=Summer,8=Fall}. PAGINATION: response is an array with one object {COURSES:[], LASTCONTROLNUMBER, RETRIEVEDROWS, TOTALROWS}. Page size = 50. To page: take LASTCONTROLNUMBER from the response and pass it as &last-control-number=<that value>; stop when RETRIEVEDROWS<50 or you have TOTALROWS. WORKING FILTERS (verified live, all AND-combine): dept=<8-di…


---

## UF data frontiers — catalog.ufl.edu (CourseLeaf), programs/majors, IR data-apps, admissions, financial, GraphQL/REST probes, ArcGIS/campusmap

**Host:** `catalog.ufl.edu (+ one.ufl.edu, ir.aa.ufl.edu, data-apps.ir.aa.ufl.edu, uf.maps.arcgis.com…` — 15 endpoints, 11 live


Verified-live this run, the single highest-value NEW find is the CourseLeaf "ribbit" course API on catalog.ufl.edu: GET /ribbit/index.cgi?page=getcourse.rjs&subject=<PREFIX> returns ALL courses for a 3-letter subject prefix as XML, each <course code="..."> block containing title, credits, "Grading Scheme: Letter Grade", full description, AND the complete prerequisite expression rendered as clickable bubblelink anchors (onclick="showCourse(this,'COT 3100')") — i.e. clean prereq EDGES with embedded boolean logic ("(COP 3504 or COP 3503) and COT 3100 and (MAC 2234 or...), all with a minimum grade of C."). The 2022 Rolstenhouse/uf_api repo never touched this. The companion catalog program pages …


**New discoveries:**

- NEW (not in 2022 uf_api): CourseLeaf ribbit getcourse.rjs?subject=<PREFIX> on catalog.ufl.edu returns the ENTIRE course catalog per subject as XML with full descriptions, credits, grading scheme, AND prerequisite express…

- NEW: Catalog program pages (/UGRD/colleges-schools/{COLLEGE}/{MAJORCODE}/) embed <table class='plangrid'> degree-requirement grids = per-term required courses + credits + Total Credits + inline Gen-Ed/Quest/Critical-Trac…

- NEW: /UGRD/programs/ index yields the canonical undergraduate major/minor/cert code list (COLLEGE/MAJOR_DEGREE) + college taxonomy — the seed list for both the major picker and the plangrid crawl.

- NEW: /course-search/ enumerates all 372 UF subject prefixes — the iteration key to crawl the whole catalog via ribbit.

- CONFIRM: one.ufl.edu/apix/soc/filters/ enumerates categories (CWSP/UFOL/IA) + progLevels (UGRD/GRAD/LAW/MED) to parameterize the soc schedule API.

- Negative results (recorded, not evaded): my.ufl.edu/graphql=404, catalog/admissions GraphQL=none, dailyEnrollment + my.ufl.edu portal = UF Shibboleth SSO, ribbit getprogram.rjs returns empty for all guessed codes, UF Arc…


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| CourseLeaf ribbit getcourse (course catalog + prereq edges… | GET | ✅ | – | 🎯 core | Complete UF course catalog: descriptions, credits, grading scheme, AND prerequisite c… |
| CourseLeaf course-search subject index (all 372 prefixes) | GET | ✅ | – | 🎯 core | Enumerate every subject prefix to drive a full catalog crawl via the ribbit endpoint. |
| Catalog program/degree page (plangrid degree requirements … | GET | ✅ | – | 🎯 core | De-facto degree-requirements API: required courses per term, total credits, Critical … |
| Catalog programs/majors index (canonical major codes + col… | GET | ✅ | – | 🎯 core | Canonical UF undergraduate program list + codes (COLLEGE/MAJOR_DEGREE) — the major pi… |
| OneUF apix soc filters (term/category/level enumerator) | GET | ✅ | – | ➕ enrich | Bootstrap valid category/level/term values before calling apix/soc/schedule (sections… |
| OneUF apix soc schedule (sections + description) — confirm… | GET | ✅ | – | 🎯 core | Sections/terms/seats/instructors per course (Gradvisr already integrates soc; confirm… |
| IR data-apps public file tree (PBF/SUSF/accountability met… | GET | ✅ | – | 🏛 heritage | Excess-hours surcharge + graduation/retention methodology PDFs are useful context for… |
| IR accountability metrics page (links to UF performance/CD… | GET | ✅ | – | 🏛 heritage | Index of UF accountability/performance docs; low direct planner value, useful as inst… |
| UF Facts (IR) — embeds Tableau Public vizzes (enrollment/d… | GET | ✅ | – | 🏛 heritage | Enrollment & degrees-conferred aggregates exist but only via embedded Tableau Public;… |
| CourseLeaf ribbit getprogram (program XML) — DEAD code for… | GET | ⚠️ | – | · none | Not usable — the program XML endpoint returns empty for all guessed codes; get degree… |
| IR dailyEnrollment app (live enrollment by course) — SSO W… | GET | 🔒 | 🔒 | · none | Would give live per-course enrollment but is behind UF SSO — out of bounds. Use apix/… |
| campusmap building/search API (moved to internal host) | GET | ❌ | – | · none | Campus building data not reachable; low planner relevance anyway. |
| UF facilities photo API (campus building photos) | GET | ✅ | – | · none | Returns campus building photos given an id — irrelevant to academic planning. |
| UF ArcGIS Online org (uf.maps.arcgis.com) — campus GIS | GET | ✅ | – | · none | Campus geometry/GIS only; no academic data. Skip for Gradvisr. |
| my.ufl.edu /graphql probe | GET | ❌ | – | · none | No public GraphQL surface — the student portal is fully SSO-gated. |

**How to use:** CORE catalog pipeline (build the SDK on these two, both verified-live, no auth): 1) Subject list: GET https://catalog.ufl.edu/course-search/ -> regex /<option value="([A-Z]{2,3})"/ -> 372 subject prefixes. 2) Courses per subject: GET https://catalog.ufl.edu/ribbit/index.cgi?page=getcourse.rjs&subject=<PREFIX> (UA 'Mozilla/5.0 (research)'). Parse XML <courseinfo><course code="COP 3530"><![CDATA[ ...courseblock HTML... ]]>. From each block extract: .courseblocktitle (code + credits), .courseblockextra 'Grading Scheme', .courseblockdesc (description), and the 'Prerequisite:' .courseblockextra whose inner <a onclick="showCourse(this,'CODE')"> anchors ARE the prereq edges — capture the boolean text ("and"/"or"/"minimum grade of C") between anchors to preserve logic. ~372 cheap calls covers the entire UF course catalog with prereq graph. 3) Programs/majors list + codes: GET https://catalog.ufl…


---

## UF Transfer Course Equivalencies — "I took X elsewhere -> UF credit"

**Host:** `courses.flvc.org (FLVC / FloridaShines course-search backend, ASP.NET MVC + Web API, publi…` — 6 endpoints, 3 live


UF's own transfer-equivalency tool is Transferology (CollegeSource) — confirmed account-gated and AWS-WAF protected, NO public/unauth API (equivalency data is "provided by each institution itself", behind login). The Florida statewide SCNS site (flscns.fldoe.org) is the canonical equivalency authority but is network-unreachable from this environment (DNS resolves, TCP times out from curl/WebFetch/headless-browser egress — likely Florida-gov IP/geo firewalling, NOT an SSO wall). THE BIG WIN: FLVC/FloridaShines runs a fully PUBLIC, UNAUTHENTICATED JSON API at courses.flvc.org/api/* that I executed live. /api/Institutions returns all 117 Florida public institutions (UF = InstitutionId 29) and /…


**New discoveries:**

- courses.flvc.org/api/SectionSearch and /api/Institutions are PUBLIC, unauthenticated, key-less JSON endpoints returning SCNS-numbered course data for all 117 Florida public institutions including UF (InstitutionId 29) — …

- Florida equivalency reduces to a deterministic rule UF Admissions states itself: matching SCNS prefix + last-3-digits = equivalent course. Confirmed live: UF ENC 1101 and FAU ENC 1101 share prefix+number. This means the …

- UF's official tool Transferology (CollegeSource) is login + AWS-WAF gated — definitively NO public API. Rules it out as a programmatic source; it is a manual-fallback only.

- flscns.fldoe.org (the statewide SCNS authority) is public/no-login but network-unreachable from this sandbox (TCP timeout across curl/WebFetch/headless browser) — record as 'reachable from a real/FL host', not as a wall.

- The FLVC API is term-scoped (only returns courses with a published section in the queried term) — for a stable course catalog, query without term filter and cache; treat absence as 'no current section', not 'course does …

- Course detail endpoint /api/SectionSearch/{id} exposes CoursePrereqs text including Gordon Rule / Core Curriculum flags — directly useful for Gradvisr's prereq graph and writing/civic-literacy requirement detection.


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| FLVC Institutions list (school -> InstitutionId map) | GET | ✅ | – | 🎯 core | One-time cached lookup table to translate a student's stated source school into the I… |
| FLVC SectionSearch (statewide SCNS course search — the equ… | GET | ✅ | – | 🎯 core | THE core call. Resolve a source course's SCNS prefix+number, then re-query institutio… |
| FLVC Section/Course detail (prereqs, description, credits) | GET | ✅ | – | ➕ enrich | Pull prerequisite chains + course descriptions for matched courses — feeds Gradvisr's… |
| Course detail HTML (raw mode, same data as MVC view) | GET | ⚠️ | – | 🏛 heritage | Fallback if the JSON detail endpoint shape changes; otherwise unused. |
| UF Transferology (official UF transfer-equivalency tool — … | GET (UI); internal search is POST behind login | 🔒 | 🔒 | · none | This is UF's OFFICIAL answer to 'will my course transfer', but it is login + WAF gate… |
| Florida SCNS public course/equivalency search (statewide a… | GET (ASP.NET WebForms; 'Find A Course' -> Find an Institution / Find an Institution Course / Find a Statewide Course) | ⚠️ | – | 🎯 core | The authoritative equivalency source incl. historical/discontinued courses and facult… |

**How to use:** EQUIVALENCY ALGORITHM via the FLVC public API (no auth): (1) Student says "I took ENC 1101 at Miami Dade College." (2) GET https://courses.flvc.org/api/Institutions once, cache it — map school name -> InstitutionId (UF=29, MDC=present, all 117 FL public institutions). (3) GET https://courses.flvc.org/api/SectionSearch?keywords=ENC1101&institutions=<sourceId>&groupBy=Course to confirm the source course's exact SCNS prefix+number (CourseDept="ENC", CourseNo="1101"). (4) GET https://courses.flvc.org/api/SectionSearch?keywords=ENC1101&institutions=29&groupBy=Course — if UF returns a course with the SAME CourseDept+CourseNo, it is a direct statewide equivalent (UF Admissions' own rule: matching prefix + last-3-digits = equivalent). UF's ENC 1101 = "Expository and Argumentative Writing", 3 cr, CIP 23 — verified live. (5) For richer data (prereqs, description, credits) GET /api/SectionSearch/{S…


---

## UF OIPR grade distributions via Tableau Public (profile uf.oipr4918, workbook DegreesandGrades19) — per-course grade-letter distributions = Gradvisr difficulty signal

**Host:** `public.tableau.com (data) + ir.aa.ufl.edu (discovery/embed)` — 9 endpoints, 8 live


VERIFIED LIVE end-to-end. The UF IR grades page (ir.aa.ufl.edu/facts/grades/) embeds Tableau Public workbook DegreesandGrades19 (title "Grades 19", 32,911 views, lastUpdate 2025-08), authored by UF_OIPR under profile uf.oipr4918. Workbook has TWO sheets: UndergraduateGrades (chart) and UndergraduateGradesTable (display name "Undergraduate Grades Table" — the tabular data). The data is fully public/unauth and extractable via the standard Tableau Public 2-POST vizql sequence (bertrandmartel/tableau-scraping pattern), which I executed live via Playwright network capture. The bootstrapSession response (512KB) contains the entire grade table: thousands of course codes (AA0202, MAC2311-style 2-4 l…


**New discoveries:**

- Profile id is uf.oipr4918 (UF_OIPR), 77 visible public workbooks — a large untapped UF institutional-data catalog for Gradvisr beyond grades.

- The grades workbook is DegreesandGrades19 ('Grades 19'), workbookId 6327202, last updated 2025-08-06 (epoch 1754517615924). Older versions also public: DegreesandGrades17, DegreesandGrades10_30, DegreesandGrades.

- Two sheets in the workbook: UndergraduateGrades (chart) and UndergraduateGradesTable (the tabular data — display name 'Undergraduate Grades Table' with spaces, which is the sheet_id you POST).

- Coverage confirmed from live bootstrap: Fall 2014 through Fall 2024 term labels present, thousands of UF course codes, full grade-letter granularity (A,A-,B+,B,B-,C+,C,C-,D+,D,D-,E). Dimensions are deptname/grade/demo_ti…

- NO per-instructor granularity in this workbook — instructor-level difficulty must come from RateMyProfessor, not UF OIPR. Avg-GPA and withdrawal-rate are NOT stored columns; Gradvisr must compute them from the grade-lett…

- BREAKING 2026 CHANGE: Tableau Public's embed HTML tsConfigContainer textarea is now empty (session minted client-side by PreBootstrap.min.js). The classic static-HTML session scrape is dead; must use the startSession+boo…


| Endpoint | M | Live | Auth | Rel | Use |
|---|---|---|---|---|---|
| UF IR grades discovery page (Tableau embed source) | GET | ✅ | – | 🎯 core | Discovery anchor — confirms which Tableau workbook is the canonical UF grade-distribu… |
| Tableau Public single-workbook metadata API | GET | ✅ | – | 🎯 core | Enumerate the workbook's sheets and get lastUpdateDate to detect new-term refreshes; … |
| Tableau Public profile root metadata | GET | ✅ | – | ➕ enrich | Confirms the UF OIPR profile and total workbook count (77) for inventory scoping. |
| Tableau Public profile workbooks list | GET | ✅ | – | 🎯 core | Full UF OIPR data catalog — beyond grades, surfaces Graduation_RetentionRates, Degree… |
| Tableau vizql startSession (mint session id) | POST | ✅ | – | 🎯 core | STEP A of the 2-POST data extraction. Required because the 2026 Tableau Public no lon… |
| Tableau vizql bootstrapSession (returns the grade table da… | POST | ✅ | – | 🎯 core | STEP B — THE data payload. Carries the full per-course grade-letter distribution acro… |
| Tableau embed view shell (legacy inline-config path — NOW … | GET | ✅ | – | 🏛 heritage | Documents the 2026 breaking change: the classic bertrandmartel inline-config scrape n… |
| Tableau static preview image (sanity/coverage check) | GET | ✅ | – | 🏛 heritage | Cheap visual sanity-check that the workbook still renders; not a data source. |
| Profile workbooks (404 dead-end variants — do NOT use) | GET | ❌ | – | · none | Recorded as dead ends so the ingestion code uses the correct /public/apis/workbooks p… |

**How to use:** EXTRACTION RECIPE (verified-live). DISCOVERY: (1) GET ir.aa.ufl.edu/facts/grades/ → grep params: name='DegreesandGrades19/UndergraduateGrades', host_url='public.tableau.com'. (2) GET public.tableau.com/profile/api/workbook/DegreesandGrades19 → JSON lists profileName=uf.oipr4918 and the 2 viewInfos (sheetRepoUrl DegreesandGrades19/sheets/UndergraduateGrades + .../UndergraduateGradesTable). (3) GET public.tableau.com/profile/api/uf.oipr4918 → profile root (77 visible workbooks). (4) GET public.tableau.com/public/apis/workbooks?profileName=uf.oipr4918&start=0&count=50&visibility=NON_HIDDEN (count max 50, must page start=0 then start=50; visibility param REQUIRED) → full workbook inventory incl DegreesDashboard, Graduation_RetentionRates, EnrollmentHeadcount, GenEdCourses2, CourseManagementDrilldown. DATA EXTRACTION (the 2-POST vizql sequence): STEP A — POST https://public.tableau.com/vizql/…

