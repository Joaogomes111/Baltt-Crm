import { createHash } from "node:crypto";

export const META_CRM_EVENT_NAMES = Object.freeze({
  lead: "Lead",
  contacted: "ContactedLead",
  qualified: "QualifiedLead",
  disqualified: "DisqualifiedLead",
  proposal: "ProposalSent",
  converted: "ConvertedLead",
});

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

function eventNameFor(eventKey) {
  const eventName = META_CRM_EVENT_NAMES[eventKey];
  if (!eventName) throw new Error(`Evento de CRM invalido: ${eventKey}.`);
  return eventName;
}

function normalizedLeadId(value) {
  const leadId = String(value ?? "").trim();
  if (!/^\d{8,32}$/.test(leadId)) {
    throw new Error("Lead da Meta sem lead_id valido.");
  }
  return leadId;
}

export function buildMetaCrmPayload({
  eventKey,
  leadId,
  email,
  phone,
  eventTime = Math.floor(Date.now() / 1000),
  testEventCode,
}) {
  const eventName = eventNameFor(eventKey);
  const exactLeadId = normalizedLeadId(leadId);
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const parsedEventTime = Math.floor(Number(eventTime));
  const safeEventTime = Number.isFinite(parsedEventTime) && parsedEventTime > 0
    ? parsedEventTime
    : Math.floor(Date.now() / 1000);
  const userData = { lead_id: exactLeadId };

  if (normalizedEmail) userData.em = [sha256(normalizedEmail)];
  if (normalizedPhone) userData.ph = [sha256(normalizedPhone)];

  const payload = {
    data: [
      {
        action_source: "system_generated",
        custom_data: {
          event_source: "crm",
          lead_event_source: "Baltt CRM",
        },
        event_id: `baltt-crm:${exactLeadId}:${eventName}`,
        event_name: eventName,
        event_time: safeEventTime,
        user_data: userData,
      },
    ],
  };

  if (testEventCode) payload.test_event_code = testEventCode;
  return payload;
}

function readMetaError(data, status) {
  const message = data?.error?.message || data?.message;
  return message || `A Meta recusou o evento de CRM (HTTP ${status}).`;
}

export async function sendMetaCrmEvent(input, options = {}) {
  const accessToken = options.accessToken || process.env.META_CRM_ACCESS_TOKEN;
  const datasetId = options.datasetId || process.env.META_CRM_DATASET_ID;
  const apiVersion = options.apiVersion || process.env.META_GRAPH_API_VERSION || "v26.0";
  const testEventCode =
    options.testEventCode === undefined
      ? process.env.META_CRM_TEST_EVENT_CODE
      : options.testEventCode;
  const fetchImpl = options.fetchImpl || fetch;

  if (!accessToken || !datasetId) {
    throw new Error("META_CRM_ACCESS_TOKEN e META_CRM_DATASET_ID precisam estar configurados.");
  }

  const payload = buildMetaCrmPayload({ ...input, testEventCode });
  const endpoint = `https://graph.facebook.com/${apiVersion}/${datasetId}/events`;
  const delays = options.retryDelays ?? [0, 500, 1500];
  let lastError;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await wait(delays[attempt]);

    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          eventName: payload.data[0].event_name,
          eventsReceived: Number(data.events_received ?? 0),
          testEvent: Boolean(testEventCode),
          traceId: data.fbtrace_id || null,
        };
      }

      const error = new Error(readMetaError(data, response.status));
      error.status = response.status;
      lastError = error;
      if (!RETRYABLE_STATUS_CODES.has(response.status)) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Falha de rede ao enviar evento para a Meta.");
    }
  }

  throw lastError || new Error("Nao foi possivel enviar o evento de CRM para a Meta.");
}
