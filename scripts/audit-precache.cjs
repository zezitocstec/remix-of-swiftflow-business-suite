#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Audita o manifesto de precache gerado pelo Workbox (vite-plugin-pwa).
 * Lista todos os assets que entraram no precache, seus tamanhos e sinaliza
 * quem está perto/acima do limite (default 2 MiB).
 *
 * Uso:
 *   bun run audit:precache              # após `bun run build`
 *   bun run audit:precache --limit=3    # define limite (em MiB) para o aviso
 */
const fs = require("fs");
const path = require("path");

const DIST = path.resolve(process.cwd(), "dist");
const SW_PATH = path.join(DIST, "sw.js");

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT_MB = limitArg ? parseFloat(limitArg.split("=")[1]) : 2;
const LIMIT_BYTES = LIMIT_MB * 1024 * 1024;

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(DIST)) fail(`pasta dist/ não encontrada — rode \`bun run build\` antes.`);
if (!fs.existsSync(SW_PATH)) fail(`sw.js não encontrado em ${SW_PATH}.`);

const sw = fs.readFileSync(SW_PATH, "utf8");

// O Workbox escreve algo como: precacheAndRoute([{ "revision": "...", "url": "..."}, ...])
const match = sw.match(/precacheAndRoute\(\s*(\[[\s\S]*?\])\s*[,)]/);
if (!match) fail("não foi possível localizar precacheAndRoute([...]) em sw.js.");

let entries;
try {
  // Substitui chaves não-quoted por JSON válido (Workbox já gera JSON-like).
  entries = JSON.parse(match[1]);
} catch (e) {
  fail(`falha ao parsear manifesto: ${e.message}`);
}

const rows = entries
  .map((e) => {
    const url = String(e.url || "").replace(/^\//, "");
    const file = path.join(DIST, url);
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    return { url: e.url, size };
  })
  .sort((a, b) => b.size - a.size);

const fmt = (n) => {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MiB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KiB";
  return n + " B";
};

const total = rows.reduce((s, r) => s + r.size, 0);
const overLimit = rows.filter((r) => r.size > LIMIT_BYTES);
const nearLimit = rows.filter((r) => r.size <= LIMIT_BYTES && r.size > LIMIT_BYTES * 0.75);

console.log(`\n📦 Workbox precache audit  —  limite: ${LIMIT_MB} MiB`);
console.log(`   ${rows.length} arquivos  ·  total ${fmt(total)}\n`);

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
  console.log(
    `\n   → Mova para runtime caching (StaleWhileRevalidate) ou exclua via globIgnores no vite.config.ts.`
  );
}

if (nearLimit.length) {
  console.log(`\n🟡 ${nearLimit.length} arquivo(s) perto do limite (>75%):`);
  nearLimit.forEach((r) => console.log(`   • ${fmt(r.size).padStart(10)}   ${r.url}`));
}

if (!overLimit.length) console.log("\n✅ Nenhum asset acima do limite. Precache saudável.\n");

process.exit(overLimit.length > 0 ? 2 : 0);
