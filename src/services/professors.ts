// Professors service — RateMyProfessors public GraphQL, scoped to UF.
// The Basic token is RMP's own public frontend token (base64 "test:test"), shipped in
// their site JS — not a secret. UF schoolID is the Relay global id, not the raw 1100.

import type { Http } from "../core/http.js";
import { TTL } from "../core/cache.js";
import type { DifficultyTier } from "../core/types.js";

const GRAPHQL = "https://www.ratemyprofessors.com/graphql";
const UF_SCHOOL_ID = "U2Nob29sLTExMDA=";
const AUTH = "Basic dGVzdDp0ZXN0";

export interface RmpTeacher {
  id: string;
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

const SEARCH_Q = `query SearchTeachers($query: TeacherSearchQuery!) {
  newSearch { teachers(query: $query) { resultCount edges { node {
    id legacyId firstName lastName department
    avgRating avgDifficulty numRatings wouldTakeAgainPercent } } } }
}`;

const DETAIL_Q = `query GetTeacher($id: ID!) {
  node(id: $id) { __typename ... on Teacher {
    id legacyId firstName lastName department avgRating avgDifficulty numRatings wouldTakeAgainPercent
    ratingsDistribution { r1 r2 r3 r4 r5 total }
    teacherRatingTags { tagName tagCount }
    courseCodes { courseName courseCount } } }
}`;

const norm = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();

export class ProfessorsService {
  constructor(private http: Http) {}

  private gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    return this.http
      .postJson<{ data?: T; errors?: unknown }>(GRAPHQL, { query, variables }, { headers: { Authorization: AUTH } })
      .then((j) => {
        if (j.errors) throw new Error(`RMP graphql errors: ${JSON.stringify(j.errors)}`);
        if (!j.data) throw new Error("RMP graphql: no data");
        return j.data;
      });
  }

  /** Search UF professors by name. */
  async search(name: string): Promise<RmpTeacher[]> {
    const key = `rmp:search:${norm(name)}`;
    const cached = await this.http.cache.get<RmpTeacher[]>(key);
    if (cached !== undefined) return cached;
    const data = await this.gql<{ newSearch: { teachers: { edges: { node: RmpTeacher }[] } } }>(SEARCH_Q, {
      query: { text: name, schoolID: UF_SCHOOL_ID },
    });
    const list = data.newSearch.teachers.edges.map((e) => e.node);
    await this.http.cache.set(key, list, TTL.week);
    return list;
  }

  /** Full detail (distribution, tags, courses taught) for one professor node id. */
  async detail(id: string): Promise<RmpTeacherDetail> {
    const key = `rmp:detail:${id}`;
    const cached = await this.http.cache.get<RmpTeacherDetail>(key);
    if (cached !== undefined) return cached;
    const data = await this.gql<{ node: RmpTeacherDetail }>(DETAIL_Q, { id });
    await this.http.cache.set(key, data.node, TTL.week);
    return data.node;
  }

  /** Resolve a SOC instructor name to the best UF match, disambiguating by course taught. */
  async resolve(name: string, courseCode?: string): Promise<RmpTeacher | null> {
    const matches = await this.search(name);
    if (matches.length === 0) return null;
    if (matches.length === 1 || !courseCode) return matches[0];
    const target = norm(courseCode);
    for (const m of matches) {
      try {
        const d = await this.detail(m.id);
        if (d.courseCodes.some((c) => norm(c.courseName) === target)) return m;
      } catch {
        /* ignore and fall back */
      }
    }
    return matches[0];
  }

  /** Map avgDifficulty (1-5) to a tier; undefined when the signal is too thin to trust. */
  difficultyTier(avgDifficulty: number, numRatings: number, minRatings = 5): DifficultyTier | undefined {
    if (numRatings < minRatings) return undefined;
    if (avgDifficulty < 2.5) return "easy";
    if (avgDifficulty < 3.4) return "medium";
    return "hard";
  }
}
