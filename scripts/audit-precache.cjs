#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Audita o manifesto de precache gerado pelo Workbox (vite-plugin-pwa).
 *
 * Modo padrão (sem flags):
 *   Lista todos os assets pré-cacheados, ordenados por tamanho, e sinaliza
 *   quem está perto/acima do limite (default 2 MiB).
 *
 * Modo --by-rule:
 *   Casa cada arquivo de dist/ contra os globPatterns/globIgnores do
 *   vite.config.ts e imprime quantos arquivos (e quantos bytes) entraram
 *   por cada regra — útil para ajustar globIgnores com precisão.
 *
 * Uso:
 *   bun run audit:precache                  # listagem padrão
 *   bun run audit:precache --by-rule        # agrupado por glob pattern/ignore
 *   bun run audit:precache --limit=3        # limite (em MiB) para o aviso
 */
const fs = require("fs");
const path = require("path");

const DIST = path.resolve(process.cwd(), "dist");
const SW_PATH = path.join(DIST, "sw.js");
const VITE_CONFIG = path.resolve(process.cwd(), "vite.config.ts");

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT_MB = limitArg ? parseFloat(limitArg.split("=")[1]) : 2;
const LIMIT_BYTES = LIMIT_MB * 1024 * 1024;
const BY_RULE = args.includes("--by-rule");

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

const fmt = (n) => {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MiB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KiB";
  return n + " B";
};

if (!fs.existsSync(DIST)) fail(`pasta dist/ não encontrada — rode \`bun run build\` antes.`);
if (!fs.existsSync(SW_PATH)) fail(`sw.js não encontrado em ${SW_PATH}.`);

// ───────── Extrai manifesto do sw.js (sandbox vm) ─────────
const sw = fs.readFileSync(SW_PATH, "utf8");
const vm = require("vm");
let entries = [];
const sandbox = {
  self: {
    skipWaiting() {},
    define(_deps, factory) {
      const fakeWb = {
        clientsClaim() {},
        precacheAndRoute(list) { entries = list || []; },
        cleanupOutdatedCaches() {},
        createHandlerBoundToURL() { return () => {}; },
        registerRoute() {},
        NavigationRoute: function () {},
        setCacheNameDetails() {},
      };
      try { factory(fakeWb); } catch { /* ignora handlers de runtime */ }
    },
  },
  importScripts() {},
  location: { href: "https://example.com/sw.js" },
  URL, Promise, Error,
};
sandbox.define = sandbox.self.define;
try {
  vm.createContext(sandbox);
  vm.runInContext(sw, sandbox, { timeout: 2000 });
} catch (e) {
  fail(`não foi possível executar sw.js para extrair manifesto: ${e.message}`);
}
if (!Array.isArray(entries) || entries.length === 0) {
  fail("manifesto de precache vazio — Workbox pode não ter incluído nenhum asset.");
}

const precachedSet = new Set(entries.map((e) => String(e.url || "").replace(/^\//, "")));
const rows = entries
  .map((e) => {
    const url = String(e.url || "").replace(/^\//, "");
    const file = path.join(DIST, url);
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    return { url: e.url, size };
  })
  .sort((a, b) => b.size - a.size);

// ───────── Modo --by-rule: agrupa por globPattern/globIgnore ─────────
if (BY_RULE) {
  if (!fs.existsSync(VITE_CONFIG)) fail("vite.config.ts não encontrado.");
  const cfg = fs.readFileSync(VITE_CONFIG, "utf8");

  function extractArray(name) {
    // Captura: name: [ ... ] (com possíveis quebras de linha e comentários inline).
    const re = new RegExp(`${name}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "m");
    const m = cfg.match(re);
    if (!m) return [];
    const body = m[1];
    // Tokeniza respeitando aspas e chaves {…} (para não quebrar `**/*.{a,b,c}`).
    const out = [];
    let buf = "", quote = null, brace = 0;
    for (const ch of body) {
      if (quote) {
        if (ch === quote) quote = null;
        buf += ch;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch; buf += ch;
      } else if (ch === "{") { brace++; buf += ch; }
      else if (ch === "}") { brace--; buf += ch; }
      else if (ch === "," && brace === 0) {
        out.push(buf); buf = "";
      } else if (ch === "\n" && brace === 0) {
        out.push(buf); buf = "";
      } else {
        buf += ch;
      }
    }
    out.push(buf);
    return out
      .map((s) => s.replace(/\/\/.*$/, "").trim())
      .filter(Boolean)
      .map((s) => s.replace(/^["'`]|["'`]$/g, ""))
      .filter((s) => s && !s.startsWith("//"));
  }

  const globPatterns = extractArray("globPatterns");
  const globIgnores = extractArray("globIgnores");

  if (globPatterns.length === 0 && globIgnores.length === 0) {
    fail("não foi possível localizar globPatterns/globIgnores em vite.config.ts.");
  }

  // Carrega picomatch (lib que o Workbox usa internamente para casar globs)
  let picomatch;
  try {
    picomatch = require("picomatch");
  } catch {
    // Fallback: tenta no cache do bun
    const found = require("child_process")
      .execSync("find node_modules -name picomatch -type d -maxdepth 6 2>/dev/null | head -1")
      .toString().trim();
    if (!found) fail("dependência `picomatch` não encontrada — instale com `bun add -d picomatch`.");
    picomatch = require(path.resolve(found));
  }

  // Lista todos os arquivos em dist/ (recursivamente)
  function walk(dir, prefix = "") {
    const out = [];
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const st = fs.statSync(full);
      if (st.isDirectory()) out.push(...walk(full, rel));
      else out.push({ rel, size: st.size });
    }
    return out;
  }
  const allFiles = walk(DIST);

  const matchers = {
    patterns: globPatterns.map((p) => ({ glob: p, match: picomatch(p, { dot: false }) })),
    ignores: globIgnores.map((p) => ({ glob: p, match: picomatch(p, { dot: false }) })),
  };

  // Buckets
  const patternBuckets = matchers.patterns.map((m) => ({ glob: m.glob, files: [], bytes: 0 }));
  const ignoreBuckets = matchers.ignores.map((m) => ({ glob: m.glob, files: [], bytes: 0 }));
  const ignoredButNotPrecached = []; // bateu ignore E não está no precache (confirma exclusão efetiva)
  const unmatched = []; // não bateu nenhum pattern (não seria precacheado mesmo sem ignores)

  for (const f of allFiles) {
    const matchedIgnores = matchers.ignores.filter((m) => m.match(f.rel));
    const matchedPatterns = matchers.patterns.filter((m) => m.match(f.rel));

    matchedPatterns.forEach((mp) => {
      const b = patternBuckets.find((x) => x.glob === mp.glob);
      b.files.push(f); b.bytes += f.size;
    });
    matchedIgnores.forEach((mi) => {
      const b = ignoreBuckets.find((x) => x.glob === mi.glob);
      b.files.push(f); b.bytes += f.size;
      if (!precachedSet.has(f.rel)) ignoredButNotPrecached.push({ ...f, by: mi.glob });
    });

    if (matchedPatterns.length === 0 && matchedIgnores.length === 0) {
      unmatched.push(f);
    }
  }

  console.log(`\n📐 Auditoria por regra  —  ${allFiles.length} arquivos em dist/`);
  console.log(`   Precacheados pelo Workbox: ${precachedSet.size}`);
  console.log(`   Limite de precache: ${LIMIT_MB} MiB\n`);

  console.log("✅ globPatterns (incluem):");
  if (patternBuckets.length === 0) console.log("   (nenhum pattern definido)");
  patternBuckets.forEach((b) => {
    const inPrecache = b.files.filter((f) => precachedSet.has(f.rel)).length;
    const overLim = b.files.filter((f) => f.size > LIMIT_BYTES).length;
    const flag = overLim > 0 ? "🔴" : inPrecache === b.files.length ? "🟢" : "🟡";
    console.log(
      `  ${flag} ${b.glob.padEnd(40)} → ${String(b.files.length).padStart(3)} arquivo(s)  ` +
      `${fmt(b.bytes).padStart(10)}   precacheados=${inPrecache}` +
      (overLim > 0 ? `  ⚠ ${overLim} acima de ${LIMIT_MB} MiB` : "")
    );
    // top 3 maiores deste bucket
    b.files.sort((a, b2) => b2.size - a.size).slice(0, 3).forEach((f) => {
      const mark = !precachedSet.has(f.rel) ? "  (excluído por ignore/limite)" : "";
      console.log(`        · ${fmt(f.size).padStart(10)}  ${f.rel}${mark}`);
    });
  });

  console.log("\n🚫 globIgnores (excluem):");
  if (ignoreBuckets.length === 0) console.log("   (nenhum ignore definido)");
  ignoreBuckets.forEach((b) => {
    const stillPrecached = b.files.filter((f) => precachedSet.has(f.rel)).length;
    const flag = stillPrecached > 0 ? "🔴" : b.files.length > 0 ? "🟢" : "⚪";
    console.log(
      `  ${flag} ${b.glob.padEnd(40)} → ${String(b.files.length).padStart(3)} arquivo(s)  ` +
      `${fmt(b.bytes).padStart(10)}   ainda precacheados=${stillPrecached}` +
      (stillPrecached > 0 ? "  ⚠ ignore não fez efeito" : "")
    );
    b.files.sort((a, b2) => b2.size - a.size).slice(0, 3).forEach((f) => {
      console.log(`        · ${fmt(f.size).padStart(10)}  ${f.rel}`);
    });
  });

  // Sugestões: arquivos grandes que não casaram nenhum ignore mas estão no precache
  const bigPrecached = rows.filter((r) => r.size > LIMIT_BYTES * 0.5);
  if (bigPrecached.length > 0) {
    console.log("\n💡 Candidatos a globIgnores (>50% do limite e estão no precache):");
    bigPrecached.forEach((r) => {
      const url = String(r.url).replace(/^\//, "");
      // Sugere padrão baseado no diretório/extensão
      const dir = path.dirname(url);
      const ext = path.extname(url);
      const base = path.basename(url, ext).split("-")[0];
      const suggestion = dir === "." ? `**/${base}*${ext}` : `**/${dir}/${base}*${ext}`;
      console.log(`   • ${fmt(r.size).padStart(10)}  ${url}`);
      console.log(`        sugestão: globIgnores += "${suggestion}"`);
    });
  }

  if (unmatched.length > 0) {
    console.log(`\nℹ ${unmatched.length} arquivo(s) em dist/ não casaram nenhum globPattern (não seriam precacheados mesmo sem ignores).`);
  }

  process.exit(0);
}

// ───────── Modo padrão: listagem por tamanho ─────────
const total = rows.reduce((s, r) => s + r.size, 0);
const overLimit = rows.filter((r) => r.size > LIMIT_BYTES);
const nearLimit = rows.filter((r) => r.size <= LIMIT_BYTES && r.size > LIMIT_BYTES * 0.75);

console.log(`\n📦 Workbox precache audit  —  limite: ${LIMIT_MB} MiB`);
console.log(`   ${rows.length} arquivos  ·  total ${fmt(total)}\n`);
console.log("   (use --by-rule para agrupar por globPattern/globIgnore)\n");

console.log("Top 20 maiores:");
rows.slice(0, 20).forEach((r, i) => {
  const flag =
    r.size > LIMIT_BYTES ? "🔴" :
    r.size > LIMIT_BYTES * 0.75 ? "🟡" : "🟢";
  console.log(`  ${flag} ${String(i + 1).padStart(2)}. ${fmt(r.size).padStart(10)}   ${r.url}`);
});

if (overLimit.length) {
  console.log(`\n🔴 ${overLimit.length} arquivo(s) ACIMA do limite (${LIMIT_MB} MiB):`);
  overLimit.forEach((r) => console.log(`   • ${fmt(r.size).padStart(10)}   ${r.url}`));
  console.log(`\n   → Mova para runtime caching ou exclua via globIgnores no vite.config.ts.`);
}

if (nearLimit.length) {
  console.log(`\n🟡 ${nearLimit.length} arquivo(s) perto do limite (>75%):`);
  nearLimit.forEach((r) => console.log(`   • ${fmt(r.size).padStart(10)}   ${r.url}`));
}

if (!overLimit.length) console.log("\n✅ Nenhum asset acima do limite. Precache saudável.\n");

process.exit(overLimit.length > 0 ? 2 : 0);
