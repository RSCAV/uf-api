/**
 * soc-client.ts — typed client for UF's public Schedule of Courses (SOC) API.
 *
 * Source documentation: ../ENDPOINTS.md
 * Discovery methodology: ../DISCOVERY-METHOD.md
 *
 * This is the bootstrap for Gradvisr's live UF ingestion. It hits two public,
 * unauthenticated endpoints:
 *   - /apix/soc/filters   -> term codes + department dictionary (the seed)
 *   - /apix/soc/schedule  -> course catalog + sections + raw prereqs (the data)
 *
 * Responsible use (see DISCOVERY-METHOD.md): public/unauth only, page sequentially
 * with last-control-number, throttle between pages, cache aggressively, never loop.
 * openSeats / meetTimes / finalExam are permanently null on this endpoint in 2026 —
 * do NOT build a live-seats or schedule-conflict feature on them.
 */

import { pathToFileURL } from "node:url";
import type { Course, Season } from "./types.js";

const BASE = "https://one.ufl.edu/apix/soc";
const UA = "Mozilla/5.0 (Gradvisr catalog ingester; +https://github.com/RSCAV/gradvisr)";
const PAGE_DELAY_MS = 350; // be a good citizen between pages

// ---------- Raw SOC response shapes (what the endpoint actually returns) ----------

export interface SocFilters {
  categories: { CODE: string; DESC: string }[];
  progLevels: { CODE: string; DESC: string }[];
  terms: { CODE: string; DESC: string; SORT_TERM?: string }[];
  departments: { CODE: string; DESC: string }[];
}

export interface SocSection {
  number: string;
  classNumber: number;
  credits: number;
  credits_min?: number;
  credits_max?: number;
  genEd?: string[];
  quest?: string[];
  grWriting?: string;
  deptCode?: number;
  deptName?: string;
  instructors?: { name: string }[];
  acadCareer?: string;
  display?: string;
  dropaddDeadline?: string;
  simpleSyllabusParams?: string;
  meetTimes?: unknown[]; // always [] in 2026
  finalExam?: string; // always "" in 2026
  waitList?: { isEligible?: string; cap?: number; total?: number };
}

export interface SocCourse {
  code: string;
  courseId?: string;
  name: string;
  description?: string;
  prerequisites?: string; // FREE TEXT, may be blank
  openSeats?: number | null; // always null in 2026
  sections: SocSection[];
}

interface SocPage {
  COURSES: SocCourse[];
  LASTCONTROLNUMBER: number;
  RETRIEVEDROWS: number;
  TOTALROWS: number;
}

// ---------- Fetch helpers ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Pull the authoritative term + department + category dictionaries. Seed everything from here. */
export async function fetchFilters(term = ""): Promise<SocFilters> {
  const q = term ? `?term=${encodeURIComponent(term)}` : "";
  return getJson<SocFilters>(`${BASE}/filters/${q}`);
}

export interface ScheduleOpts {
  term: string; // required, e.g. "2268"
  dept?: string; // 8-digit dept code from filters, e.g. "19050000"
  courseCode?: string; // prefix match, e.g. "EEL31"
  category?: string; // CWSP (default) | UFOL | IA
  maxPages?: number; // safety cap; default 200 (~10k courses)
}

/**
 * Page the schedule endpoint via the real cursor (last-control-number) until exhausted.
 * Returns the flattened list of raw SOC courses across all pages.
 */
export async function fetchSchedule(opts: ScheduleOpts): Promise<SocCourse[]> {
  const { term, dept, courseCode, category = "CWSP", maxPages = 200 } = opts;
  const out: SocCourse[] = [];
  let cursor = 0;
  let total = -1;

  for (let page = 0; page < maxPages; page++) {
    const p = new URLSearchParams({ category, term, "last-control-number": String(cursor) });
    if (dept) p.set("dept", dept);
    if (courseCode) p.set("course-code", courseCode);

    const data = await getJson<SocPage[]>(`${BASE}/schedule/?${p.toString()}`);
    const block = data?.[0];
    if (!block || !Array.isArray(block.COURSES) || block.COURSES.length === 0) break;

    out.push(...block.COURSES);
    total = block.TOTALROWS;

    // RETRIEVEDROWS < 50 (or cursor not advancing) means we reached the end.
    if (block.RETRIEVEDROWS < 50 || block.LASTCONTROLNUMBER === cursor) break;
    cursor = block.LASTCONTROLNUMBER;
    await sleep(PAGE_DELAY_MS);
  }

  if (total >= 0 && out.length < total) {
    console.warn(`[soc-client] retrieved ${out.length}/${total} courses (hit maxPages or early stop)`);
  }
  return out;
}

// ---------- Mapping into Gradvisr's Course shape ----------

const COURSE_CODE_RE = /\b[A-Z]{3}\s?\d{4}[A-Z]?\b/g;

/** Best-effort extraction of bare prereq course codes from the free-text string. */
export function extractPrereqCodes(prereqText?: string): string[] {
  if (!prereqText) return [];
  const matches = prereqText.match(COURSE_CODE_RE) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, "")))];
}

/**
 * Map a raw SOC course to a partial Gradvisr Course. `offered` is intentionally
 * left empty: a single term cannot tell you the full season set — build that by
 * unioning presence across multiple term crawls (see buildOfferedIndex).
 */
export function socToCourseStub(raw: SocCourse): Partial<Course> & { code: string } {
  const s0 = raw.sections?.[0];
  return {
    code: raw.code,
    name: raw.name,
    credits: s0?.credits ?? 0,
    description: raw.description?.trim() || undefined,
    prereqs: extractPrereqCodes(raw.prerequisites),
    coreqs: [],
    offered: [], // fill via multi-term union
  };
}

const TERM_SEASON: Record<string, Season> = { "1": "Spring", "5": "Summer", "8": "Fall" };

/** Decode a SOC term code (e.g. "2268") into its Season, or undefined if unrecognized. */
export function termToSeason(term: string): Season | undefined {
  return TERM_SEASON[term.slice(-1)];
}

/**
 * Crawl several terms and union which seasons each course actually appears in.
 * This is the real source for `offered[]` (replacing the hardcoded ["Fall","Spring"]).
 * Returns { COURSECODE: ["Fall","Spring"] }.
 */
export async function buildOfferedIndex(
  terms: string[],
  opts: Omit<ScheduleOpts, "term"> = {},
): Promise<Record<string, Season[]>> {
  const index: Record<string, Set<Season>> = {};
  for (const term of terms) {
    const season = termToSeason(term);
    if (!season) continue;
    const courses = await fetchSchedule({ ...opts, term });
    for (const c of courses) (index[c.code] ??= new Set()).add(season);
    await sleep(PAGE_DELAY_MS);
  }
  return Object.fromEntries(Object.entries(index).map(([k, v]) => [k, [...v]]));
}

// ---------- Demo / smoke test (run: npx tsx src/soc-client.ts) ----------

async function main() {
  console.log("→ fetchFilters() ...");
  const filters = await fetchFilters("2268");
  const fall = filters.terms.find((t) => t.CODE === "2268");
  console.log(
    `  terms=${filters.terms.length}  departments=${filters.departments.length}  ` +
      `categories=${filters.categories.map((c) => c.CODE).join("/")}`,
  );
  console.log(`  2268 -> ${fall?.DESC ?? "?"} (season ${termToSeason("2268")})`);

  console.log("\n→ fetchSchedule(EEL3135, Fall 2026) ...");
  const courses = await fetchSchedule({ term: "2268", courseCode: "EEL3135" });
  const eel = courses.find((c) => c.code === "EEL3135");
  if (eel) {
    const stub = socToCourseStub(eel);
    console.log(`  ${eel.code} — ${eel.name} (${stub.credits}cr)`);
    console.log(`  instructor: ${eel.sections?.[0]?.instructors?.[0]?.name ?? "TBA"}`);
    console.log(`  prereq codes: ${stub.prereqs?.join(", ") || "(none parsed)"}`);
    console.log(`  raw prereq text: ${eel.prerequisites ?? "(blank)"}`);
  } else {
    console.log("  EEL3135 not found in this term.");
  }
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error("[soc-client] demo failed:", e.message);
    process.exit(1);
  });
}
