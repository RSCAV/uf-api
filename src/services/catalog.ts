// Catalog service — UF Catalog (Leepfrog CourseLeaf) at catalog.ufl.edu.
//
// The Ribbit gateway returns XML wrapping CDATA HTML blocks:
//   - getcourse.rjs?code=DEPT NNNN  -> one course (description, credits, prereq edges, gen-ed attrs)
//   - getcourse.rjs?subject=PREFIX  -> EVERY course for a subject prefix in one request (catalog crawl)
//   - getcourseeco.rjs?code=DEPT NNNN -> the course->program reverse index (which degrees require it)
//
// Prereqs carry showCourse('CODE') handlers = machine-extractable edges. The Attributes line
// carries gen-ed / Quest / writing-requirement flags. NOTE: codes need the SPACE form
// ("COP 3530"); the no-space form returns an empty envelope.

import type { Http } from "../core/http.js";
import { TTL } from "../core/cache.js";

const RIBBIT = "https://catalog.ufl.edu/ribbit/index.cgi";

export interface CourseLeafCourse {
  code: string;
  title: string;
  credits: number;
  description: string;
  prereqText: string;
  prereqLinkedCodes: string[];
  prereqAllCodes: string[];
  /** Gen-ed / Quest / writing-requirement flags from the Attributes line (raw text). */
  attributes: string;
}

export interface ProgramRef {
  program: string; // display name, e.g. "Aerospace Engineering"
  url: string; // /UGRD/colleges-schools/<COLLEGE>/<PROGRAM>/...
  college?: string; // e.g. UGENG
  programCode?: string; // e.g. ARO_BSAE
}

const ENTITIES: Record<string, string> = {
  "&#160;": " ",
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

const decode = (s: string) => s.replace(/&#160;|&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => ENTITIES[m] ?? m);
const stripTags = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const CODE_RE = /\b[A-Z]{3}\s?\d{4}[A-Z]?\b/g;

function toCatalogCode(code: string): string {
  const m = code.toUpperCase().match(/^([A-Z]{3})\s?(\d{4}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : "";
}

/** Parse one CourseLeaf courseblock HTML fragment into a structured course. */
function parseCourseBlock(code: string, html: string): CourseLeafCourse {
  const credits = Number(html.match(/<span class="credits">\s*([\d.]+)/)?.[1] ?? 0);

  const titleBlock = html.match(/courseblocktitle[^>]*">([\s\S]*?)<\/p>/)?.[1] ?? "";
  const title = stripTags(titleBlock.replace(/<span class="credits">[\s\S]*?<\/span>/, ""))
    .replace(/^[A-Z]{3}\s?\d{4}[A-Z]?\s*/, "")
    .replace(/\d+\s*Credits?$/i, "")
    .trim();

  const description = stripTags(html.match(/courseblockdesc[^>]*">([\s\S]*?)<\/p>/)?.[1] ?? "");

  const prereqBlock = html.match(/<strong>Prerequisite:<\/strong>([\s\S]*?)<\/p>/)?.[1] ?? "";
  const prereqText = stripTags(prereqBlock);
  const prereqLinkedCodes = [
    ...new Set([...prereqBlock.matchAll(/showCourse\(this,\s*'([^']+)'\)/g)].map((m) => m[1].replace(/\s+/g, ""))),
  ];
  const prereqAllCodes = [...new Set((prereqText.match(CODE_RE) ?? []).map((c) => c.replace(/\s+/g, "")))];

  const attributes = stripTags(html.match(/<strong>Attributes:<\/strong>([\s\S]*?)<\/p>/)?.[1] ?? "");

  return {
    code: code.toUpperCase().replace(/\s+/g, ""),
    title,
    credits,
    description,
    prereqText,
    prereqLinkedCodes,
    prereqAllCodes,
    attributes,
  };
}

export class CatalogService {
  constructor(private http: Http) {}

  /** One course's catalog entry (description, credits, prereq edges, gen-ed attrs). Null if not found. */
  async course(code: string): Promise<CourseLeafCourse | null> {
    const catalogCode = toCatalogCode(code);
    if (!catalogCode) throw new Error(`unparseable course code: ${code}`);
    const xml = await this.http.getText(`${RIBBIT}?page=getcourse.rjs&code=${encodeURIComponent(catalogCode)}`, {
      ttlMs: TTL.week,
      cacheKey: `courseleaf:course:${catalogCode}`,
    });
    const html = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]?.trim();
    if (!html) return null;
    return parseCourseBlock(code, html);
  }

  /**
   * EVERY course for a subject prefix in one request (the catalog-crawl primitive).
   * Iterate over the subject list to ingest the whole catalog in ~138-372 calls.
   */
  async subject(prefix: string): Promise<CourseLeafCourse[]> {
    const p = prefix.toUpperCase();
    const xml = await this.http.getText(`${RIBBIT}?page=getcourse.rjs&subject=${encodeURIComponent(p)}`, {
      ttlMs: TTL.week,
      cacheKey: `courseleaf:subject:${p}`,
    });
    const out: CourseLeafCourse[] = [];
    for (const m of xml.matchAll(/<course code="([^"]+)">\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/course>/g)) {
      out.push(parseCourseBlock(m[1], m[2]));
    }
    return out;
  }

  /** The course -> program reverse index: every degree program that requires/references a course. */
  async referencingPrograms(code: string): Promise<ProgramRef[]> {
    const catalogCode = toCatalogCode(code);
    if (!catalogCode) throw new Error(`unparseable course code: ${code}`);
    const xml = await this.http.getText(`${RIBBIT}?page=getcourseeco.rjs&code=${encodeURIComponent(catalogCode)}`, {
      ttlMs: TTL.week,
      cacheKey: `courseleaf:eco:${catalogCode}`,
    });
    const html = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? "";
    const out: ProgramRef[] = [];
    for (const m of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const url = m[1];
      const program = stripTags(m[2]);
      const seg = url.match(/\/UGRD\/colleges-schools\/([^/]+)\/([^/]+)\//);
      out.push({ program, url, college: seg?.[1], programCode: seg?.[2] });
    }
    return out;
  }
}
