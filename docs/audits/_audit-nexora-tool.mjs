// Ferramenta de auditoria NEXORA — lê CADA ficheiro rastreado por git ls-files
// e deriva sinais objetivos por leitura de conteúdo (não são palpites).
// Uso: node audit-nexora.mjs <repoRoot> > out.csv
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.argv[2];
process.chdir(root);

const files = execSync("git ls-files", { maxBuffer: 1024 * 1024 * 50 })
  .toString()
  .split("\n")
  .filter(Boolean);

const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".ico", ".woff", ".woff2", ".ttf"]);

function ext(f) {
  const b = path.basename(f);
  const i = b.lastIndexOf(".");
  return i === -1 ? "" : b.slice(i);
}

function classifyType(f) {
  if (f.startsWith("supabase/migrations/")) return "migration";
  if (f.startsWith("supabase/")) return "supabase-config";
  if (f.startsWith("tests/e2e/") || f.endsWith(".spec.ts")) return "test-e2e";
  if (f.startsWith("tests/integration/")) return "test-integration";
  if (f.startsWith("tests/")) return "test-unit";
  if (f.startsWith("docs/")) return "doc";
  if (f.startsWith("tasks/")) return "task-doc";
  if (f.startsWith("scripts/")) return "script";
  if (f.startsWith(".github/")) return "ci-config";
  if (f === "src/middleware.ts") return "middleware";
  if (/\/route\.ts$/.test(f)) return "route-handler";
  if (/\/page\.tsx$/.test(f)) return "page";
  if (/\/layout\.tsx$/.test(f)) return "layout";
  if (/\/(actions|mutations)\.ts$/.test(f)) return "server-actions";
  if (/\/(queries|data)\.ts$/.test(f)) return "server-queries";
  if (f.endsWith(".tsx")) return "component";
  if (f.endsWith(".ts")) return "module-ts";
  if (f.endsWith(".css")) return "style";
  if (f.endsWith(".json")) return "config-json";
  if (BINARY_EXT.has(ext(f))) return "asset-binary";
  return "other";
}

function featureOf(f) {
  let m = f.match(/^src\/features\/([^/]+)\//);
  if (m) return m[1];
  m = f.match(/^src\/app\/\(dashboard\)\/dashboard\/([^/]+)/);
  if (m) return "dashboard-" + m[1];
  if (f.startsWith("src/app/(dashboard)/dashboard/")) return "dashboard-home";
  if (f.startsWith("src/app/b/")) return "public-booking";
  if (f.startsWith("src/app/marcacao")) return "public-lookup";
  if (f.startsWith("src/app/(auth)")) return "auth";
  if (f.startsWith("src/app/(onboarding)")) return "onboarding";
  if (f.startsWith("src/app/api/cron")) return "cron";
  if (f.startsWith("src/app/api/public")) return "public-api";
  if (f.startsWith("src/lib/supabase")) return "supabase-clients";
  if (f.startsWith("src/lib/auth")) return "auth";
  if (f.startsWith("src/lib")) return "shared-lib";
  if (f.startsWith("supabase/migrations")) return "db-migrations";
  if (f.startsWith("supabase")) return "db-config";
  if (f.startsWith("tests/e2e")) return "e2e";
  if (f.startsWith("tests/integration")) return "integration-tests";
  if (f.startsWith("tests")) return "unit-tests";
  if (f.startsWith("docs")) return "docs";
  if (f.startsWith("tasks")) return "planning";
  if (f.startsWith("scripts")) return "tooling";
  return "root";
}

function readSafe(f) {
  try {
    const st = fs.statSync(f);
    if (st.size > 2_000_000) return null;
    if (BINARY_EXT.has(ext(f))) return null;
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
}

function csvField(v) {
  if (v === null || v === undefined) v = "";
  v = String(v).replace(/"/g, '""');
  if (/[",\n]/.test(v)) return `"${v}"`;
  return v;
}

const header = [
  "caminho","tipo","feature","responsabilidade","camada",
  "importadores_principais","dependencias_pesadas",
  "leitura_dados","escrita_dados","cache_atual","invalidacao_atual",
  "risco_seguranca","risco_desempenho","codigo_duplicado",
  "teste_associado","acao_recomendada","prioridade","estado",
];

console.log(header.join(","));

const testFiles = files.filter((f) => f.startsWith("tests/"));
const srcFiles = files.filter((f) => f.startsWith("src/") && /\.(ts|tsx)$/.test(f));

// Build a lightweight reverse-import index for src/**/*.{ts,tsx}
const importIndex = new Map(); // targetBasenameNoExt -> [importer,...]
for (const f of srcFiles) {
  const c = readSafe(f);
  if (!c) continue;
  const re = /from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(c))) {
    const spec = m[1];
    if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
    let resolved;
    if (spec.startsWith("@/")) resolved = "src/" + spec.slice(2);
    else resolved = path.posix.normalize(path.posix.join(path.posix.dirname(f), spec));
    const key = resolved.replace(/\\/g, "/");
    if (!importIndex.has(key)) importIndex.set(key, []);
    importIndex.get(key).push(f);
  }
}
function importersOf(f) {
  const noExt = f.replace(/\.(tsx|ts)$/, "");
  const hits = importIndex.get(noExt) || [];
  const uniq = [...new Set(hits)];
  return uniq.slice(0, 5).join(" | ");
}

for (const f of files) {
  const content = readSafe(f);
  const type = classifyType(f);
  const feature = featureOf(f);
  const isBinary = content === null;

  let camada = "shared";
  if (content !== null) {
    if (/^\s*['"]use client['"]/.test(content)) camada = "client";
    else if (/^\s*['"]use server['"]/.test(content) || ["route-handler","server-actions","page","layout","server-queries","middleware"].includes(type)) camada = "server";
    else if (type.startsWith("test")) camada = "test";
    else if (type === "migration" || type === "supabase-config") camada = "db";
    else if (type === "doc" || type === "task-doc") camada = "docs";
  } else {
    camada = "binary";
  }

  const leitura = content
    ? (content.match(/\.rpc\(/) ? "rpc" : /\.from\(|\.select\(/.test(content) ? "select/from" : "")
    : "";
  const escrita = content && /\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(content) ? "mutacao-supabase" : "";
  const cache = content
    ? (/no-store/.test(content) ? "no-store"
      : /force-dynamic/.test(content) ? "force-dynamic"
      : /unstable_cache/.test(content) ? "unstable_cache"
      : /\bcache\(/.test(content) ? "react-cache"
      : "")
    : "";
  const invalidacao = content
    ? (/revalidatePath/.test(content) ? "revalidatePath"
      : /revalidateTag/.test(content) ? "revalidateTag"
      : "")
    : "";

  let riscoSeg = "";
  if (content) {
    if (/service_role|SUPABASE_SERVICE_ROLE/.test(content) && camada === "client") riscoSeg = "ALTO: possivel service role em client";
    else if (/createAdminClient/.test(content) && camada === "client") riscoSeg = "ALTO: admin client referenciado em client";
    else if (/select\(['"]\*['"]\)/.test(content)) riscoSeg = "MEDIO: select('*') presente";
    else riscoSeg = "sem sinal automatico";
  }

  const heavyDeps = content ? (content.match(/from\s+["'](pdfkit|exceljs|sharp|qrcode)["']/g) || []).join(";") : "";

  const stem = path.basename(f).replace(/\.(tsx|ts)$/, "");
  const relatedTest = testFiles.find((t) => t.includes(stem)) || "";

  const importers = srcFiles.includes(f) ? importersOf(f) : "";

  const row = [
    f, type, feature,
    isBinary ? "binario/gerado — nao aplicavel leitura de texto" : "",
    camada,
    importers,
    heavyDeps,
    leitura, escrita, cache, invalidacao,
    riscoSeg,
    "", // risco desempenho — carimbado manualmente para ficheiros criticos na secao correspondente
    "", // codigo duplicado — nao avaliado por par em massa (ver relatorio, secao de duplicacoes conhecidas)
    relatedTest,
    "",
    "",
    isBinary ? "revisto (binario/gerado)" : "revisto (automatizado por padrao de conteudo)",
  ];
  console.log(row.map(csvField).join(","));
}
