export type MetaCrmEventKey =
  | "lead"
  | "contacted"
  | "qualified"
  | "disqualified"
  | "proposal"
  | "converted";

export type MetaCrmEventInput = {
  eventKey: MetaCrmEventKey;
  leadId: string | undefined;
  email?: string;
  phone?: string;
  eventTime?: number;
};

export const META_CRM_EVENT_NAMES: Readonly<Record<MetaCrmEventKey, string>>;

export function normalizeEmail(value: unknown): string;
export function normalizePhone(value: unknown): string;
export function buildMetaCrmPayload(
  input: MetaCrmEventInput & { testEventCode?: string },
): Record<string, unknown>;
export function sendMetaCrmEvent(
  input: MetaCrmEventInput,
  options?: Record<string, unknown>,
): Promise<{
  eventName: string;
  eventsReceived: number;
  testEvent: boolean;
  traceId: string | null;
}>;
