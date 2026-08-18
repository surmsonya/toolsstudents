import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the one-screen PIN catalog", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>PIN Tools — 3D catalog<\/title>/i);
  assert.match(html, /<model-viewer[^>]*src="\/model\.glb"/i);
  assert.match(html, /<model-viewer[^>]*poster="\/model-poster\.webp"/i);
  assert.match(html, /sweet-crepe/);
  assert.match(html, /pinmusepad/);
  assert.match(html, /SCANNER-STUDIO/);
  assert.match(html, /pinbrushbalovstvo/);
  assert.match(html, /dither-excalibrator/);
  assert.match(html, /ascii-vision/);
  assert.match(html, /kripibykva/);
  assert.match(html, /href="https:\/\/t\.me\/neurokva"/);
  assert.ok(html.includes("тгк\u00A0@neurokva"));
});

test("keeps the catalog viewport-bound and model-ready", async () => {
  const [css, page, layout] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /"Helvetica Neue", Helvetica/);
  assert.match(css, /text-transform:\s*uppercase/);
  assert.match(css, /color:\s*#d2d2d2/);
  assert.match(css, /\.catalog-preview/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.mobile-sheet/);
  assert.match(page, /https:\/\/t\.me\/neurokva/);
  assert.match(page, /https:\/\/t\.me\/design_patch/);
  assert.match(page, /https:\/\/t\.me\/Lexusghf/);
  assert.match(page, /https:\/\/t\.me\/bysevostick01/);
  assert.match(page, /https:\/\/t\.me\/sargsyanstd/);
  assert.match(page, /\\u00A0/);
  assert.match(page, /assetPath\("\/sweet-crepe\.webp"\)/);
  assert.match(page, /assetPath\("\/scanner-studio\.webp"\)/);
  assert.match(page, /assetPath\("\/dither-excalibrator\.webp"\)/);
  assert.match(page, /assetPath\("\/ascii-vision\.webp"\)/);
  assert.match(page, /assetPath\("\/pinbrushbalovstvo\.webp"\)/);
  assert.match(page, /assetPath\("\/kripibykva\.webp"\)/);
  assert.match(page, /<iframe/);
  assert.match(page, /MOBILE_PREVIEW_QUERY/);
  assert.match(page, /mobile-sheet-layer/);
  assert.match(page, /открыть тул/);
  assert.match(page, /auto-rotate/);
  assert.match(page, /camera-controls/);
  assert.match(page, /assetPath\("\/model\.glb"\)/);
  assert.match(page, /assetPath\("\/model-poster\.webp"\)/);
  assert.match(layout, /@google\/model-viewer/);
  assert.doesNotMatch(page, /SkeletonPreview/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
});
