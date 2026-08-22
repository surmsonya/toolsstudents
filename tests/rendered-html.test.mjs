import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
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
  assert.match(html, /<title>ПИН тулз<\/title>/i);
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
  const [css, page, layout, data] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/catalog-data.ts", import.meta.url), "utf8"),
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
  assert.match(data, /https:\/\/t\.me\/neurokva/);
  assert.match(data, /https:\/\/t\.me\/design_patch/);
  assert.match(data, /https:\/\/t\.me\/Lexusghf/);
  assert.match(data, /https:\/\/t\.me\/bysevostick01/);
  assert.match(data, /https:\/\/t\.me\/sargsyanstd/);
  assert.match(data, /\\u00A0/);
  assert.match(data, /assetPath\("\/sweet-crepe\.webp"\)/);
  assert.match(data, /assetPath\("\/scanner-studio\.webp"\)/);
  assert.match(data, /assetPath\("\/dither-excalibrator\.webp"\)/);
  assert.match(data, /assetPath\("\/ascii-vision\.webp"\)/);
  assert.match(data, /assetPath\("\/pinbrushbalovstvo\.webp"\)/);
  assert.match(data, /assetPath\("\/kripibykva\.webp"\)/);
  assert.match(page, /<iframe/);
  assert.match(page, /MOBILE_PREVIEW_QUERY/);
  assert.match(page, /mobile-sheet-layer/);
  assert.match(page, /открыть тул/);
  assert.match(page, /auto-rotate/);
  assert.match(page, /camera-controls/);
  assert.match(page, /assetPath\("\/model\.glb"\)/);
  assert.match(page, /assetPath\("\/model-poster\.webp"\)/);
  assert.match(page, /@google\/model-viewer/);
  assert.doesNotMatch(layout, /@google\/model-viewer/);
  assert.doesNotMatch(page, /SkeletonPreview/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
});

test("server-renders the /sonya page", async () => {
  const response = await render("/sonya");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>sonya<\/title>/i);
  assert.match(html, /class="sonya"/);
  assert.match(html, /class="sonya-canvas"/);
  assert.match(html, /class="sonya-links"/);
  assert.doesNotMatch(html, /<model-viewer/i);
  assert.doesNotMatch(html, /@google\/model-viewer/);
});

test("keeps the sonya page on one shared source of truth", async () => {
  const [css, page, shaders, scene] = await Promise.all([
    readFile(new URL("../app/sonya/sonya.css", import.meta.url), "utf8"),
    readFile(new URL("../app/sonya/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sonya/shaders.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sonya/scene.ts", import.meta.url), "utf8"),
  ]);

  assert.match(css, /mix-blend-mode:\s*difference/);
  assert.match(css, /isolation:\s*isolate/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /"Helvetica Neue", Helvetica/);
  assert.match(page, /sonyaLinks/);
  assert.match(page, /assetPath\("\/model\.glb"\)/);
  assert.match(scene, /DRACO_GLTF_CONFIG/);
  assert.match(shaders, /PALETTE/);
  assert.match(shaders, /bayer8/);
  // фон и модель делят палитру, дизеринг и число тонов
  assert.match(shaders, /BACKGROUND_TONES/);
  assert.match(shaders, /FIELD_SHAPE/);
  assert.match(scene, /WebGLRenderTarget/);
  // палитра живёт в одном месте и не дублируется в CSS
  assert.doesNotMatch(css, /#0d0b09/i);
});
