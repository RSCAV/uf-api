# UF API 2026 — Endpoint Catalog

A verified, public-only catalog of University of Florida web endpoints, re-checked live in 2026. This is the 2026 revival of [Rolstenhouse/uf_api](https://github.com/Rolstenhouse/uf_api) (stale since 2022). Every endpoint below was probed against live UF infrastructure and carries a 2026 liveness badge.

## Liveness badges

- ✅ **live** — verified returning real data in 2026
- ⚠️ **unknown** — host responds but no clean public data path confirmed
- 🔒 **forbidden** — exists but auth-walled or hard-blocked (403 / SSO)
- ❌ **dead** — returns 404 / empty / moved (documented so you do not chase it)
- 🆕 **NEW** — discovered in 2026, not present in the 2022 repo

> Term-code scheme (2026): `2 + YY + S` where `S` = 1 Spring, 5 Summer, 8 Fall. So `2261` = Spring 2026, `2265` = Summer 2026, `2268` = Fall 2026. Summer sub-terms append a suffix: `22656W1` = Summer A, `22656W2` = Summer B, `22651` = Summer C. Always pull the authoritative list from the SOC Filters endpoint; never hardcode.

---

## 1. Schedule of Courses (SOC) — the crown jewel

The live course/section/prerequisite feed. Note the host: the canonical base path is `one.ufl.edu/apix/soc/`. A live alias `one.uf.edu/apix/soc/` (the `l` dropped) was also observed serving the same data; prefer `one.ufl.edu` and add a liveness probe in case UF consolidates hosts.

### SOC Schedule — course/section search ✅ live

- **URL template:** `https://one.ufl.edu/apix/soc/schedule/?category=CWSP&term={TERM}&course-code={CODE}&last-control-number=0`
- **Method:** GET
- **Auth:** none (public, unauthenticated)
- **Params:**
  - `term` **(required)** — e.g. `2268`. Pull valid codes from `/apix/soc/filters`. A bare call with no `term`/filter returns HTTP 400.
  - `category` — `CWSP` (Campus/Web/Special, the default pool), `UFOL` (UF Online), `IA` (Innovation Academy, ~435 courses). **Largely vestigial in 2026**: CWSP/UFOL/HUR/RES all return the same ~4480-course pool; only `IA` differs. Older terms used `RES`.
  - `course-code` — **prefix/partial match** (`EEL31` returns EEL3111C, EEL3112, EEL3135). No space inside the code.
  - `dept` — real department filter, 8-digit code from the filters endpoint (e.g. `19050000` = ECE → 77 courses).
  - `last-control-number` — **the real pagination cursor.** Pass the response's `LASTCONTROLNUMBER` to get the next ~50 rows. ⚠️ The 2022-documented `last-row` param is now a **silent no-op** that loops page 1 forever.
  - Other filters present but flaky: `prog-level`, `ge`, `ge-b/c/d/h/m/n/p/s`, `day-m/t/w/r/f/s`, `days`, `credits`, `instructor`, `no-open-seats`, `level-min/max`, `writing`, `online-*`, `var-cred`.
- **Returns:** JSON array with one object:
  ```
  { COURSES:[...], LASTCONTROLNUMBER:int, RETRIEVEDROWS:int (<=50), TOTALROWS:int }
  ```
  `TOTALROWS` counts distinct course **codes** (4480 for Fall 2026), not sections. Each course: `code`, `courseId`, `name`, `description` (full catalog text), `prerequisites` (**free text** e.g. `"Prereq: MAC 2313 and (COP2271 or ...)."`), `openSeats` (**null**), `termInd`, `sections[]`. Each section: `number`, `classNumber` (5-digit registration #), `credits`/`credits_min`/`credits_max`, `genEd[]` (e.g. `["Composition"]`), `quest[]`, `grWriting`, `deptCode`/`deptName`, `instructors[].name`, `gradBasis`, `acadCareer`, `display`, `dropaddDeadline`, `pastDeadline`, `simpleSyllabusParams` (e.g. `"Fall 2026/EEL/3135/26214"`), `isStartDate45DaysOut`, `EEP`, `waitList{isEligible,cap,total}`, sometimes `isElal`/`elalAttr`. **`meetTimes[]` is ALWAYS empty; `finalExam` is always `""`; `openSeats` is always null.**
- **Example:**
  ```bash
  curl -s 'https://one.ufl.edu/apix/soc/schedule/?category=CWSP&term=2268&course-code=EEL3135&last-control-number=0'
  ```
  ```json
  [{"COURSES":[{"code":"EEL3135","courseId":"011714","name":"Introduction to Signals and Systems",
    "openSeats":null,"description":"Continuous-time and discrete-time signal analysis ...",
    "prerequisites":"Prereq: MAC 2313 and (COP2271 or COP2273 or ... or equivalent).",
    "sections":[{"number":"NAPP","classNumber":26214,"credits":4,"genEd":[],"quest":[],
      "deptCode":19050000,"deptName":"Electrical and Computer Engineering",
      "instructors":[{"name":"Nicholas Napoli"}],"meetTimes":[],"finalExam":"",
      "dropaddDeadline":"08/26/2026","simpleSyllabusParams":"Fall 2026/EEL/3135/26214",
      "waitList":{"isEligible":"N","cap":10,"total":10}}]}],
    "LASTCONTROLNUMBER":3184,"RETRIEVEDROWS":1,"TOTALROWS":1}]
  ```

> ⚠️ **REGRESSION (critical):** `openSeats`, `meetTimes` (days/time/building/room), and `finalExam` are now **universally null/empty across every term tested**. UF removed live seats and meeting times from the public SOC API since 2022. Only `waitList{cap,total}` survives as a coarse demand signal. **Do not build a live-seats or schedule-conflict feature on this endpoint.**

### SOC Summer Schedule (2022 dedicated summer endpoint) ❌ dead

- **URL:** `https://one.ufl.edu/apix/soc-summer/schedule/` (also tested `https://one.ufl.edu/apix/soc/soc-summer/schedule/`)
- **Method:** GET · **Auth:** none
- **Status:** Both spellings return **HTTP 404** (~165-byte error body, no JSON).
- **Why it is here:** Summer folded into the main `/apix/soc/schedule/` endpoint via summer term codes (`2265`, sub-terms `22656W1`/`22656W2`/`22651`). Request summer offerings from the main endpoint exactly like fall/spring. Documented dead so the revived docs steer users to the unified endpoint.

---

## 2. SOC Metadata / Filters

### SOC Filters — term / department / category / progLevel lookup tables 🆕 ✅ live

- **URL:** `https://one.ufl.edu/apix/soc/filters/?term=2268` (also works with no params: `https://one.ufl.edu/apix/soc/filters`)
- **Method:** GET · **Auth:** none
- **Params:** `term` optional (optionally `?category=&term=` to scope departments). Bare call returns the global lists.
- **Returns:** a JSON object with four arrays:
  - `categories[]` — `{CODE,DESC}`: `CWSP` = "Campus / Web / Special Program", `UFOL` = "UF Online Program", `IA` = "Innovation Academy".
  - `progLevels[]` — `{CODE,DESC}`: `UGRD`, `GRAD`, `LAW`, `MED`, `PHM`, `PA`, `PROF`, `VEM`.
  - `terms[]` — `{CODE,DESC,SORT_TERM}`: full active term list back to Fall 2018 (`2188`), including summer sub-terms (`22656W1` = Summer A, etc.). `SORT_TERM` collapses split summers to the base summer code.
  - `departments[]` — `{CODE,DESC}`: ~200-243 entries; `CODE` is an 8-digit numeric string (e.g. `19140000` = CISE, `19050000` = ECE, `17030000` = "Accounting, Fisher School of").
- **Example:**
  ```bash
  curl -s 'https://one.ufl.edu/apix/soc/filters/?term=2268'
  ```
  ```json
  { "categories":[{"CODE":"CWSP","DESC":"Campus / Web / Special Program"},
                  {"CODE":"UFOL","DESC":"UF Online Program"},
                  {"CODE":"IA","DESC":"Innovation Academy"}],
    "progLevels":[{"CODE":"UGRD","DESC":"Undergraduate"}, ...],
    "terms":[{"CODE":"2268","DESC":"Fall 2026","SORT_TERM":2268},
             {"CODE":"22656W1","DESC":"Summer A 2026","SORT_TERM":2265}, ...],
    "departments":[{"CODE":"19140000","DESC":"Computer & Information Science & Engineering"}, ...] }
  ```

> 🆕 **This endpoint is the catalog-crawl bootstrap.** It replaces the now-dead standalone `/apix/soc/terms`. Hit it once per refresh cycle to seed term codes, department codes, and valid enums. Always read codes from here; naming drifted since 2022 (`UFOL` not `UFO`, `CWSP` replaced `RES`).

### SOC Terms (2022-era standalone) ❌ dead

- **URL:** `https://one.ufl.edu/apix/soc/terms`
- **Method:** GET · **Auth:** none
- **Status:** **HTTP 404** (~153-byte HTML). Term data now lives only inside `/apix/soc/filters`.

### Standalone metadata sibling paths (probed, all dead) ❌ dead

- **URLs:** `https://one.ufl.edu/apix/soc/{terms|departments|categories|programs|genEds|attributes|instructors}` and `https://one.ufl.edu/apix/soc/schedule/categories`
- **Status:** **HTTP 404** for every guessed sibling. UF consolidated all metadata into `/apix/soc/filters`. Gen-ed labels come from `schedule.genEd[]`; instructors from `schedule.sections[].instructors[]`. There is exactly **one** metadata endpoint. Documented dead so ingestion code does not waste calls probing them.

---

## 3. apix Gateway — infrastructure services

`apix` is a single API gateway fronting the ONE.UF SPA. There is no public index, openapi.json, or swagger (all 404). The only public, unauthenticated, non-SOC services are infrastructure-level and carry no academic data, but they round out the gateway map.

### ONE.UF Public Service Catalog 🆕 ✅ live

- **URL:** `https://one.ufl.edu/apix/search/getpubliclists`
- **Method:** GET · **Auth:** none
- **Returns:** array of service groups `{title, icon, description, login, items[]}`, where `login` ∈ `{student, applicants, staff}` and `items[]` map feature names to ONE.UF URLs (`/soc`, `/myschedule`, `/transcript`, `/degreeaudit`).
- **Example:**
  ```bash
  curl -s 'https://one.ufl.edu/apix/search/getpubliclists'
  ```
  ```json
  [{"title":"Students","login":"student","items":[
    {"title":"Find courses currently being offered","url":"/soc"},
    {"title":"Monitor your academic progress","url":"/degreeaudit"}]}]
  ```
- **Why it matters:** the human-readable map of every ONE.UF feature and its required login tier. This is how you confirm `degreeaudit`/`transcript`/`myschedule` exist (and are student-auth-walled) without probing them.

### ONE.UF Global Search ✅ live (thin)

- **URL:** `https://one.ufl.edu/apix/search/all/?query=computer`
- **Method:** GET · **Auth:** none
- **Returns:** `{tasks:[]}` — searches ONE.UF UI tasks/links, not the catalog. Public view is thin (often empty); richer results are auth-gated. **Not useful for academic data.**

### Maintenance Window 🆕 ✅ live

- **URL:** `https://one.ufl.edu/apix/maintenance/getmaintenancetime/`
- **Method:** GET · **Auth:** none
- **Returns:** `{hasMaintenanceTime:bool, url:string, maintenanceDesc:string}`.
- **Example:** `{"hasMaintenanceTime":false,"url":"","maintenanceDesc":"An unexpected error has occurred. Please check back later."}`
- **Use:** optional ops signal — poll before a scheduled SOC ingest to skip runs during ONE.UF maintenance. Treat `hasMaintenanceTime=false` as all-clear.

### Feature Toggle Check 🆕 ✅ live

- **URL:** `https://one.ufl.edu/apix/featuretoggle/checkfeaturetoggle/{toggleName}` (e.g. `displayStaticCard`)
- **Method:** GET · **Auth:** none
- **Returns:** bare JSON boolean (`true`/`false`). Gates ONE.UF UI flags. Useful only as a gateway liveness ping.

### Response Cache passthrough 🆕 ✅ live

- **URL:** `https://one.ufl.edu/apix/response-cache/{key}` (e.g. `/apix/response-cache/soc`)
- **Method:** GET · **Auth:** none
- **Returns:** HTTP 200, server-side cached payload, key-dependent. Opaque cache semantics — do not depend on it; hit `/apix/soc/schedule` directly. Documented for completeness.

### Admissions Status Link 🆕 ✅ live

- **URL:** `https://one.ufl.edu/apix/login/getadmissionlink`
- **Method:** GET · **Auth:** none
- **Returns:** a JSON string URL: `"https://admissions.ufl.edu/apply/check-status"`. Pre-auth applicant redirect only.

### Student-data services (auth-walled) 🔒 forbidden

These ONE.UF features exist (confirmed via the public service catalog) but their `apix` routes live in lazy-loaded JS chunks behind UF Shibboleth/Gatorlink SSO. Guessed `/apix/<name>/` roots all return 404 — a routing artifact of the SSO-gated SPA, **not** proof of absence. **Do not attempt access.**

| Feature | ONE.UF URL | Returns | Note |
|---|---|---|---|
| Degree Audit | `https://one.ufl.edu/degreeaudit` | Per-student degree progress | `/apix/degreeaudit/` and `/apix/soc/degree-audit/` both 404 unauth |
| Transcript / Final Grades | `https://one.ufl.edu/transcript` | Per-student grades | `/apix/transcript/`, `/apix/grades/` 404 unauth |
| My Schedule / Registration | `https://one.ufl.edu/myschedule` | Enrolled schedule, holds, financial aid | `/apix/myschedule/`, `/apix/registration/`, `/apix/holds/`, `/apix/financialaid/` 404 unauth |

> For a public planner, source degree requirements from the public UF Catalog (below), not from `degreeaudit`. A student's own transcript could power a user-driven, authenticated import flow, but never a scrape.

---

## 4. UF Catalog (catalog.ufl.edu) — Leepfrog CourseLeaf CMS 🆕

Course descriptions, prerequisites, and degree/program requirements. This entire subsystem is net-new (the 2022 repo had zero catalog.ufl.edu coverage). CMS confirmed as Leepfrog CourseLeaf; hosted mirror at `ufl-public.courseleaf.com`.

### CourseLeaf getcourse.rjs — single-course description + prerequisites 🆕 ✅ live

- **URL template:** `https://catalog.ufl.edu/ribbit/?page=getcourse.rjs&code=EEL+3135`
- **Method:** GET · **Auth:** none
- **Params:** `page=getcourse.rjs` (fixed); `code=<SUBJ>+<NUM>` URL-encoded with a literal `+` between prefix and number (e.g. `EEL+3135`, `MAC+2313`, `COP+3504C`). Must be the exact canonical code; a wrong code returns an empty `<courseinfo>` element (your validity check).
- **Returns:** `text/xml` — `<courseinfo><course code="EEL 3135"><![CDATA[ ...HTML... ]]></course></courseinfo>`. The CDATA HTML contains `.courseblocktitle` (title + `<span class=credits>`), `.courseblockextra` (grading scheme + prerequisite), `.courseblockdesc` (full description). Each prereq course is wrapped in `<a ... onclick="return showCourse(this,'MAC 2313')">` so codes are machine-extractable; boolean logic preserved as `X and (A or B or C)`.
- **Example:**
  ```bash
  curl -s 'https://catalog.ufl.edu/ribbit/?page=getcourse.rjs&code=EEL+3135'
  ```
  ```xml
  <courseinfo><course code="EEL 3135"><![CDATA[
  <p class="courseblocktitle"><strong>EEL 3135 Introduction to Signals and Systems
  <span class="credits">4 Credits</span></strong></p>
  <p class="courseblockdesc">Continuous-time and discrete-time signal analysis ...</p>
  <p class="courseblockextra"><strong>Prerequisite:</strong>
  <a onclick="return showCourse(this, 'MAC 2313');">MAC 2313</a> and (COP2271 or ... or equivalent).</p>
  ]]></course></courseinfo>
  ```

### CourseLeaf per-subject bulk course page — ALL courses for a prefix 🆕 ✅ live

- **URL template:** `https://catalog.ufl.edu/UGRD/courses/{subject_slug}/`
- **Method:** GET · **Auth:** none
- **Params:** path segment is the subject slug (lowercase, underscores), e.g. `electrical_and_computer_engineering`, `computer_and_information_science_and_engineering`, `mathematics`, `physics`. Enumerate the full slug list from the `/UGRD/courses/` index.
- **Returns:** `text/html` (~92 KB for ECE). Every course under that subject as repeated `.courseblock.courseblocktoggle` blocks with `.courseblocktitle`, `.courseblockdesc`, `.courseblockextra` (same `showCourse()` prereq links as `getcourse.rjs`, batched).
- **Example:** `curl -s 'https://catalog.ufl.edu/UGRD/courses/electrical_and_computer_engineering/'` returns HTTP 200, ~92 KB, 79 ECE courses. **This is the primary full-catalog ingestion path** — ~30-40 polite requests cover every UF undergrad course.

### CourseLeaf course search page — clean boolean prereq form ✅ live

- **URL template:** `https://catalog.ufl.edu/search/?P=EEL%203135`
- **Method:** GET · **Auth:** none
- **Params:** `P=<SUBJ>%20<NUM>` (URL-encoded space).
- **Returns:** `text/html` search-results page rendering code, title, credits, description, and prerequisite in the cleaner boolean string form `MAC 2313 and (COP2271 or COP2273 or ...)`. **Enrichment / spot-validation** for a single course; prefer `getcourse.rjs` for machine use.

### CourseLeaf program/degree requirements page 🆕 ✅ live

- **URL template:** `https://catalog.ufl.edu/UGRD/colleges-schools/{COLLEGE}/{PROGRAM}/`
- **Method:** GET · **Auth:** none
- **Params:** college codes `UGENG` (engineering), `UGLAS` (liberal arts & sciences), `UGACT`, `UGJRC`, `UGNUR`, etc.; program codes `ELE_BSEE`, `CPS_BSCS`, `CSC_BS`, `DAT_BS`, `MCE_BSME`, `ARO_BSAE`, etc. Enumerate pairs from `/UGRD/majors/` and `/UGRD/programs/`.
- **Returns:** `text/html` degree page. Requirement tables use CourseLeaf class `sc_courselist` with column classes `codecol`/`hourscol`; `areaheader`/`comment` rows label requirement groups; a `plangrid` table gives the model 8-semester plan; critical-tracking courses listed with min-grade/attempt rules; total degree credits stated (128 for BSEE).
- **Example:** `https://catalog.ufl.edu/UGRD/colleges-schools/UGENG/ELE_BSEE/` → BSEE: Computer Programming (3cr), EE Breadth (10cr), EE Depth (6cr), Tech Electives (18cr), Total 128 credits; critical tracking MAC 2311/2312/2313, MAP 2302, PHY 2048/2049, CHM 2045 (min C, within 2 attempts).
- **Note:** No JSON equivalent exists — HTML parsing of `sc_courselist`/`plangrid` is the only path. The classes are CourseLeaf-standard and stable; program/college codes change yearly, so re-enumerate from `/UGRD/majors/`.

### CourseLeaf getprogram.rjs — programs NOT exposed as JSON ❌ dead

- **URL:** `https://catalog.ufl.edu/ribbit/?page=getprogram.rjs&program=ELE_BSEE`
- **Method:** GET · **Auth:** none
- **Returns:** HTTP 200 but **empty**: `<?xml version="1.0"?><programinfo></programinfo>` (51 bytes), regardless of program. UF's CourseLeaf serves only courses through `ribbit`, not programs. Documented as a negative result so no one builds against it — degree requirements **must** come from the HTML program pages above.

### CourseLeaf admin path 🔒 forbidden

- **URL:** `https://catalog.ufl.edu/courseleaf/`
- **Method:** GET · **Auth:** required
- **Returns:** **HTTP 403** — the staff-only CourseLeaf CMS backend. Out of scope; do not re-probe.

---

## 5. RateMyProfessors — public GraphQL API 🆕

Per-instructor difficulty/rating signal for joining to SOC instructor names. Single public GraphQL endpoint, no login. UF's RMP `legacyId` is `1100`; pass it to GraphQL as the Relay global ID `U2Nob29sLTExMDA=` (base64 of `School-1100`), **not** the raw `1100`.

### RMP GraphQL — teacher search within UF (primary resolver) 🆕 ✅ live

- **URL:** `https://www.ratemyprofessors.com/graphql`
- **Method:** POST · **Auth:** none (public token)
- **Headers:** `Content-Type: application/json`, `Authorization: Basic dGVzdDp0ZXN0` (base64 of `test:test`, shipped in RMP's own frontend JS — not a secret).
- **Body:**
  ```graphql
  query NewSearchTeachersQuery($query: TeacherSearchQuery!){
    newSearch{ teachers(query:$query){ resultCount edges{ node{
      id legacyId firstName lastName department
      avgRating avgDifficulty numRatings wouldTakeAgainPercent }}}}}
  ```
  Variables: `{"query":{"text":"<instructor name>","schoolID":"U2Nob29sLTExMDA="}}`.
- **Returns:** `newSearch.teachers.resultCount` + `edges[].node`: `id` (Relay global id), `legacyId` (int, for profile URL), `firstName`, `lastName`, `department`, `avgRating` (0-5), `avgDifficulty` (0-5), `numRatings`, `wouldTakeAgainPercent` (`-1` sentinel = N/A). Scoped to UF.
- **Example:**
  ```bash
  curl -s 'https://www.ratemyprofessors.com/graphql' \
    -H 'Authorization: Basic dGVzdDp0ZXN0' -H 'Content-Type: application/json' \
    -d '{"query":"query($q:TeacherSearchQuery!){newSearch{teachers(query:$q){edges{node{firstName lastName avgRating avgDifficulty numRatings}}}}}","variables":{"q":{"text":"Cheryl Resch","schoolID":"U2Nob29sLTExMDA="}}}'
  ```
  ```json
  {"data":{"newSearch":{"teachers":{"resultCount":1,"edges":[{"node":{
    "firstName":"Cheryl","lastName":"Resch","department":"Computer Science",
    "avgRating":3.6,"avgDifficulty":2.4,"numRatings":123,
    "wouldTakeAgainPercent":77.2358,"legacyId":2296802,"id":"VGVhY2hlci0yMjk2ODAy"}}]}}}}
  ```

### RMP GraphQL — teacher detail by node id (tags, distribution, courses) 🆕 ✅ live

- **URL:** `https://www.ratemyprofessors.com/graphql` · **Method:** POST · **Auth:** none (same public token)
- **Body:**
  ```graphql
  query GetTeacher($id: ID!){ node(id:$id){ __typename ... on Teacher{
    firstName lastName avgRating avgDifficulty numRatings wouldTakeAgainPercent
    ratingsDistribution{r1 r2 r3 r4 r5 total}
    teacherRatingTags{tagName tagCount}
    courseCodes{courseName courseCount} }}}
  ```
  Variables: `{"id":"<Relay node id from search>"}` (e.g. `VGVhY2hlci0yMjk2ODAy` = base64 `Teacher-2296802`).
- **Returns:** `ratingsDistribution{r1..r5,total}`, `teacherRatingTags[]{tagName,tagCount}` (e.g. "Tough grader"; empty when below RMP's threshold), and `courseCodes[]{courseName,courseCount}` — the exact UF course codes a professor taught (e.g. CDA3101 x64, COP3530 x12). `courseCodes` is the **disambiguation key**: match the SOC course code against `courseCodes[].courseName` before trusting a same-name match.
- **Use:** second hop after the search resolves a node id. Only call for the chosen professor, not every edge.

### RMP school page (legacyId discovery) ✅ live

- **URL:** `https://www.ratemyprofessors.com/school/1100`
- **Method:** GET · **Auth:** none
- **Returns:** the University of Florida React/Next.js page; confirms `1100` is UF. Per-professor profiles live at `/professor/{legacyId}` (e.g. `/professor/2296802`) — the ToS-safe place to deep-link students for full reviews rather than re-hosting RMP content. Reference only; use the GraphQL endpoint for data.

---

## 6. Grade Distributions / Course Difficulty Data 🆕

The authoritative public source of UF per-course grade distributions is the UF Office of Institutional Planning & Research (OIPR) Tableau Public workbook. Net-new — the 2022 repo had zero grade endpoints.

### UF OIPR grades landing page (source-of-truth pointer) 🆕 ✅ live

- **URL:** `https://ir.aa.ufl.edu/facts/grades/` (structured: `https://ir.aa.ufl.edu/wp-json/wp/v2/pages?slug=grades`)
- **Method:** GET · **Auth:** none
- **Returns:** WordPress/Elementor HTML embedding the official grade-distribution Tableau Public viz (workbook `DegreesandGrades19`). WP REST page id 7561, modified `2026-03-10`. The embedded workbook **name** is the version that rolls forward yearly — parse it live, never hardcode.

### UF Undergraduate Grade Distributions — Tableau Public viz (PRIMARY DATA) 🆕 ✅ live

- **URL:** `https://public.tableau.com/views/DegreesandGrades19/UndergraduateGrades` (table sheet: `.../UndergraduateGradesTable`)
- **Method:** GET (renders) / POST `bootstrapSession` (data extract) · **Auth:** none
- **Params:** public view. Data extraction uses the standard Tableau Public flow: GET the embed view (`?:embed=y&:showVizHome=no`), read the `tsConfigContainer` bootstrap config, then POST `{vizql_root}/bootstrapSession/sessions/{sessionId}`. The `UndergraduateGradesTable` sheet is the row-level export target. Canonical tool: `bertrandmartel/tableau-scraping` (Python).
- **Returns:** per-course grade distribution — counts/percentages of A/A-/B+ ... D-/E/F plus W (withdrawal), average GPA per course, sliceable by college/department/course/term. No static one-shot CSV (the `.csv` path 404s behind AWS WAF).
- **Granularity note:** course/dept/college level only — **no per-instructor breakdown** (use RMP for that). Refresh ~annually (last update Aug 2025).

### Tableau Public workbook metadata API (liveness + version check) 🆕 ✅ live

- **URL:** `https://public.tableau.com/profile/api/workbook/DegreesandGrades19` and `https://public.tableau.com/profile/api/uf.oipr4918`
- **Method:** GET · **Auth:** none
- **Returns:** clean JSON. Workbook: `authorName`, `profileName`, `viewCount`, `lastUpdateDate` (epoch ms), `title`, `description`, `viewInfos[]`. Profile: `name "UF_OIPR"`, `visibleWorkbookCount 77`.
- **Example:**
  ```bash
  curl -s 'https://public.tableau.com/profile/api/workbook/DegreesandGrades19'
  ```
  ```json
  {"authorName":"UF_OIPR","profileName":"uf.oipr4918","viewCount":32905,
   "lastUpdateDate":1754517615924,"title":"Grades 19","description":"Degrees and Grades 19",
   "viewInfos":[{"sheetRepoUrl":"DegreesandGrades19/sheets/UndergraduateGrades","sheetTitle":"Undergraduate Grades"},
                {"sheetRepoUrl":"DegreesandGrades19/sheets/UndergraduateGradesTable","sheetTitle":"Undergraduate Grades Table"}]}
  ```
- **Use:** cheap JSON heartbeat — poll `lastUpdateDate` to trigger a re-ingest only when UF refreshes the data (realistically each August). `UF_OIPR` has 77 public workbooks (degrees awarded, enrollment-by-course) for future enrichment.

### GatorEvals — Public Results (per-instructor evaluations) ✅ live (gated flow)

- **URL:** `https://gatorevals.aa.ufl.edu/public-results/`
- **Method:** GET · **Auth:** none (search/report flow, no clean JSON)
- **Returns:** UF's official course-evaluation results (instructor/section rating scores, response rates) loaded dynamically — no static CSV/JSON in the served HTML. The per-instructor quality signal OIPR grades lack, but access is gated and messier. **Enrichment only**, lower priority than OIPR grades. Do not attempt login.

---

## 7. Registrar / Academic Calendar + Official UF APIs

UF has **no sanctioned public open-data API gateway**. The realistic registrar source is the SOC API (sections 1-2) plus the catalog HTML below.

### UF Catalog Dates & Deadlines (academic calendar, HTML-only) 🆕 ✅ live

- **URL template:** `https://catalog.ufl.edu/UGRD/dates-deadlines/{startyear}-{endyear}/` (e.g. `2026-2027`)
- **Method:** GET · **Auth:** none
- **Params:** year-range in path. Index at `/UGRD/dates-deadlines/`; PDF mirrors at `/UGRD/dates-deadlines/pdfs/`. The naive `/YYYY-YYYY-dates-deadlines/` guess 404s.
- **Returns:** server-rendered CourseLeaf HTML (no JSON) with the full critical-date table per term: classes begin/end, drop/add, withdrawal deadline, registration windows, finals, degree-application deadlines.
- **Example (Fall 2026):** Classes Begin Aug 20 · Drop/Add Aug 20-26 · Drop & Withdrawal Deadline Nov 16 · Classes End Dec 2 · Final Exams Dec 5-11 · Advance Registration Mar 23 - Aug 18 · Degree Applications Sep 11.
- **Note:** the **only** source for term start/end, withdrawal deadline, registration windows, and finals — the dates the SOC API does not carry (SOC has only per-section `dropaddDeadline`). Scrape once per academic-year publish with adaptive selectors; CourseLeaf markup shifts yearly.

### Official UF API gateway (api.ufl.edu) ❌ dead

- **URL:** `https://api.ufl.edu/`
- **Status:** domain does **not resolve** (NXDOMAIN; curl HTTP 000). There is no public API gateway at this hostname. Confirms there is no "just use the official API" option.

### Official UF developer portal (developer.ufl.edu) ❌ dead

- **URL:** `https://developer.ufl.edu/`
- **Status:** domain does **not resolve** (NXDOMAIN). No developer program, API catalog, or self-serve keys. The only sanctioned routes (NaviGator AI at `api.ai.it.ufl.edu`, Registrar PersonHub) are auth-walled and out of scope.

### lwcal / Localist academic calendar feed (week view) ❌ dead

- **URL:** `https://ufl.lwcal.com/live/calendar/view/week?user_tz=America%2FNew_York`
- **Method:** GET · **Auth:** none
- **Returns:** HTTP 200 but an **empty array** `[]` (2-byte body). Host alive, payload gone. Superseded by SOC `dropaddDeadline` + the CourseLeaf dates scrape.

### Localist public JSON API (calendar.ufl.edu/api/2/) 🔒 forbidden

- **URL:** `https://calendar.ufl.edu/api/2/events?days=1&pp=2`
- **Method:** GET · **Auth:** none (but blocked)
- **Returns:** **HTTP 403** site-wide across `/api/2/events`, `/api/2/places`, `/api/2/photos`, and `/widget/view`. UF's events calendar is a Localist (Modern Campus) install but the public JSON API is walled — embed-widget only. Carries campus events, not registrar deadlines. Low value for a planner. For structured event data, request an API key from UF Strategic Communications.

### UF People Directory ⚠️ unknown

- **URL:** `https://directory.ufl.edu/?query=John+Smith` (`phonebook.ufl.edu` 301-redirects here)
- **Method:** GET / POST · **Auth:** none for the form
- **Returns:** HTTP 200 HTML **search form only** — results load via POST/JS, no documented unauthenticated JSON GET (`/people/search`, `/api/people/search`, `/people/` all 404). Sanctioned programmatic access (PersonHub / DIRECTORY-API-USERS-L) is authorization-required. **Skip** — resolve instructors from SOC `instructors[].name` instead.

---

## 8. Campus Map (heritage) — the famous cmapjson suite ❌ forbidden

The beloved 2022 campus-map JSON suite is now a deliberate, server-side lockdown. `campusmap.ufl.edu` root is HTTP 200, but the entire `/library/` subtree returns a hard Apache **403 Forbidden** ("You don't have permission to access this resource"). A `Referer`/`User-Agent` header does **not** help. This is an intentional block, not a dead site.

| Endpoint | URL | Badge | Was |
|---|---|---|---|
| search.json | `https://campusmap.ufl.edu/library/cmapjson/search.json` | 🔒 forbidden | Building search index |
| geo_buildings.json | `https://campusmap.ufl.edu/library/cmapjson/geo_buildings.json` | 🔒 forbidden | Building geometry/polygons |
| dining.json | `https://campusmap.ufl.edu/library/cmapjson/dining.json` | 🔒 forbidden | Dining locations + hours |
| library.json | `https://campusmap.ufl.edu/library/cmapjson/library.json` | 🔒 forbidden | Library branches |
| study.json | `https://campusmap.ufl.edu/library/cmapjson/study.json` | 🔒 forbidden | Study spaces + amenities |
| aed.json | `https://campusmap.ufl.edu/library/cmapjson/aed.json` | 🔒 forbidden | AED locations |
| bus_stops.json | `https://campusmap.ufl.edu/library/cmapjson/bus_stops.json` | 🔒 forbidden | RTS bus stops |
| wireless.json | `https://campusmap.ufl.edu/library/cmapjson/wireless.json` | 🔒 forbidden | WiFi coverage zones |

- **Method:** GET · **Auth:** none nominally, but all return 403.
- **Example response:** `<title>403 Forbidden</title> ... <h1>Forbidden</h1><p>You don't have permission to access this resource.</p>`
- **Do not retry in a loop, and do not attempt header/Referer/UA evasion** (already tested, ineffective). For a future "campus life" layer, re-source from Gainesville RTS GTFS (buses), UF Libraries' own hours feed, and a different dining source. The original 2022 schemas can be recovered from the Wayback Machine.

---

## 9. Heritage endpoints (the project's soul)

### Gym live cams (RecSports cam1-8) — THE SURVIVOR ✅ live

- **URL template:** `http://recsports.ufl.edu/cam/cam{1-8}.jpg` (301 → HTTPS)
- **Method:** GET · **Auth:** none
- **Returns:** a real JPEG image. `cam1.jpg` = HTTP 200, `content-type: image/jpeg`, `content-length: 306564` (~300 KB). The famous live gym-busyness webcam stills still work in 2026.
- **Note:** `http://` 301-redirects to `https://`, final 200. Poll politely — these are live cameras. Zero degree-planning value, pure heritage.

### UF-ALERT listserv RSS ❌ dead

- **URL:** `https://lists.ufl.edu/cgi-bin/wa?RSS&L=UF-ALERT-GAINESVILLE&v=2.0`
- **Returns:** **HTTP 403** (text/html). LISTSERV no longer serves this RSS publicly. Replaced by `ufalert.ufl.edu` (signup), `updates.emergency.ufl.edu` (live updates), `emergency.ufl.edu` (HTTP 200) — none expose a public structured feed.

### Events calendar (Localist / Modern Campus) ✅ live (HTML/widget)

- **URL:** `https://calendar.ufl.edu/` (vanity: `https://ufl.lwcal.com/`)
- **Returns:** live HTML calendar (week/all views) on a Localist install. Embed via the Localist widget JS, not the JSON API (which is 403 — see section 7). Campus events, not academic deadlines.

### SG elections results ✅ live (moved)

- **URL:** `https://sg.ufl.edu/elections/` (old `/Elections/Results` → 404)
- **Returns:** live WordPress Elections section (`/elections/`, `/elections/current-election-information/`, etc.). Results are human-readable WordPress pages, no structured feed. Moved, not dead. Heritage curiosity.

### Common Data Set ✅ live (moved)

- **URL:** `https://ir.aa.ufl.edu/reports/cds-reports/` (old `/reports/common-data-set/` → soft-404). PDFs at `https://data-apps.ir.aa.ufl.edu/public/cds/CDS_2024-2025_UFMAIN_Post_v1.pdf` (`application/pdf`, 200).
- **Returns:** institutional stats (admit rates, class sizes, retention) as yearly PDFs. Class-size data is the only tangentially planner-relevant slice. Ingest via the year-templated PDF URL with a PDF/RAG pipeline if ever needed for a marketing/about page. Keep out of the planner engine.

### UF Police crime log (Clery) ✅ live (moved, SPA)

- **URL:** `https://publicsafety.ufl.edu/clery/crimelog` (old `police.ufl.edu` paths → 404)
- **Returns:** a JS-rendered "Clery Act Admin" SPA (page title "Crime Log - UF Public Safety"). Data loads client-side; no static JSON URL observable without executing JS. Re-platformed from `police.ufl.edu`. Out of scope for respectful static mapping. No degree-planning relevance.

---

## Discovery Methodology

How these were found, and how to find more.

1. **Start from the 2022 baseline.** Read the original [Rolstenhouse/uf_api](https://github.com/Rolstenhouse/uf_api) README via the GitHub API to capture the documented baseline (SOC base URL, `term`/`category`/`last-row` params, the old `COURSES`/`LASTROW`/`TOTALROWS` shape).
2. **Verify every host two ways.** `WebFetch` (JSON pretty-print + top-level keys) **and** `curl -s -m 15 -A 'Mozilla/5.0' -w 'HTTP %{http_code}|%{content_type}|%{size_download}'` to distinguish real 200/JSON from 404/403/000. Use `nslookup` to prove a domain is NXDOMAIN (e.g. `api.ufl.edu`) rather than merely network-blocked. WebFetch strips `<script>` tags, so it **cannot** see JS bundle URLs — use curl + grep for JS.
3. **Map the apix gateway by grepping the SPA bundles.** There is no `/apix/` index, `openapi.json`, or `swagger` (all 404). Instead: fetch the SPA shell (`curl -s https://one.ufl.edu/soc/`), grep `script src` for Webpack chunk names (`soc.<hash>.min.js`, shared `dist/<id>.<hash>.min.js`), download every dist chunk, and `grep -hoE '/apix/[a-zA-Z0-9/_.-]+'`. The SPA wraps calls as `(0,x.Ay)("/apix/<svc>/<op>","get"|"post",{},true)` — the **trailing boolean** reliably flags auth-required vs public calls.
4. **Confirm what is behind auth without probing it.** `GET /apix/search/getpubliclists` is the human-readable service catalog mapping every ONE.UF feature (`/transcript`, `/degreeaudit`, `/myschedule`) to its login tier. Student-data routes 404 at guessed `/apix/<name>/` paths because they resolve only in lazy chunks post-SSO — a routing artifact, not absence.
5. **Reverse-engineer pagination empirically.** `last-row` no-ops (loops page 1); the real cursor is the response's self-advancing `LASTCONTROLNUMBER`. Pass it back as `last-control-number`.
6. **Decode term codes from live data.** Read `simpleSyllabusParams` ("Fall 2026/EEL/3135/26214") and the `/apix/soc/filters` `terms[]` array. Pattern: `2 + YY + S` (1 Spring, 5 Summer, 8 Fall); summer sub-terms append `6W1`/`6W2`/`1`.
7. **Identify the CMS.** `curl` header/HTML grep on `catalog.ufl.edu` found literal "courseleaf"; the hosted mirror is `ufl-public.courseleaf.com`. Probe documented CourseLeaf patterns: `/ribbit/?page=getcourse.rjs`, `/search/?P=`, `/UGRD/{programs,majors,courses,colleges-schools}/`.
8. **Find structured datasets behind embeds.** The OIPR grades page embeds a Tableau Public viz; its data is extractable via the public `bootstrapSession` flow (`bertrandmartel/tableau-scraping`), and `public.tableau.com/profile/api/workbook/{name}` gives a clean JSON liveness heartbeat.
9. **For third-party APIs, read the community wrappers.** RMP's endpoint, public Basic token (`dGVzdDp0ZXN0`), and Relay global-id scheme came from `@mtucourses/rate-my-professors` source; verified with live `curl` POSTs.

**To find more surface:** drive `one.ufl.edu/soc/` and `catalog.ufl.edu` in Playwright/DevTools and watch the Network tab for XHRs the static grep cannot reconstruct (dynamically-built query strings). Re-run the bundle grep after any UF redesign — chunk hashes change on every deploy, so hardcoding bundle URLs rots. Probe the SimpleSyllabus integration implied by `simpleSyllabusParams`.

---

## Responsible Use

- **Public, unauthenticated endpoints only.** Nothing here requires a login. Auth-walled services (transcript, degree audit, my schedule, PersonHub, CourseLeaf admin) are documented as boundaries and were never probed for entry. Do not attempt to access them.
- **These endpoints are undocumented and may change.** The SOC host already migrated and its metadata consolidated since 2022; the campus-map JSON and Localist API were locked down. Treat every endpoint as best-effort, code defensively against missing keys, and add a schema-drift monitor.
- **Cache aggressively, never harvest.** Catalog and grade data change slowly (weekly-to-yearly) — cache per term, refresh on a schedule. Page sequentially with `last-control-number`, add delay between calls, and never deep-loop. This is mapping, not harvesting.
- **Respect the source.** Do not attempt header/Referer/User-Agent evasion on blocked paths (already tested, ineffective, and against rules of engagement). Use realistic User-Agents, throttle, and back off on challenge. Deep-link to RateMyProfessors profiles rather than re-hosting review text.
- **No official sanction.** UF has no public open-data API. Ship a visible "data sourced from UF public web, not an official feed" disclaimer in anything built on these endpoints.
