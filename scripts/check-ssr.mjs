import assert from "node:assert/strict";

// Run against `npm run preview -- --host 127.0.0.1 --port 4182`.
// Fetch does not execute JavaScript: these checks prove the HTML is server-rendered.
const origin = new URL(process.argv[2] || "http://127.0.0.1:4182").origin;
let clientAsset;
for (const [path, expected] of [
  ["/landing", "Big exam goals."],
  ["/login", "Continue with Google"],
  ["/privacy", "Information we process"],
  ["/terms", "Using Study Buddy"],
  ["/sources", "Sources &amp; Licenses"],
]) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP status`);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  const rendered = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  assert.ok(rendered.includes(expected), `${path}: content exists before JavaScript`);
  assert.match(rendered, /<title>[^<]*Study Buddy/);
  assert.match(rendered, /<html[^>]*lang="en"/);
  assert.doesNotMatch(rendered, /This page didn&#x27;t load|AcePrep/);
  assert.ok(!html.includes('src="/src/main.tsx"'), "No obsolete SPA entry");
  clientAsset ??= html.match(/(?:src|href)="(\/assets\/[^" ]+\.js)"/)?.[1];
  console.log(`PASS SSR ${path}`);
}

const missing = await fetch(`${origin}/ssr-check-missing-page`);
assert.equal(missing.status, 404);
assert.match(await missing.text(), /Page not found/);
console.log("PASS HTTP 404");

const sitemap = await fetch(`${origin}/sitemap.xml`);
assert.equal(sitemap.status, 200);
assert.match(sitemap.headers.get("content-type"), /application\/xml/);
const xml = await sitemap.text();
assert.ok(xml.includes(`<loc>${origin}/landing</loc>`));
assert.ok(!xml.includes("aceprep.app"));
assert.ok(!xml.includes("/quiz</loc>"));
console.log("PASS XML sitemap");

assert.ok(clientAsset, "SSR includes a hydration script or module preload");
const asset = await fetch(`${origin}${clientAsset}`);
assert.equal(asset.status, 200);
assert.match(asset.headers.get("content-type"), /javascript/);
const robots = await fetch(`${origin}/robots.txt`);
assert.equal(robots.status, 200);
assert.match(await robots.text(), /User-agent: \*/);
console.log("PASS hydration asset and robots.txt");
