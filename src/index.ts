// uf-api — the UF Data SDK.
//
// One client, every UF public data source, with caching + polite rate limiting built in:
//
//   import { createClient } from "uf-api";
//   const uf = createClient();
//   const filters = await uf.soc.filters("2268");           // terms + departments
//   const courses = await uf.soc.schedule({ term: "2268", dept: "19050000" });
//   const prof    = await uf.professors.resolve("Nicholas Napoli", "EEL3135");
//   const course  = await uf.catalog.course("EEL3135");      // description + prereq edges
//
// Every endpoint is public and unauthenticated. These are unofficial UF endpoints that may
// change; cache aggressively (the SDK does by default) and treat the data as sourced from
// UF's public web, not an official feed.

import { Http, type HttpOptions } from "./core/http.js";
import { SocService } from "./services/soc.js";
import { ProfessorsService } from "./services/professors.js";
import { CatalogService } from "./services/catalog.js";
import { TransferService } from "./services/transfer.js";
import { GradesService } from "./services/grades.js";

export interface UFClient {
  /** UF Schedule of Courses: filters, schedule, offering history. */
  soc: SocService;
  /** RateMyProfessors (UF): resolve instructors, difficulty tiers. */
  professors: ProfessorsService;
  /** UF Catalog (CourseLeaf): descriptions, prerequisite edges, course-to-program graph. */
  catalog: CatalogService;
  /** Florida transfer-course equivalencies (FLVC / SCNS). */
  transfer: TransferService;
  /** UF OIPR grade distributions (Tableau Public). */
  grades: GradesService;
  /** The shared HTTP core (cache, rate limiter) if you need direct access. */
  http: Http;
}

/** Create a UF Data client. Pass a custom cache, User-Agent, rate limit, or timeout. */
export function createClient(opts: HttpOptions = {}): UFClient {
  const http = new Http(opts);
  return {
    soc: new SocService(http),
    professors: new ProfessorsService(http),
    catalog: new CatalogService(http),
    transfer: new TransferService(http),
    grades: new GradesService(http),
    http,
  };
}

export * from "./core/types.js";
export { MemoryCache, TTL } from "./core/cache.js";
export type { Cache } from "./core/cache.js";
export { Http, HttpError, type HttpOptions } from "./core/http.js";
export { SocService } from "./services/soc.js";
export type { SocFilters, SocCourse, SocSection, ScheduleQuery } from "./services/soc.js";
export { ProfessorsService } from "./services/professors.js";
export type { RmpTeacher, RmpTeacherDetail } from "./services/professors.js";
export { CatalogService } from "./services/catalog.js";
export type { CourseLeafCourse, ProgramRef } from "./services/catalog.js";
export { TransferService, UF_INSTITUTION_ID } from "./services/transfer.js";
export type { FlvcInstitution, FlvcCourse, FlvcCourseDetail } from "./services/transfer.js";
export { GradesService } from "./services/grades.js";
export type { TableauWorkbookMeta, TableauWorkbookSummary } from "./services/grades.js";
