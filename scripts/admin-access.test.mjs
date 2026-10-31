import test from "node:test";
import assert from "node:assert/strict";
import { hasAdminEmail, csvExport } from "../src/lib/admin-access.ts";

test("admin navigation matches only the exact administrator email", () => {
  assert.equal(hasAdminEmail("kavishganatra5@gmail.com"), true);
  assert.equal(hasAdminEmail("KAVISHGANATRA5@gmail.com"), true);
  for (const email of [
    null,
    undefined,
    "",
    "other@gmail.com",
    "kavishganatra5@gmail.com.evil.test",
    " kavishganatra5@gmail.com",
  ]) {
    assert.equal(hasAdminEmail(email), false);
  }
});

test("CSV quotes content and neutralizes spreadsheet formulas in user fields", () => {
  const result = csvExport([
    { email: '=HYPERLINK("evil")', content: 'hello,"world"\nnext' },
    { email: "  +SUM(1,2)", extra: { count: 3 } },
  ]);
  assert.ok(result.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(result.includes('"\'  +SUM(1,2)"'));
  assert.ok(result.includes('"hello,""world""\nnext"'));
  assert.ok(result.includes('"{""count"":3}"'));
});
