// End-to-end demo of the UF Data SDK. Drives all three services through one client.
// Run: npm run demo   (or: npx tsx src/demo.ts)

import { createClient } from "./index.js";

async function main() {
  const uf = createClient();

  console.log("→ uf.soc.filters('2268')");
  const filters = await uf.soc.filters("2268");
  console.log(`  ${filters.terms.length} terms, ${filters.departments.length} departments, season(2268)=${uf.soc.termToSeason("2268")}`);

  console.log("\n→ uf.soc.schedule({ term:'2268', courseCode:'EEL3135' })");
  const courses = await uf.soc.schedule({ term: "2268", courseCode: "EEL3135" });
  const eel = courses.find((c) => c.code === "EEL3135");
  if (eel) {
    const stub = uf.soc.toCourseStub(eel);
    console.log(`  ${eel.code} — ${eel.name} (${stub.credits}cr), prereqs: ${stub.prereqs?.join(", ")}`);
  }

  console.log("\n→ uf.professors.resolve('Cheryl Resch', 'COP3530')");
  const prof = await uf.professors.resolve("Cheryl Resch", "COP3530");
  if (prof) {
    const tier = uf.professors.difficultyTier(prof.avgDifficulty, prof.numRatings);
    console.log(`  ${prof.firstName} ${prof.lastName} — difficulty ${prof.avgDifficulty} -> tier "${tier}" (${prof.numRatings} ratings)`);
  }

  console.log("\n→ uf.catalog.course('EEL3135') + subject('EEL') + referencingPrograms");
  const cat = await uf.catalog.course("EEL3135");
  if (cat) console.log(`  ${cat.code} — ${cat.title} (${cat.credits}cr); prereq edges: ${cat.prereqLinkedCodes.join(", ")}`);
  const subj = await uf.catalog.subject("EEL");
  console.log(`  catalog.subject('EEL'): ${subj.length} courses in one request`);

  console.log("\n→ uf.transfer.findUFEquivalent('ENC', '1101')");
  const equiv = await uf.transfer.findUFEquivalent("ENC", "1101");
  if (equiv) console.log(`  ${equiv.CourseDept} ${equiv.CourseNo} — ${equiv.CourseTitle} (${equiv.MinCredits}cr) is the UF equivalent`);

  console.log("\n→ uf.grades.workbookMeta()");
  const meta = await uf.grades.workbookMeta();
  console.log(`  "${meta.title}" by ${meta.authorName} — ${meta.viewCount} views (UF per-course grade distributions)`);

  console.log("\n✓ one client, five live UF sources (soc, professors, catalog, transfer, grades), cached + rate-limited.");
}

main().catch((e) => {
  console.error("[demo] failed:", e.message);
  process.exit(1);
});
