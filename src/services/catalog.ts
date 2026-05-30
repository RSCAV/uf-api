// Catalog service — UF Catalog (Leepfrog CourseLeaf) at catalog.ufl.edu.
// Official course descriptions + prerequisites. The getcourse.rjs endpoint returns XML
// wrapping a CDATA HTML block; prerequisites carry showCourse('CODE') handlers that give
// machine-extractable prereq edges, plus the full free-text string for OR-group alternatives.

import type { Http } from "../core/http.js";
import { TTL } from "../core/cache.js";

const RIBBIT = "https://catalog.ufl.edu/ribbit/?page=getcourse.rjs&code=";

export interface CourseLeafCourse {
  code: string;
  title: string;
  credits: number;
  description: string;
  prereqText: string;
  prereqLinkedCodes: string[];
  prereqAllCodes: string[];
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

export class CatalogService {
  constructor(private http: Http) {}

  /** Fetch + parse a single course's catalog entry. Returns null if not found. */
  async course(code: string): Promise<CourseLeafCourse | null> {
    const catalogCode = toCatalogCode(code);
    if (!catalogCode) throw new Error(`unparseable course code: ${code}`);

    const xml = await this.http.getText(`${RIBBIT}${encodeURIComponent(catalogCode)}`, {
      ttlMs: TTL.week,
      cacheKey: `courseleaf:${catalogCode}`,
    });

    const html = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]?.trim();
    if (!html) return null;

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

    return {
      code: code.toUpperCase().replace(/\s+/g, ""),
      title,
      credits,
      description,
      prereqText,
      prereqLinkedCodes,
      prereqAllCodes,
    };
  }
}
