#!/usr/bin/env tsx
/**
 * Builds reports/index.html — the single page a supervisor opens to see
 * the entire QA picture.
 *
 * Sources (any subset can be missing; the dashboard renders gracefully):
 *   reports/python.json            — pytest --json
 *   reports/python-cov.json        — coverage summary
 *   reports/ts-api.json            — vitest --reporter=json
 *   reports/frontend.json          — vitest --reporter=json (frontend)
 *   reports/e2e-domains.json       — per-domain pipeline stages
 *   reports/e2e-unseen.json        — unseen-domain pass/fail
 *   reports/error-surfacing.json   — Python error-surfacing audit
 *   reports/error-surfacing-ts.json— TS error-surfacing audit
 *   reports/playwright.json        — Playwright run summary
 *   reports/history.jsonl          — one line per CI run (for sparklines)
 *
 * Pass-rate against the acceptance bars from the report:
 *   unit + integration: 100%
 *   E2E built-in:       100%
 *   E2E unseen:         ≥90%
 *   open P0 bugs:       0  (queried from `gh issue list --label P0,bug`)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPORTS = path.resolve(import.meta.dirname ?? __dirname, "..", "reports");

type Json = Record<string, unknown>;

function readJson(file: string): Json | null {
  const full = path.join(REPORTS, file);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, "utf-8")) as Json;
  } catch (e) {
    console.warn(`[dashboard] skip ${file}: ${(e as Error).message}`);
    return null;
  }
}

function readVitestJson(file: string): { passed: number; failed: number; total: number } | null {
  const j = readJson(file);
  if (!j) return null;
  // vitest --reporter=json produces { numTotalTests, numPassedTests, numFailedTests, ... }
  const total = Number(j.numTotalTests ?? 0);
  const passed = Number(j.numPassedTests ?? 0);
  const failed = Number(j.numFailedTests ?? 0);
  if (total === 0) return null;
  return { passed, failed, total };
}

function readE2eDomains(): { domain: string; overall: boolean; stages: Record<string, { ok: boolean; detail: string }> }[] {
  const j = readJson("e2e-domains.json");
  if (!j) return [];
  return Object.entries(j).map(([domain, body]) => ({
    domain,
    overall: Boolean((body as Json).overall),
    stages: ((body as Json).stages ?? {}) as Record<string, { ok: boolean; detail: string }>,
  }));
}

function readE2eUnseen(): { domain: string; ok: boolean; detail: string }[] {
  const j = readJson("e2e-unseen.json");
  if (!j) return [];
  return Object.entries(j).map(([domain, body]) => ({
    domain,
    ok: Boolean((body as Json).ok),
    detail: String((body as Json).detail ?? ""),
  }));
}

function readErrorSurfacing(): { case: string; surfaced: boolean; message: string }[] {
  const out: { case: string; surfaced: boolean; message: string }[] = [];
  for (const file of ["error-surfacing.json", "error-surfacing-ts.json"]) {
    const j = readJson(file);
    if (!j) continue;
    for (const [caseName, body] of Object.entries(j)) {
      out.push({
        case: caseName,
        surfaced: Boolean((body as Json).surfaced),
        message: String((body as Json).user_visible_message ?? ""),
      });
    }
  }
  return out.sort((a, b) => a.case.localeCompare(b.case));
}

function bugsFromGh(): { title: string; url: string; labels: string[] }[] {
  try {
    const out = execSync(
      `gh issue list --state open --label bug --json title,url,labels --limit 200`,
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const items = JSON.parse(out) as { title: string; url: string; labels: { name: string }[] }[];
    return items.map((i) => ({
      title: i.title,
      url: i.url,
      labels: i.labels.map((l) => l.name),
    }));
  } catch {
    return [];
  }
}

function readHistory(): { ts: string; unseenPassRate: number | null; builtinPassRate: number | null }[] {
  const file = path.join(REPORTS, "history.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as { ts: string; unseenPassRate: number | null; builtinPassRate: number | null };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { ts: string; unseenPassRate: number | null; builtinPassRate: number | null }[];
}

function passRate(passed: number, total: number): number {
  return total === 0 ? 1 : passed / total;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function statusChip(passed: boolean, label: string): string {
  const color = passed ? "#16a34a" : "#dc2626";
  return `<span class="chip" style="background:${color}1a;color:${color};border:1px solid ${color}55">${label}</span>`;
}

function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const w = 120, h = 28, pad = 2;
  const max = 1, min = 0;
  const step = values.length === 1 ? 0 : (w - 2 * pad) / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / (max - min)) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="#0ea5e9" stroke-width="1.5" points="${pts}" /></svg>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(): string {
  const python = readVitestJson("python.json"); // pytest-html doesn't emit this — backstop
  const tsApi = readVitestJson("ts-api.json");
  const frontend = readVitestJson("frontend.json");
  const domains = readE2eDomains();
  const unseen = readE2eUnseen();
  const errors = readErrorSurfacing();
  const bugs = bugsFromGh();
  const history = readHistory();

  // Unit + integration: combine all three (Python pytest tracked separately).
  const unitInt = {
    passed: (tsApi?.passed ?? 0) + (frontend?.passed ?? 0),
    failed: (tsApi?.failed ?? 0) + (frontend?.failed ?? 0),
    total: (tsApi?.total ?? 0) + (frontend?.total ?? 0),
  };
  const unitIntRate = passRate(unitInt.passed, unitInt.total);

  const builtinPassed = domains.filter((d) => d.overall).length;
  const builtinTotal = domains.length;
  const builtinRate = passRate(builtinPassed, builtinTotal);

  const unseenPassed = unseen.filter((u) => u.ok).length;
  const unseenTotal = unseen.length;
  const unseenRate = passRate(unseenPassed, unseenTotal);

  const p0Bugs = bugs.filter((b) => b.labels.includes("P0")).length;

  const cards = [
    {
      bar: "Unit + Integration",
      target: "100%",
      actual: unitIntRate,
      pass: unitInt.failed === 0 && unitInt.total > 0,
      detail: `${unitInt.passed} / ${unitInt.total} passing`,
    },
    {
      bar: "E2E built-in domains",
      target: "100%",
      actual: builtinRate,
      pass: builtinPassed === builtinTotal && builtinTotal > 0,
      detail: `${builtinPassed} / ${builtinTotal} domains green`,
    },
    {
      bar: "E2E unseen domains",
      target: "≥90%",
      actual: unseenRate,
      pass: unseenRate >= 0.9 && unseenTotal > 0,
      detail: `${unseenPassed} / ${unseenTotal} domains green`,
    },
    {
      bar: "Open P0 bugs",
      target: "0",
      actual: p0Bugs === 0 ? 1 : 0,
      pass: p0Bugs === 0,
      detail: `${p0Bugs} open P0`,
    },
  ];

  const headlineHtml = cards
    .map(
      (c) => `
        <div class="card ${c.pass ? "ok" : "bad"}">
          <div class="bar-name">${c.bar}</div>
          <div class="value">${typeof c.actual === "number" && c.bar !== "Open P0 bugs" ? pct(c.actual) : c.detail.split(" ")[0]}</div>
          <div class="target">target ${c.target}</div>
          <div class="detail">${c.detail}</div>
        </div>`
    )
    .join("");

  const domainStages = ["plan", "states", "render", "pipeline"];
  const domainRows = domains
    .map((d) => {
      const cells = domainStages
        .map((s) => {
          const st = d.stages[s];
          if (!st) return `<td class="cell unknown">–</td>`;
          return `<td class="cell ${st.ok ? "ok" : "bad"}" title="${escapeHtml(st.detail)}">${st.ok ? "✓" : "✗"}</td>`;
        })
        .join("");
      return `<tr><td class="domain">${d.domain}</td>${cells}<td>${statusChip(d.overall, d.overall ? "PASS" : "FAIL")}</td></tr>`;
    })
    .join("");
  const unseenRows = unseen
    .map(
      (u) => `<tr><td class="domain">${u.domain}</td><td>${statusChip(u.ok, u.ok ? "PASS" : "FAIL")}</td><td class="detail">${escapeHtml(u.detail)}</td></tr>`
    )
    .join("");

  const errorRows = errors
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.case)}</td><td>${statusChip(e.surfaced, e.surfaced ? "SURFACED" : "SILENT")}</td><td class="msg">${escapeHtml(e.message)}</td></tr>`
    )
    .join("");

  const bugRows = bugs
    .map(
      (b) =>
        `<tr><td>${b.labels.find((l) => /^P[0-3]$/.test(l)) ?? "–"}</td><td><a href="${b.url}">${escapeHtml(b.title)}</a></td></tr>`
    )
    .join("");

  const builtinSpark = sparkline(history.map((h) => h.builtinPassRate ?? 0));
  const unseenSpark = sparkline(history.map((h) => h.unseenPassRate ?? 0));

  const generatedAt = new Date().toISOString();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Planning Visualizer — QA Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 32px;
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #0b1220; color: #e5e7eb;
}
h1 { margin: 0 0 4px 0; font-size: 22px; }
h2 { margin: 32px 0 12px 0; font-size: 16px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
.subtitle { color: #64748b; margin-bottom: 24px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.card { background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 16px; }
.card.ok { border-left: 4px solid #16a34a; }
.card.bad { border-left: 4px solid #dc2626; }
.bar-name { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.value { font-size: 30px; font-weight: 600; margin: 6px 0 0 0; }
.target { color: #64748b; font-size: 12px; }
.detail { margin-top: 8px; color: #cbd5e1; font-size: 12px; }
table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 10px; overflow: hidden; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #1f2937; font-size: 13px; }
th { background: #0f172a; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; font-size: 11px; }
td.domain { font-weight: 600; color: #f1f5f9; }
td.cell { text-align: center; font-weight: 600; }
td.cell.ok { color: #16a34a; }
td.cell.bad { color: #dc2626; }
td.cell.unknown { color: #475569; }
td.msg { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #cbd5e1; }
.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: 11px; letter-spacing: .04em; }
.spark-row { display: flex; align-items: center; gap: 12px; color: #cbd5e1; font-size: 12px; }
.footer { margin-top: 40px; color: #64748b; font-size: 11px; }
a { color: #38bdf8; text-decoration: none; }
a:hover { text-decoration: underline; }
.row-flex { display: flex; flex-wrap: wrap; gap: 24px; }
.row-flex > div { flex: 1 1 380px; }
</style>
</head>
<body>

<h1>Planning Visualizer — QA Dashboard</h1>
<div class="subtitle">
  Acceptance bars from the capstone report. Generated ${escapeHtml(generatedAt)}.
</div>

<div class="cards">${headlineHtml}</div>

<h2>Per-domain matrix — built-in</h2>
<table>
<thead><tr><th>Domain</th><th>Plan</th><th>States</th><th>Render</th><th>Pipeline</th><th>Overall</th></tr></thead>
<tbody>${domainRows || `<tr><td colspan="6" style="color:#64748b">No E2E run recorded yet.</td></tr>`}</tbody>
</table>

<h2>Unseen domains (nightly)</h2>
<table>
<thead><tr><th>Domain</th><th>Status</th><th>Detail</th></tr></thead>
<tbody>${unseenRows || `<tr><td colspan="3" style="color:#64748b">No unseen run recorded yet.</td></tr>`}</tbody>
</table>

<div class="row-flex" style="margin-top:32px">
  <div>
    <h2>Error-surfacing audit</h2>
    <table>
    <thead><tr><th>Boundary</th><th>Status</th><th>Message shown to user</th></tr></thead>
    <tbody>${errorRows || `<tr><td colspan="3" style="color:#64748b">No audit recorded yet.</td></tr>`}</tbody>
    </table>
  </div>
  <div>
    <h2>Bug board (open)</h2>
    <table>
    <thead><tr><th>Sev</th><th>Title</th></tr></thead>
    <tbody>${bugRows || `<tr><td colspan="2" style="color:#64748b">No open bugs from \`gh issue list --label bug\`.</td></tr>`}</tbody>
    </table>
  </div>
</div>

<h2>Trend</h2>
<div class="spark-row">
  <span>Built-in pass-rate</span>${builtinSpark || "<span style='color:#64748b'>no history</span>"}
  <span style="margin-left:24px">Unseen pass-rate</span>${unseenSpark || "<span style='color:#64748b'>no history</span>"}
  <span style="margin-left:auto;color:#64748b">${history.length} run(s)</span>
</div>

<div class="footer">
  Sources: reports/{python,ts-api,frontend,e2e-domains,e2e-unseen,error-surfacing,error-surfacing-ts}.json + <code>gh issue list</code>.
  Re-run with <code>pnpm dashboard</code>. Linked reports:
  <a href="playwright/index.html">Playwright</a> ·
  <a href="ts-api-cov/index.html">TS coverage</a> ·
  <a href="frontend-cov/index.html">Frontend coverage</a> ·
  <a href="python.html">Python report</a> ·
  <a href="python-cov/index.html">Python coverage</a>.
</div>

</body>
</html>`;
}

function appendHistory(): void {
  const domains = readE2eDomains();
  const unseen = readE2eUnseen();
  const builtinPassed = domains.filter((d) => d.overall).length;
  const builtinTotal = domains.length;
  const unseenPassed = unseen.filter((u) => u.ok).length;
  const unseenTotal = unseen.length;

  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      builtinPassRate: builtinTotal === 0 ? null : builtinPassed / builtinTotal,
      unseenPassRate: unseenTotal === 0 ? null : unseenPassed / unseenTotal,
    }) + "\n";

  fs.mkdirSync(REPORTS, { recursive: true });
  fs.appendFileSync(path.join(REPORTS, "history.jsonl"), line);
}

function main() {
  fs.mkdirSync(REPORTS, { recursive: true });
  if (process.argv.includes("--append-history")) {
    appendHistory();
  }
  const html = buildHtml();
  const outPath = path.join(REPORTS, "index.html");
  fs.writeFileSync(outPath, html, "utf-8");
  console.log(`[dashboard] wrote ${outPath} (${html.length} bytes)`);
}

main();
