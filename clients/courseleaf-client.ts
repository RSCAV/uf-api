/**
 * courseleaf-client.ts — UF Catalog (Leepfrog CourseLeaf) single-course client.
 *
 * Source documentation: ../ENDPOINTS.md (UF Catalog section)
 *
 * The official source of clean course DESCRIPTIONS and PREREQUISITES. The endpoint
 * returns XML wrapping a CDATA HTML block; prerequisites carry showCourse('CODE')
 * onclick handlers, which give machine-extractable prereq edges with no NLP, plus
 * the full free-text prereq string for the OR-group alternatives.
 *
 *   GET https://catalog.ufl.edu/ribbit/?page=getcourse.rjs&code=SUBJ+NUM
 *
 * This complements the SOC feed: SOC tells you what is offered when; CourseLeaf gives
 * the authoritative catalog description + the linked prerequisite graph.
 */

const BASE = "https://catalog.ufl.edu/ribbit/?page=getcourse.rjs&code=";
const UA = "Mozilla/5.0 (Gradvisr catalog ingester; +https://github.com/RSCAV/gradvisr)";

export interface CourseLeafCourse {
  code: string; // normalized, no space (e.g. "EEL3135")
  title: string;
  credits: number;
  description: string;
  prereqText: string; // full free-text prerequisite line, "" if none
  prereqLinkedCodes: string[]; // codes UF explicitly linked via showCourse() — the primary prereqs
  prereqAllCodes: string[]; // every course code mentioned anywhere in the prereq text (incl. OR alternatives)
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

function decode(s: string): string {
  return s.replace(/&#160;|&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => ENTITIES[m] ?? m);
}

function stripTags(html: string): string {
  return decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** "EEL3135" / "eel 3135" -> "EEL 3135" for the catalog query; returns "" if unparseable. */
function toCatalogCode(code: string): string {
  const m = code.toUpperCase().match(/^([A-Z]{3})\s?(\d{4}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : "";
}

const CODE_RE = /\b[A-Z]{3}\s?\d{4}[A-Z]?\b/g;

/** Fetch + parse a single course's catalog entry. Returns null if the course is not found. */
export async function fetchCourse(code: string): Promise<CourseLeafCourse | null> {
  const catalogCode = toCatalogCode(code);
  if (!catalogCode) throw new Error(`unparseable course code: ${code}`);

  const res = await fetch(`${BASE}${encodeURIComponent(catalogCode)}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`GET courseleaf ${catalogCode} -> HTTP ${res.status}`);
  const xml = await res.text();

  // The HTML lives inside <![CDATA[ ... ]]>. Empty CDATA => course not found.
  const cdata = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const html = cdata?.[1]?.trim();
  if (!html) return null;

  const credits = Number(html.match(/<span class="credits">\s*([\d.]+)/)?.[1] ?? 0);

  // Title: text of the title block minus the trailing "<N> Credits" span.
  const titleBlock = html.match(/courseblocktitle[^>]*">([\s\S]*?)<\/p>/)?.[1] ?? "";
  const title = stripTags(titleBlock.replace(/<span class="credits">[\s\S]*?<\/span>/, ""))
    .replace(/^[A-Z]{3}\s?\d{4}[A-Z]?\s*/, "") // drop the leading code
    .replace(/\d+\s*Credits?$/i, "")
    .trim();

  const description = stripTags(html.match(/courseblockdesc[^>]*">([\s\S]*?)<\/p>/)?.[1] ?? "");

  // Prerequisite block (may be absent).
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

// ---------- Demo / smoke test (run: npx tsx src/courseleaf-client.ts EEL3135) ----------

async function main() {
  const code = process.argv[2] || "EEL3135";
  console.log(`→ fetchCourse("${code}") ...`);
  const c = await fetchCourse(code);
  if (!c) {
    console.log("  not found in catalog.");
    return;
  }
  console.log(`  ${c.code} — ${c.title} (${c.credits}cr)`);
  console.log(`  description: ${c.description.slice(0, 140)}...`);
  console.log(`  prereq (linked edges): ${c.prereqLinkedCodes.join(", ") || "(none)"}`);
  console.log(`  prereq (all codes):    ${c.prereqAllCodes.join(", ") || "(none)"}`);
  console.log(`  prereq text: ${c.prereqText || "(none)"}`);
}

const isMain = !!process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error("[courseleaf-client] demo failed:", e.message);
    process.exit(1);
  });
}
