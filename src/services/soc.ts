// SOC service — UF Schedule of Courses (one.ufl.edu/apix/soc).
// Live course catalog, sections, raw prerequisites, gen-ed flags, and offering history.
// openSeats / meetTimes / finalExam are permanently null in 2026 (UF removed them).

import type { Http } from "../core/http.js";
import { TTL } from "../core/cache.js";
import type { Course, Season } from "../core/types.js";

const BASE = "https://one.ufl.edu/apix/soc";

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
  genEd?: string[];
  quest?: string[];
  grWriting?: string;
  deptCode?: number;
  deptName?: string;
  instructors?: { name: string }[];
  dropaddDeadline?: string;
  simpleSyllabusParams?: string;
  waitList?: { isEligible?: string; cap?: number; total?: number };
}

export interface SocCourse {
  code: string;
  courseId?: string;
  name: string;
  description?: string;
  prerequisites?: string;
  sections: SocSection[];
}

interface SocPage {
  COURSES: SocCourse[];
  LASTCONTROLNUMBER: number;
  RETRIEVEDROWS: number;
  TOTALROWS: number;
}

export interface ScheduleQuery {
  term: string;
  dept?: string;
  courseCode?: string;
  category?: string;
  maxPages?: number;
  ttlMs?: number;
}

const TERM_SEASON: Record<string, Season> = { "1": "Spring", "5": "Summer", "8": "Fall" };
const CODE_RE = /\b[A-Z]{3}\s?\d{4}[A-Z]?\b/g;

export class SocService {
  constructor(private http: Http) {}

  /** Authoritative term + department + category + program-level dictionaries. */
  filters(term = ""): Promise<SocFilters> {
    const q = term ? `?term=${encodeURIComponent(term)}` : "";
    return this.http.getJson<SocFilters>(`${BASE}/filters/${q}`, { ttlMs: TTL.day });
  }

  /** Decode a term code (e.g. "2268") to its Season. */
  termToSeason(term: string): Season | undefined {
    return TERM_SEASON[term.slice(-1)];
  }

  /** All courses matching the query, paged via the real last-control-number cursor. */
  async schedule(q: ScheduleQuery): Promise<SocCourse[]> {
    const { term, dept, courseCode, category = "CWSP", maxPages = 200, ttlMs = TTL.day } = q;
    const cacheKey = `soc:schedule:${term}:${dept ?? ""}:${courseCode ?? ""}:${category}`;
    const cached = await this.http.cache.get<SocCourse[]>(cacheKey);
    if (cached !== undefined) return cached;

    const out: SocCourse[] = [];
    let cursor = 0;
    for (let page = 0; page < maxPages; page++) {
      const p = new URLSearchParams({ category, term, "last-control-number": String(cursor) });
      if (dept) p.set("dept", dept);
      if (courseCode) p.set("course-code", courseCode);
      const data = await this.http.getJson<SocPage[]>(`${BASE}/schedule/?${p.toString()}`);
      const block = data?.[0];
      if (!block || !Array.isArray(block.COURSES) || block.COURSES.length === 0) break;
      out.push(...block.COURSES);
      if (block.RETRIEVEDROWS < 50 || block.LASTCONTROLNUMBER === cursor) break;
      cursor = block.LASTCONTROLNUMBER;
    }
    await this.http.cache.set(cacheKey, out, ttlMs);
    return out;
  }

  /** Extract bare prereq course codes from the free-text prerequisites string. */
  extractPrereqCodes(prereqText?: string): string[] {
    if (!prereqText) return [];
    return [...new Set((prereqText.match(CODE_RE) ?? []).map((m) => m.replace(/\s+/g, "")))];
  }

  /** Map a raw SOC course to a partial Gradvisr Course (offered is filled via offeredIndex). */
  toCourseStub(raw: SocCourse): Partial<Course> & { code: string } {
    const s0 = raw.sections?.[0];
    return {
      code: raw.code,
      name: raw.name,
      credits: s0?.credits ?? 0,
      description: raw.description?.trim() || undefined,
      prereqs: this.extractPrereqCodes(raw.prerequisites),
      coreqs: [],
      offered: [],
    };
  }

  /** Crawl multiple terms and union which seasons each course actually runs in. */
  async offeredIndex(terms: string[], q: Omit<ScheduleQuery, "term"> = {}): Promise<Record<string, Season[]>> {
    const index: Record<string, Set<Season>> = {};
    for (const term of terms) {
      const season = this.termToSeason(term);
      if (!season) continue;
      for (const c of await this.schedule({ ...q, term })) (index[c.code] ??= new Set()).add(season);
    }
    return Object.fromEntries(Object.entries(index).map(([k, v]) => [k, [...v]]));
  }
}
