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
  assert.match(html, /sweet-crepe/);
  assert.match(html, /pinmusepad/);
  assert.match(html, /pinbrushbalovstvo/);
  assert.match(html, /dither-excalibrator/);
  assert.match(html, /ascii-vision/);
  assert.match(html, /kripibykva/);
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
  assert.match(css, /"Bree Serif"/);
  assert.match(page, /auto-rotate/);
  assert.match(page, /camera-controls/);
  assert.match(layout, /@google\/model-viewer/);
  assert.doesNotMatch(page, /SkeletonPreview/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
});
