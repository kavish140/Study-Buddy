import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { observeSession } from "../src/lib/auth-session.ts";
import { backendFetch } from "../src/lib/backend-request.ts";

function fixture(getSession) {
  let callback;
  let unsubscribed = false;
  const states = [];
  const auth = {
    getSession,
    onAuthStateChange(listener) {
      callback = listener;
      return {
        data: {
          subscription: {
            unsubscribe() {
              unsubscribed = true;
            },
          },
        },
      };
    },
  };
  const stop = observeSession(auth, {
    onSession: (session) => states.push(session),
    onError: () => states.push("error"),
    timeoutMs: 15,
  });
  return {
    states,
    stop,
    emit: (session) => callback("SIGNED_IN", session),
    isUnsubscribed: () => unsubscribed,
  };
}

test("a hung refresh exits loading and a later auth event recovers", async () => {
  const f = fixture(() => new Promise(() => {}));
  await delay(35);
  assert.deepEqual(f.states, ["error"]);
  f.emit({ user: { id: "recovered" } });
  assert.equal(f.states.at(-1).user.id, "recovered");
  f.stop();
});

test("rejected and returned SDK errors are handled", async () => {
  for (const result of [
    () => Promise.reject(new Error("offline")),
    () => Promise.resolve({ data: { session: null }, error: new Error("offline") }),
  ]) {
    const f = fixture(result);
    await delay(0);
    assert.deepEqual(f.states, ["error"]);
    f.stop();
  }
});

test("a fresh auth event wins over stale initial session recovery", async () => {
  let resolve;
  const f = fixture(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  f.emit({ user: { id: "new" } });
  resolve({ data: { session: { user: { id: "old" } } }, error: null });
  await delay(0);
  assert.deepEqual(
    f.states.map((s) => s.user.id),
    ["new"],
  );
  f.stop();
});

test("cleanup ignores pending recovery and unsubscribes (including StrictMode remount)", async () => {
  let resolve;
  const f = fixture(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  f.stop();
  resolve({ data: { session: null }, error: null });
  f.emit(null);
  await delay(25);
  assert.deepEqual(f.states, []);
  assert.equal(f.isUnsubscribed(), true);
  const remount = fixture(() => Promise.resolve({ data: { session: null }, error: null }));
  await delay(0);
  assert.deepEqual(remount.states, [null]);
  remount.stop();
});

test("backend requests preserve cancellation and bound stalled fetches", async (t) => {
  const timeoutValues = [];
  t.mock.method(AbortSignal, "timeout", (ms) => {
    timeoutValues.push(ms);
    return new AbortController().signal;
  });
  t.mock.method(globalThis, "fetch", async (_input, init) => init.signal);
  const controller = new AbortController();
  const signal = await backendFetch("https://example.test/rest/v1/profiles", {
    signal: controller.signal,
  });
  controller.abort();
  assert.equal(signal.aborted, true);
  await backendFetch("https://example.test/functions/v1/study-ai");
  assert.deepEqual(timeoutValues, [10_000, 120_000]);
});
