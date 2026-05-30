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

  console.log("\n→ uf.catalog.course('EEL3135')");
  const cat = await uf.catalog.course("EEL3135");
  if (cat) {
    console.log(`  ${cat.code} — ${cat.title} (${cat.credits}cr)`);
    console.log(`  prereq edges: ${cat.prereqLinkedCodes.join(", ")} | all codes: ${cat.prereqAllCodes.length}`);
  }

  console.log("\n✓ one client, three live UF sources, cached + rate-limited.");
}

main().catch((e) => {
  console.error("[demo] failed:", e.message);
  process.exit(1);
});
