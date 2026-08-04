import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAudioFormat, guardAudio, estimateOggOpusDurationSeconds } from "./audio-guard";
import { LIMITS } from "../config";

function bytes(...b: number[]): Uint8Array {
  return Uint8Array.from(b);
}

// Минимальная OGG-страница (27 байт заголовка, 0 сегментов) с заданным granule.
function oggWithGranule(granule: number): Uint8Array {
  const page = new Uint8Array(27);
  page.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
  let g = granule;
  for (let i = 0; i < 8; i++) {
    page[6 + i] = g & 0xff;
    g = Math.floor(g / 256);
  }
  // page[26] = nsegs = 0 (уже 0)
  return page;
}

test("detectAudioFormat: распознаёт форматы по magic-bytes", () => {
  assert.equal(detectAudioFormat(bytes(0x4f, 0x67, 0x67, 0x53, 0, 0)), "ogg");
  assert.equal(detectAudioFormat(bytes(0x49, 0x44, 0x33, 4, 0)), "mp3");
  assert.equal(detectAudioFormat(bytes(0x23, 0x21, 0x41, 0x4d, 0x52, 0x0a)), "amr");
  assert.equal(
    detectAudioFormat(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)),
    "wav",
  );
  assert.equal(detectAudioFormat(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70)), "mp4");
});

test("detectAudioFormat: текст/мусор — не аудио", () => {
  assert.equal(detectAudioFormat(bytes(0x68, 0x65, 0x6c, 0x6c, 0x6f)), null); // "hello"
  assert.equal(detectAudioFormat(bytes()), null);
});

test("guardAudio: валидный ogg-опус проходит", () => {
  const r = guardAudio({ bytes: bytes(0x4f, 0x67, 0x67, 0x53, 1, 2, 3), mimeType: "audio/ogg; codecs=opus", durationSeconds: 12 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.format, "ogg");
});

test("guardAudio: пустой / слишком большой / слишком длинный — отказ", () => {
  assert.deepEqual(guardAudio({ bytes: bytes() }), { ok: false, reason: "empty" });

  const big = new Uint8Array(LIMITS.maxVoiceBytes + 1);
  big[0] = 0x4f; big[1] = 0x67; big[2] = 0x67; big[3] = 0x53;
  assert.equal(guardAudio({ bytes: big }).ok, false);

  const long = guardAudio({ bytes: bytes(0x4f, 0x67, 0x67, 0x53), durationSeconds: LIMITS.maxVoiceSeconds + 1 });
  assert.equal(long.ok, false);
  if (!long.ok) assert.equal(long.reason, "too_long");
});

test("guardAudio: не-аудио отклоняется даже при валидном MIME", () => {
  const r = guardAudio({ bytes: bytes(0x68, 0x65, 0x6c, 0x6c, 0x6f), mimeType: "audio/ogg" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "not_audio");
});

test("guardAudio: неразрешённый MIME отклоняется", () => {
  const r = guardAudio({ bytes: bytes(0x4f, 0x67, 0x67, 0x53), mimeType: "application/pdf" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "mime_not_allowed");
});

test("estimateOggOpusDurationSeconds: granule → секунды", () => {
  assert.equal(estimateOggOpusDurationSeconds(oggWithGranule(48000 * 30)), 30);
  assert.equal(estimateOggOpusDurationSeconds(bytes(1, 2, 3)), null); // не ogg
});

test("guardAudio: длинный ogg (>60с по granule) отклоняется", () => {
  const r = guardAudio({ bytes: oggWithGranule(48000 * 70), mimeType: "audio/ogg" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "too_long");
});

test("guardAudio: короткий ogg (по granule) проходит", () => {
  const r = guardAudio({ bytes: oggWithGranule(48000 * 10), mimeType: "audio/ogg" });
  assert.equal(r.ok, true);
});
