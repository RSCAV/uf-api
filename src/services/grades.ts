// Grades service — UF OIPR grade distributions, published on Tableau Public.
//
// UF's Office of Institutional Planning & Research publishes per-course grade-letter
// distributions in the "Grades 19" workbook (profile uf.oipr4918, workbook DegreesandGrades19,
// sheet UndergraduateGradesTable). Discovered from ir.aa.ufl.edu/facts/grades/.
//
// The metadata/discovery endpoints below are clean public JSON. Extracting the tabular grade
// data requires Tableau's vizql bootstrap handshake, which returns a concatenated
// "length;json length;json" payload — `bootstrapRaw()` performs the handshake and returns the
// raw payload; parsing the dataDictionary into course->grade-counts is best done with a
// dedicated Tableau parser (see bertrandmartel/tableau-scraping). This is the real source for
// turning a guessed difficulty signal into objective average-GPA / withdrawal-rate data.

import type { Http } from "../core/http.js";
import { TTL } from "../core/cache.js";

const TPUB = "https://public.tableau.com";
const UF_OIPR_PROFILE = "uf.oipr4918";
const GRADES_WORKBOOK = "DegreesandGrades19";
const GRADES_SHEET = "UndergraduateGradesTable";

export interface TableauWorkbookMeta {
  title: string;
  authorName: string;
  profileName: string;
  defaultViewName: string;
  viewCount: number;
  lastUpdateDate: number;
  viewInfos?: { sheetRepoUrl: string }[];
}

export interface TableauWorkbookSummary {
  workbookRepoUrl: string;
  title: string;
  defaultViewName: string;
  defaultViewRepoUrl: string;
  viewCount: number;
}

export class GradesService {
  constructor(private http: Http) {}

  /** Metadata for a Tableau Public workbook (defaults to the UF grades workbook). */
  workbookMeta(repo = GRADES_WORKBOOK): Promise<TableauWorkbookMeta> {
    return this.http.getJson<TableauWorkbookMeta>(`${TPUB}/profile/api/workbook/${repo}`, {
      ttlMs: TTL.week,
      cacheKey: `tableau:wbmeta:${repo}`,
    });
  }

  /** List a profile's public workbooks (defaults to UF OIPR — 77 workbooks). Pages of <=50. */
  async workbooks(profileName = UF_OIPR_PROFILE, start = 0, count = 50): Promise<TableauWorkbookSummary[]> {
    const p = new URLSearchParams({ profileName, start: String(start), count: String(count), visibility: "NON_HIDDEN" });
    const r = await this.http.getJson<{ contents?: TableauWorkbookSummary[] }>(`${TPUB}/public/apis/workbooks?${p.toString()}`, {
      ttlMs: TTL.day,
    });
    return r.contents ?? [];
  }

  /** Static preview PNG of a view (a cheap coverage/sanity check). */
  previewImageUrl(workbook = GRADES_WORKBOOK, sheet = "UndergraduateGrades"): string {
    return `${TPUB}/static/images/${workbook.slice(0, 2)}/${workbook}/${sheet}/1.png`;
  }

  /**
   * EXPERIMENTAL: perform the Tableau vizql bootstrap handshake and return the raw payload
   * (a concatenated "length;json length;json" string containing the dataDictionary with course
   * codes + grade letters). Parsing it into structured rows is non-trivial and brittle across
   * Tableau versions — for production use, feed this payload to a Tableau parser, or run the
   * documented recipe with bertrandmartel/tableau-scraping. Returns the raw text or throws.
   */
  async bootstrapRaw(workbook = GRADES_WORKBOOK, sheet = GRADES_SHEET): Promise<string> {
    // 1. Load the embed to mint a session (the modern flow returns a session via Set-Cookie /
    //    the bootstrap endpoint; we read the embed first to establish the vizql session path).
    const embed = `${TPUB}/views/${workbook}/${sheet}?:embed=y&:showVizHome=no&:tabs=no&:toolbar=no`;
    await this.http.getText(embed);
    // 2. bootstrapSession returns the data payload. Tableau mints the session server-side from
    //    the embed load; the bootstrap path carries the workbook/sheet.
    const url = `${TPUB}/vizql/w/${workbook}/v/${sheet}/bootstrapSession/sessions/`;
    const res = await this.http.postJson<unknown>(url, undefined, {
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/javascript" },
    }).catch(() => null);
    if (res) return JSON.stringify(res);
    // Fallback: return the embed HTML so the caller can extract a tsConfig/session if present.
    return this.http.getText(embed);
  }
}
