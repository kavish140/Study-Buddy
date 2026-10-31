import test from "node:test";
import assert from "node:assert/strict";
import {
  pastedAttachment,
  readClipboardImage,
  validateChatAttachment,
  MAX_PDF_BYTES,
  MAX_IMAGE_BYTES,
} from "../src/lib/chat-attachments.ts";

test("paste reads screenshot items even when the clipboard file list is empty", () => {
  const screenshot = new File(["png"], "image.png", { type: "image/png" });
  const data = {
    files: [],
    items: [
      { kind: "string", type: "text/html", getAsFile: () => null },
      { kind: "file", type: "image/png", getAsFile: () => screenshot },
    ],
  };
  assert.equal(pastedAttachment(data), screenshot);
  assert.equal(pastedAttachment({ files: [screenshot], items: [] }), screenshot);
});

test("paste preserves ordinary text and ignores unavailable file entries", () => {
  assert.equal(
    pastedAttachment({ files: [], items: [{ kind: "string", type: "text/plain" }] }),
    null,
  );
  assert.equal(
    pastedAttachment({
      files: [],
      items: [{ kind: "file", type: "image/png", getAsFile: () => null }],
    }),
    null,
  );
  const pdf = new File(["pdf"], "paper.pdf", { type: "application/pdf" });
  assert.equal(pastedAttachment({ files: [pdf], items: [] }), pdf);
});

test("clipboard item MIME type is preserved for browsers returning untyped files", () => {
  const file = pastedAttachment({
    files: [],
    items: [{ kind: "file", type: "image/png", getAsFile: () => new File(["png"], "image.png") }],
  });
  assert.equal(file.type, "image/png");
  validateChatAttachment(file);
});

function mockClipboard(t, clipboard) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard } });
  t.after(() =>
    original
      ? Object.defineProperty(globalThis, "navigator", original)
      : delete globalThis.navigator,
  );
}

test("explicit paste reads binary images, preferring PNG over alternative formats", async (t) => {
  const typesRead = [];
  mockClipboard(t, {
    read: async () => [
      { types: ["text/html"] },
      {
        types: ["image/jpeg", "image/png"],
        getType: async (type) => {
          typesRead.push(type);
          return new Blob(["png"], { type });
        },
      },
    ],
  });
  const file = await readClipboardImage();
  assert.equal(file.type, "image/png");
  assert.equal(file.name, "pasted-image.png");
  assert.deepEqual(typesRead, ["image/png"]);
});

test("clipboard permission denial provides shortcut/upload recovery", async (t) => {
  mockClipboard(t, {
    read: async () => {
      throw new Error("NotAllowedError");
    },
  });
  await assert.rejects(readClipboardImage(), /blocked.*Ctrl\+V.*saved image/);
});

test("missing clipboard API and non-image content have actionable errors", async (t) => {
  mockClipboard(t, undefined);
  await assert.rejects(readClipboardImage(), /unavailable/);
  navigator.clipboard = { read: async () => [{ types: ["text/plain"] }] };
  await assert.rejects(readClipboardImage(), /Copy the image itself/);
});

test("attachment validation enforces current PDF and image limits at the boundary", () => {
  validateChatAttachment({ type: "application/pdf", size: MAX_PDF_BYTES });
  assert.throws(
    () => validateChatAttachment({ type: "application/pdf", size: MAX_PDF_BYTES + 1 }),
    /7.5 MB/,
  );
  validateChatAttachment({ type: "image/png", size: MAX_IMAGE_BYTES });
  assert.throws(
    () => validateChatAttachment({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }),
    /10 MB/,
  );
  assert.throws(
    () => validateChatAttachment({ type: "text/plain", size: 1 }),
    /Only images and PDFs/,
  );
});
