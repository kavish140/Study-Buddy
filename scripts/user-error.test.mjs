import test from "node:test";
import assert from "node:assert/strict";
import { userErrorMessage } from "../src/lib/user-error.ts";
import { backendFetch } from "../src/lib/backend-request.ts";

test("shared errors explain expired sessions, limits, network failures and empty errors", () => {
  assert.match(userErrorMessage({ status: 401 }), /sign in again/);
  assert.match(userErrorMessage({ status: 429 }), /wait/);
  assert.match(userErrorMessage(new TypeError("Failed to fetch")), /connect/);
  assert.equal(userErrorMessage(null, "Could not save."), "Could not save.");
  assert.equal(userErrorMessage(new Error("Choose fewer questions.")), "Choose fewer questions.");
});

test("transport failures are actionable and explicit cancellation is preserved", async (t) => {
  const networkError = new TypeError("Failed to fetch");
  t.mock.method(globalThis, "fetch", async () => {
    throw networkError;
  });
  await assert.rejects(backendFetch("https://test.invalid/rest/v1/test"), /connect to the service/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    backendFetch("https://test.invalid/rest/v1/test", { signal: controller.signal }),
    (error) => error === networkError,
  );
});
