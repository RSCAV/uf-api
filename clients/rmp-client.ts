/**
 * rmp-client.ts — RateMyProfessors public GraphQL client for instructor difficulty.
 *
 * Source documentation: ../ENDPOINTS.md (RateMyProfessors section)
 *
 * Turns the guessed difficulty_tier into a crowd-sourced signal. Given an instructor
 * name from the SOC feed, resolves their UF RateMyProfessors profile and returns
 * avgDifficulty / avgRating / wouldTakeAgainPercent, disambiguated by department and
 * the courses they have actually taught.
 *
 * The Basic token below is RMP's own public frontend token (base64 "test:test"); it is
 * shipped in their site's JavaScript, not a secret. The UF schoolID is the Relay global
 * id (base64 "School-1100"), NOT the raw legacyId 1100.
 *
 * Responsible use: resolve instructors OFFLINE during catalog ingest, cache 7 days,
 * ~1 request per uncached instructor, never loop. Deep-link to RMP rather than
 * re-hosting review text.
 */

import type { DifficultyTier } from "./types.js";

const GRAPHQL = "https://www.ratemyprofessors.com/graphql";
const UF_SCHOOL_ID = "U2Nob29sLTExMDA="; // base64 "School-1100"
const PUBLIC_TOKEN = "dGVzdDp0ZXN0"; // base64 "test:test" — RMP's own public frontend token
const UA = "Mozilla/5.0 (Gradvisr instructor enrichment; +https://github.com/RSCAV/gradvisr)";

export interface RmpTeacher {
  id: string; // Relay node id
  legacyId: number;
  firstName: string;
  lastName: string;
  department: string;
  avgRating: number;
  avgDifficulty: number;
  numRatings: number;
  wouldTakeAgainPercent: number;
}

export interface RmpTeacherDetail extends RmpTeacher {
  ratingsDistribution: { r1: number; r2: number; r3: number; r4: number; r5: number; total: number };
  teacherRatingTags: { tagName: string; tagCount: number }[];
  courseCodes: { courseName: string; courseCount: number }[];
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${PUBLIC_TOKEN}`,
      "User-Agent": UA,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`RMP graphql -> HTTP ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(`RMP graphql errors: ${JSON.stringify(json.errors)}`);
  if (!json.data) throw new Error("RMP graphql: no data");
  return json.data;
}

const SEARCH_Q = `query SearchTeachers($query: TeacherSearchQuery!) {
  newSearch { teachers(query: $query) { resultCount edges { node {
    id legacyId firstName lastName department
    avgRating avgDifficulty numRatings wouldTakeAgainPercent
  } } } }
}`;

const DETAIL_Q = `query GetTeacher($id: ID!) {
  node(id: $id) { __typename ... on Teacher {
    id legacyId firstName lastName department
    avgRating avgDifficulty numRatings wouldTakeAgainPercent
    ratingsDistribution { r1 r2 r3 r4 r5 total }
    teacherRatingTags { tagName tagCount }
    courseCodes { courseName courseCount }
  } }
}`;

interface SearchResp {
  newSearch: { teachers: { resultCount: number; edges: { node: RmpTeacher }[] } };
}

/** Search UF professors by name. Returns all matches (resultCount + nodes). */
export async function searchTeachers(name: string): Promise<RmpTeacher[]> {
  const data = await gql<SearchResp>(SEARCH_Q, {
    query: { text: name, schoolID: UF_SCHOOL_ID },
  });
  return data.newSearch.teachers.edges.map((e) => e.node);
}

/** Full detail (distribution, tags, courses taught) for one professor node id. */
export async function getTeacherDetail(id: string): Promise<RmpTeacherDetail> {
  const data = await gql<{ node: RmpTeacherDetail }>(DETAIL_Q, { id });
  return data.node;
}

const norm = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();

/**
 * Resolve a SOC instructor name (e.g. "Nicholas Napoli") to the best RMP match.
 * If a courseCode is given and multiple professors match, prefer the one whose
 * taught courses include it (the safe disambiguation). Returns null on no match.
 */
export async function resolveInstructor(
  name: string,
  courseCode?: string,
): Promise<RmpTeacher | null> {
  const matches = await searchTeachers(name);
  if (matches.length === 0) return null;
  if (matches.length === 1 || !courseCode) return matches[0];

  // Disambiguate by which professor has taught this course.
  const target = norm(courseCode);
  for (const m of matches) {
    try {
      const detail = await getTeacherDetail(m.id);
      if (detail.courseCodes.some((c) => norm(c.courseName) === target)) return m;
    } catch {
      /* fall through to default */
    }
  }
  return matches[0];
}

/**
 * Map RMP avgDifficulty (1-5 scale) to Gradvisr's DifficultyTier.
 * Returns undefined when the signal is too thin (fewer than minRatings) to trust.
 */
export function difficultyTierFromRMP(
  avgDifficulty: number,
  numRatings: number,
  minRatings = 5,
): DifficultyTier | undefined {
  if (numRatings < minRatings) return undefined;
  if (avgDifficulty < 2.5) return "easy";
  if (avgDifficulty < 3.4) return "medium";
  return "hard";
}

// ---------- Demo / smoke test (run: npx tsx src/rmp-client.ts "Nicholas Napoli" EEL3135) ----------

async function main() {
  const name = process.argv[2] || "Cheryl Resch";
  const course = process.argv[3];
  console.log(`→ resolveInstructor("${name}"${course ? `, "${course}"` : ""}) ...`);
  const prof = await resolveInstructor(name, course);
  if (!prof) {
    console.log("  no UF match found.");
    return;
  }
  console.log(`  ${prof.firstName} ${prof.lastName} — ${prof.department}`);
  console.log(
    `  avgDifficulty=${prof.avgDifficulty}  avgRating=${prof.avgRating}  ` +
      `numRatings=${prof.numRatings}  wouldTakeAgain=${prof.wouldTakeAgainPercent}%`,
  );
  console.log(`  -> difficulty_tier = ${difficultyTierFromRMP(prof.avgDifficulty, prof.numRatings) ?? "(too few ratings)"}`);
  const detail = await getTeacherDetail(prof.id);
  console.log(`  taught: ${detail.courseCodes.slice(0, 6).map((c) => `${c.courseName}(${c.courseCount})`).join(", ")}`);
  console.log(`  rmp page: https://www.ratemyprofessors.com/professor/${prof.legacyId}`);
}

const isMain = !!process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error("[rmp-client] demo failed:", e.message);
    process.exit(1);
  });
}
