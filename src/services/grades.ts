// Grades service — UF OIPR grade distributions, published on Tableau Public.
//
// UF's Office of Institutional Planning & Research publishes per-course grade-letter
// distributions in the "Grades 19" workbook (profile uf.oipr4918, workbook DegreesandGrades19,
// sheet UndergraduateGradesTable). Discovered from ir.aa.ufl.edu/facts/grades/.
//
// The metadata/discovery endpoints below are clean public JSON and are the stable surface.
// Extracting the tabular grade data needs Tableau's vizql data handshake. VERIFIED 2026-05-30:
// modern Tableau Public no longer inlines the session in the embed (the tsConfigContainer comes
// back empty; the session is minted by client JS), so a plain server-side POST does NOT work.
// To pull the per-course grade table, drive the viz in a headless browser (Playwright) and
// intercept the bootstrapSession response, or use a maintained scraper (bertrandmartel/
// tableau-scraping). That is the path to objective average-GPA / withdrawal-rate difficulty.

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
   * Fetch the raw embed HTML for the grades view. NOTE (verified 2026-05-30): modern Tableau
   * Public no longer inlines the session in the embed — the `tsConfigContainer` textarea comes
   * back EMPTY and the session is minted dynamically by the page's PreBootstrap JS. So the old
   * "GET embed -> parse sessionid -> POST bootstrapSession" recipe does NOT work for this viz.
   *
   * To extract the actual per-course grade table, drive the viz in a headless browser
   * (Playwright) and intercept the `bootstrapSession` response, or use a maintained Tableau
   * scraper such as bertrandmartel/tableau-scraping (it keeps up with Tableau's protocol churn).
   * The metadata methods above (workbookMeta / workbooks) are the clean, stable JSON surface;
   * `previewImageUrl()` gives a static snapshot for coverage checks.
   */
  embedUrl(workbook = GRADES_WORKBOOK, sheet = GRADES_SHEET): string {
    return `${TPUB}/views/${workbook}/${sheet}?:embed=y&:showVizHome=no&:display_count=n&:origin=viz_share_link`;
  }
}
