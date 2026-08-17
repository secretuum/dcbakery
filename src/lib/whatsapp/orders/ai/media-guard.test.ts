import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMediaKind, imageMime, guardMedia } from "./media-guard";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const TXT = Uint8Array.from([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"

test("detectMediaKind: по magic-bytes", () => {
  assert.equal(detectMediaKind(JPEG), "image");
  assert.equal(detectMediaKind(PNG), "image");
  assert.equal(detectMediaKind(PDF), "pdf");
  assert.equal(detectMediaKind(TXT), "unknown");
});

test("detectMediaKind: zip → xlsx только с подтверждением mime/имени", () => {
  assert.equal(detectMediaKind(ZIP), "unknown"); // просто zip — не читаем
  assert.equal(detectMediaKind(ZIP, null, "order.xlsx"), "xlsx");
  assert.equal(
    detectMediaKind(ZIP, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "xlsx",
  );
  assert.equal(detectMediaKind(ZIP, null, "doc.docx"), "unknown"); // docx — тоже zip, но не читаем
});

test("imageMime: точный mime по сигнатуре", () => {
  assert.equal(imageMime(JPEG), "image/jpeg");
  assert.equal(imageMime(PNG), "image/png");
  assert.equal(imageMime(PDF), null);
});

test("guardMedia: размер и формат", () => {
  assert.deepEqual(guardMedia({ bytes: JPEG, maxBytes: 1000 }), { ok: true, kind: "image" });
  assert.deepEqual(guardMedia({ bytes: PDF, maxBytes: 1000 }), { ok: true, kind: "pdf" });
  assert.equal(guardMedia({ bytes: new Uint8Array(0), maxBytes: 1000 }).ok, false); // пусто
  assert.equal(guardMedia({ bytes: JPEG, maxBytes: 2 }).ok, false); // слишком большой
  assert.equal(guardMedia({ bytes: TXT, maxBytes: 1000 }).ok, false); // неизвестный формат
});
