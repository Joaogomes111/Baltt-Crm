import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  buildMetaCrmPayload,
  normalizePhone,
  sendMetaCrmEvent,
} from "../lib/meta-crm.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("builds the CRM payload required by Meta", () => {
  const payload = buildMetaCrmPayload({
    eventKey: "qualified",
    leadId: "1796507634715208",
    email: " Pessoa@Example.com ",
    phone: "(47) 99999-0000",
    eventTime: 1_700_000_000,
    testEventCode: "TEST123",
  });

  assert.equal(payload.test_event_code, "TEST123");
  assert.deepEqual(payload.data[0], {
    action_source: "system_generated",
    custom_data: {
      event_source: "crm",
      lead_event_source: "Baltt CRM",
    },
    event_id: "baltt-crm:1796507634715208:QualifiedLead",
    event_name: "QualifiedLead",
    event_time: 1_700_000_000,
    user_data: {
      lead_id: "1796507634715208",
      em: [hash("pessoa@example.com")],
      ph: [hash("5547999990000")],
    },
  });
});

test("normalizes Brazilian phone numbers and rejects an invalid Meta lead id", () => {
  assert.equal(normalizePhone("47999990000"), "5547999990000");
  assert.equal(normalizePhone("+55 47 99999-0000"), "5547999990000");

  assert.throws(
    () => buildMetaCrmPayload({ eventKey: "lead", leadId: "lead-local" }),
    /lead_id valido/i,
  );
});

test("retries a temporary Meta error without exposing the token in the payload", async () => {
  const calls = [];
  const responses = [
    { ok: false, status: 500, json: async () => ({ error: { message: "temporary" } }) },
    { ok: true, status: 200, json: async () => ({ events_received: 1, fbtrace_id: "trace" }) },
  ];

  const result = await sendMetaCrmEvent(
    { eventKey: "converted", leadId: "1796507634715208" },
    {
      accessToken: "secret-token",
      datasetId: "1659046345834069",
      apiVersion: "v26.0",
      retryDelays: [0, 0],
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return responses.shift();
      },
    },
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://graph.facebook.com/v26.0/1659046345834069/events");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-token");
  assert.doesNotMatch(calls[0].options.body, /secret-token/);
  assert.deepEqual(result, {
    eventName: "ConvertedLead",
    eventsReceived: 1,
    testEvent: false,
    traceId: "trace",
  });
});
