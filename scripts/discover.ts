/**
 * discover.ts — automated UF apix endpoint discoverer.
 *
 * Implements the DISCOVERY-METHOD.md tactics in code:
 *   1. fetch the ONE.UF SPA shells
 *   2. extract every <script src> JS chunk (resolved to absolute URLs)
 *   3. fetch each chunk and grep for /apix/ paths
 *   4. parse the (0,x.Ay)("/apix/<svc>/<op>","get"|"post",{},<authBool>) call signatures
 *      -> method + auth-required for each endpoint, no login ever attempted
 *   5. fetch the public service catalog (/apix/search/getpubliclists)
 *
 * Public, unauthenticated, one-shot. Re-run after any ONE.UF redesign (chunk
 * hashes rotate). Output: discovery/apix-surface.json + a printed summary.
 *
 * Run: npx tsx scripts/discover.ts
 */

import { mkdir, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (uf-api discovery; +https://github.com/RSCAV/uf-api)";
const MAX_CHUNKS = 60;

const SHELLS = [
  "https://one.ufl.edu/",
  "https://one.ufl.edu/soc/",
  "https://one.ufl.edu/dashboard/",
  "https://one.ufl.edu/workspace/",
];

const APIX_RE = /\/apix\/[a-zA-Z0-9/_.\-]+/g;
// minified call wrapper: (0,x.Ay)("/apix/svc/op","get",{},!0)  -> path, method, authBool
const CALL_RE =
  /\(0,[\w$]+\.[\w$]+\)\(\s*["'](\/apix\/[^"']+)["']\s*,\s*["'](get|post|put|delete)["']\s*,\s*[^,]*,\s*(!0|!1|true|false)/gi;
const SCRIPT_RE = /<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi;

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function extractScriptUrls(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(SCRIPT_RE)) {
    try {
      out.add(new URL(m[1], base).href);
    } catch {
      /* skip malformed */
    }
  }
  return [...out];
}

interface ApiCall {
  path: string;
  method: string;
  authRequired: boolean;
  foundIn: string;
}

async function main() {
  console.log("UF apix discovery — executing DISCOVERY-METHOD.md tactics\n");

  // 1-2. Collect script chunk URLs from every shell.
  const chunkUrls = new Set<string>();
  for (const shell of SHELLS) {
    const html = await fetchText(shell);
    if (!html) {
      console.log(`  shell ${shell} -> (no response)`);
      continue;
    }
    const scripts = extractScriptUrls(html, shell);
    scripts.forEach((s) => chunkUrls.add(s));
    console.log(`  shell ${shell} -> ${scripts.length} script chunks`);
  }
  const chunks = [...chunkUrls].slice(0, MAX_CHUNKS);
  console.log(`\nScanning ${chunks.length} JS chunks for /apix/ paths...\n`);

  // 3-4. Grep each chunk for apix paths + call signatures.
  const paths = new Set<string>();
  const calls: ApiCall[] = [];
  const seenCall = new Set<string>();
  for (const url of chunks) {
    const js = await fetchText(url);
    if (!js) continue;
    for (const m of js.matchAll(APIX_RE)) paths.add(m[0]);
    for (const m of js.matchAll(CALL_RE)) {
      const key = `${m[2]} ${m[1]}`;
      if (seenCall.has(key)) continue;
      seenCall.add(key);
      calls.push({
        path: m[1],
        method: m[2].toUpperCase(),
        authRequired: m[3] === "!0" || m[3] === "true",
        foundIn: url.split("/").pop() ?? url,
      });
    }
  }

  // 5. The public service catalog (feature -> required login tier).
  const serviceCatalogRaw = await fetchText("https://one.ufl.edu/apix/search/getpubliclists");
  let serviceCatalog: unknown = null;
  try {
    serviceCatalog = JSON.parse(serviceCatalogRaw);
  } catch {
    /* not json or empty */
  }

  // Group apix paths by service (the /apix/<service>/ prefix).
  const byService: Record<string, string[]> = {};
  for (const p of paths) {
    const svc = p.split("/")[2] ?? "(root)";
    (byService[svc] ??= []).push(p);
  }

  // Authoritative auth map: the public service catalog lists each ONE.UF feature and
  // the login tier it requires. This is more reliable than the minified 4th-arg boolean
  // (an advisory hint only — it mislabels some public infra calls as auth-required).
  interface Feature {
    title: string;
    url: string;
    tier: string;
  }
  const gatedFeatures: Feature[] = [];
  if (Array.isArray(serviceCatalog)) {
    for (const group of serviceCatalog as Array<{ login?: string; items?: Array<{ title?: string; url?: string }> }>) {
      const tier = group?.login ?? "unknown";
      for (const item of group?.items ?? []) {
        if (item?.url?.startsWith("/")) gatedFeatures.push({ title: item.title ?? "", url: item.url, tier });
      }
    }
  }

  const result = {
    scannedShells: SHELLS,
    scannedChunks: chunks.length,
    apixPathCount: paths.size,
    serviceCount: Object.keys(byService).length,
    services: Object.fromEntries(
      Object.entries(byService).map(([k, v]) => [k, [...new Set(v)].sort()]),
    ),
    callSignatures: calls
      .map((c) => ({ method: c.method, path: c.path, authHint: c.authRequired, foundIn: c.foundIn }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    gatedFeatures,
    serviceCatalog,
  };

  await mkdir("discovery", { recursive: true });
  await writeFile("discovery/apix-surface.json", JSON.stringify(result, null, 2));

  // Summary.
  console.log("=== apix services discovered (eager public surface) ===");
  for (const [svc, ps] of Object.entries(byService).sort()) {
    console.log(`  /apix/${svc}/  (${ps.length} paths)`);
  }
  console.log("\n=== call signatures from bundles (authHint is a heuristic — verify, do not trust blindly) ===");
  for (const c of calls.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`  ${c.method.padEnd(4)} ${c.path}  authHint=${c.authRequired}`);
  }
  console.log("\n=== login-gated features (AUTHORITATIVE, from /apix/search/getpubliclists) ===");
  for (const f of gatedFeatures) {
    console.log(`  [${f.tier.padEnd(10)}] ${f.url.padEnd(18)} ${f.title}`);
  }
  console.log(
    `\nTotal: ${paths.size} apix paths across ${result.serviceCount} eager public services; ` +
      `${gatedFeatures.length} login-gated features cataloged. Written to discovery/apix-surface.json`,
  );
}

main().catch((e) => {
  console.error("[discover] failed:", e.message);
  process.exit(1);
});
