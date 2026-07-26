import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function readPrerenderedHtml() {
  return readFile(
    new URL("../dist/client/index.html", import.meta.url),
    "utf8",
  );
}

test("prerenders the finished AERIS simulator shell", async () => {
  const html = await readPrerenderedHtml();

  assert.match(
    html,
    /<title>AERIS (?:—|&mdash;) Flock Dynamics Laboratory<\/title>/i,
  );
  assert.match(html, /AERIS/);
  assert.match(html, /Flock dynamics laboratory/i);
  assert.match(html, /Flight programs/i);
  assert.match(html, /Murmuration/i);
  assert.match(html, /Simulation controls/i);
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(
    html,
    /Your site is taking shape|Codex is working|react-loading-skeleton/i,
  );
});

test("removes all starter preview wiring from the application entrypoints", async () => {
  const [page, layout, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<SimulatorApp \/>/);
  assert.match(layout, /AERIS — Flock Dynamics Laboratory/);
  assert.match(layout, /applicationName:\s*"AERIS"/);
  assert.match(layout, /metadataBase:\s*new URL\(SITE_ORIGIN\)/);
  assert.match(layout, /url:\s*"\/og\.png"/);
  assert.match(layout, /icon:\s*"\/favicon\.png"/);
  assert.match(layout, /themeColor:\s*"#050608"/);
  assert.match(css, /\.simulator-shell/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);

  for (const source of [page, layout]) {
    assert.doesNotMatch(
      source,
      /codex-preview|_sites-preview|SkeletonPreview|Starter Project/,
    );
  }
});
