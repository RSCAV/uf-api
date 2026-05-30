// Transfer service — Florida transfer-course equivalencies via FLVC / FloridaShines.
//
// Public, unauthenticated JSON API at courses.flvc.org/api. Florida's statewide rule (which
// UF Admissions itself states) is: same SCNS prefix + same last-3-digits = equivalent course.
// So: resolve a course taken at any Florida public school to its SCNS prefix+number, then check
// whether UF (InstitutionId 29) offers the same prefix+number — a direct transfer equivalent.
//
// Covers the dominant Gradvisr transfer case (Florida community-college -> UF). Out-of-state /
// private schools and UF's course-by-course exceptions still need Transferology or manual SCNS.

import type { Http } from "../core/http.js";
import { TTL } from "../core/cache.js";

const BASE = "https://courses.flvc.org/api";
const HEADERS = { "X-Requested-With": "XMLHttpRequest", Referer: "https://courses.flvc.org/Courses/Search/" };

/** UF's FLVC InstitutionId. */
export const UF_INSTITUTION_ID = 29;

export interface FlvcInstitution {
  InstitutionId: number;
  Abbreviation: string;
  Name: string;
  DisplayName: string;
  InstitutionType: number; // 1 = Public University
  City?: string;
  State?: string;
}

export interface FlvcCourse {
  SectionId: number;
  CourseId?: number;
  InstitutionId: number;
  InstitutionName: string;
  CourseDept: string; // SCNS prefix, e.g. "ENC"
  CourseNo: string; // SCNS number, e.g. "1101"
  CourseTitle: string;
  MinCredits: number;
  MaxCredits?: number;
  CipChoiceId?: string;
  CourseLevelDisplay?: string;
  AcademicTermDisplay?: string;
}

export interface FlvcCourseDetail {
  CourseDescription?: string;
  CoursePrereqs?: string; // free text, includes Gordon Rule / Core flags
  RegistrarUrl?: string;
  ReferenceNumber?: string;
}

const scns = (s: string) => s.replace(/\s+/g, "").toUpperCase();

export class TransferService {
  constructor(private http: Http) {}

  /** All 117 Florida public institutions (cached). */
  institutions(): Promise<FlvcInstitution[]> {
    return this.http.getJson<FlvcInstitution[]>(`${BASE}/Institutions`, {
      ttlMs: TTL.week,
      cacheKey: "flvc:institutions",
      headers: HEADERS,
    });
  }

  /** Find an institution by abbreviation or (partial) name. */
  async institution(nameOrAbbr: string): Promise<FlvcInstitution | undefined> {
    const q = nameOrAbbr.toLowerCase();
    const list = await this.institutions();
    return (
      list.find((i) => i.Abbreviation.toLowerCase() === q) ??
      list.find((i) => i.DisplayName.toLowerCase().includes(q) || i.Name.toLowerCase().includes(q))
    );
  }

  /** Search SCNS courses, optionally scoped to one institution (e.g. UF_INSTITUTION_ID). */
  async search(keywords: string, institutionId?: number): Promise<FlvcCourse[]> {
    const p = new URLSearchParams({ keywords, groupBy: "Course" });
    if (institutionId != null) p.set("institutions", String(institutionId));
    const r = await this.http.getJson<{ Results?: { Items?: FlvcCourse[] } }>(`${BASE}/SectionSearch?${p.toString()}`, {
      ttlMs: TTL.day,
      headers: HEADERS,
    });
    return r.Results?.Items ?? [];
  }

  /** Prereqs + description for one course section. */
  detail(sectionId: number): Promise<FlvcCourseDetail> {
    return this.http.getJson<FlvcCourseDetail>(`${BASE}/SectionSearch/${sectionId}`, {
      ttlMs: TTL.week,
      headers: HEADERS,
    });
  }

  /**
   * Find the UF equivalent of a course taken elsewhere, via the Florida SCNS rule
   * (same prefix + number). Returns the matching UF course or null.
   *
   *   await uf.transfer.findUFEquivalent("ENC", "1101")  // -> UF's ENC 1101
   */
  async findUFEquivalent(dept: string, number: string): Promise<FlvcCourse | null> {
    const hits = await this.search(`${scns(dept)}${number}`, UF_INSTITUTION_ID);
    return hits.find((c) => scns(c.CourseDept) === scns(dept) && c.CourseNo === number) ?? null;
  }
}
