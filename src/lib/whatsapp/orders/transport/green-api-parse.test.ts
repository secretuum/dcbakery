import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeGreenWebhook, isTrustedGreenHost } from "./green-api-parse";

const CFG = { managerChatId: "120363000@g.us" };

test("текстовое сообщение", () => {
  const r = normalizeGreenWebhook(
    {
      typeWebhook: "incomingMessageReceived",
      idMessage: "ABC123",
      senderData: { chatId: "77051234567@c.us", senderName: "Иван" },
      messageData: { typeMessage: "textMessage", textMessageData: { textMessage: "3 медовика" } },
    },
    CFG,
  );
  assert.ok(r);
  assert.equal(r!.kind, "text");
  assert.equal(r!.text, "3 медовика");
  assert.equal(r!.phone, "77051234567");
  assert.equal(r!.messageId, "ABC123");
  assert.equal(r!.profileName, "Иван");
  assert.equal(r!.isManagerChat, false);
});

test("расширенный текст (extendedTextMessage)", () => {
  const r = normalizeGreenWebhook({
    typeWebhook: "incomingMessageReceived",
    idMessage: "X",
    senderData: { chatId: "77000000000@c.us" },
    messageData: { typeMessage: "extendedTextMessage", extendedTextMessageData: { text: "привет" } },
  });
  assert.equal(r?.kind, "text");
  assert.equal(r?.text, "привет");
});

test("голосовое (audioMessage) с downloadUrl", () => {
  const r = normalizeGreenWebhook({
    typeWebhook: "incomingMessageReceived",
    idMessage: "V1",
    senderData: { chatId: "77051234567@c.us" },
    messageData: {
      typeMessage: "audioMessage",
      fileMessageData: { downloadUrl: "https://media.green-api.com/x.ogg", mimeType: "audio/ogg" },
    },
  });
  assert.equal(r?.kind, "voice");
  assert.equal(r?.voice?.downloadUrl, "https://media.green-api.com/x.ogg");
  assert.equal(r?.voice?.mimeType, "audio/ogg");
});

test("изображение (imageMessage) → image + media с подписью", () => {
  const r = normalizeGreenWebhook({
    typeWebhook: "incomingMessageReceived",
    idMessage: "I1",
    senderData: { chatId: "77051234567@c.us" },
    messageData: {
      typeMessage: "imageMessage",
      fileMessageData: { downloadUrl: "https://7105.media.greenapi.com/y.jpg", mimeType: "image/jpeg", caption: "вот заказ" },
    },
  });
  assert.equal(r?.kind, "image");
  assert.equal(r?.media?.downloadUrl, "https://7105.media.greenapi.com/y.jpg");
  assert.equal(r?.media?.mimeType, "image/jpeg");
  assert.equal(r?.media?.caption, "вот заказ");
});

test("документ (documentMessage) → document + имя файла", () => {
  const r = normalizeGreenWebhook({
    typeWebhook: "incomingMessageReceived",
    idMessage: "D1",
    senderData: { chatId: "77051234567@c.us" },
    messageData: {
      typeMessage: "documentMessage",
      fileMessageData: { downloadUrl: "https://7105.media.greenapi.com/z.xlsx", fileName: "заказ.xlsx" },
    },
  });
  assert.equal(r?.kind, "document");
  assert.equal(r?.media?.fileName, "заказ.xlsx");
});

test("видео/стикер → unsupported", () => {
  const r = normalizeGreenWebhook({
    typeWebhook: "incomingMessageReceived",
    idMessage: "VID1",
    senderData: { chatId: "77051234567@c.us" },
    messageData: { typeMessage: "videoMessage", fileMessageData: { downloadUrl: "https://x/y.mp4" } },
  });
  assert.equal(r?.kind, "unsupported");
});

test("менеджерский групповой чат помечается", () => {
  const r = normalizeGreenWebhook({
    typeWebhook: "incomingMessageReceived",
    idMessage: "G1",
    senderData: { chatId: "120363000@g.us" },
    messageData: { typeMessage: "textMessage", textMessageData: { textMessage: "статус" } },
  }, CFG);
  assert.equal(r?.isManagerChat, true);
});

test("не-сообщения и мусор → null", () => {
  assert.equal(normalizeGreenWebhook({ typeWebhook: "outgoingMessageStatus" }), null);
  assert.equal(normalizeGreenWebhook({ typeWebhook: "incomingMessageReceived", idMessage: "x" }), null); // нет chatId
  assert.equal(normalizeGreenWebhook(null), null);
});

test("isTrustedGreenHost: green-api.com и greenapi.com", () => {
  assert.equal(isTrustedGreenHost("https://media.green-api.com/a.ogg"), true);
  assert.equal(isTrustedGreenHost("https://api.green-api.com/x"), true);
  assert.equal(isTrustedGreenHost("https://7105.media.greenapi.com/a.ogg"), true);
  assert.equal(isTrustedGreenHost("https://7105.api.greenapi.com/x"), true);
  assert.equal(isTrustedGreenHost("https://evil.com/a.ogg"), false);
  assert.equal(isTrustedGreenHost("https://green-api.com.evil.com/a"), false);
  assert.equal(isTrustedGreenHost("https://greenapi.com.evil.com/a"), false);
  assert.equal(isTrustedGreenHost("not a url"), false);
});
