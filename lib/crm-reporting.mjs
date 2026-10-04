/** @param {string} value */
export function reportDate(value) {
  const raw = String(value ?? "").trim();
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const parsed = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : "";
}

/**
 * @param {string} date
 * @param {string} filter
 * @param {string} start
 * @param {string} end
 * @param {Date} [today]
 */
export function dateMatchesPeriod(date, filter, start = "", end = "", today = new Date()) {
  if (filter === "all") return true;
  const value = reportDate(date);
  if (!value) return false;
  if (filter === "custom") {
    const from = reportDate(start);
    const to = reportDate(end);
    return (!from || value >= from) && (!to || value <= to);
  }
  const last = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const first = new Date(last);
  first.setDate(first.getDate() - Number(filter) + 1);
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return timestamp >= first.getTime() && timestamp <= last.getTime();
}

/** @typedef {{ stage: string, closeDate: string, proposalValue: number, company: string }} Sale */

/**
 * @template {Sale} T
 * @param {T[]} leads
 * @param {string} filter
 * @param {string} start
 * @param {string} end
 */
export function salesInPeriod(leads, filter, start = "", end = "") {
  return leads.filter((lead) => lead.stage === "ganho" && dateMatchesPeriod(lead.closeDate, filter, start, end));
}

/** @param {{proposalValue: number}[]} leads */
export function sumValues(leads) {
  return leads.reduce((sum, lead) => sum + Math.round((Number(lead.proposalValue) || 0) * 100), 0) / 100;
}

/** @param {string | undefined} value */
export function parseMoneyValue(value) {
  let amount = String(value ?? "").replace(/[^\d,.-]/g, "");
  if (amount.includes(",")) {
    amount = amount.replace(/\./g, "").replace(",", ".");
  } else if (!/^-?\d+\.\d{1,2}$/.test(amount)) {
    amount = amount.replace(/\./g, "");
  }
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** @param {Sale[]} leads */
export function monthlySales(leads) {
  /** @type {Map<string, {key: string, count: number, cents: number, companies: Record<string, number>}>} */
  const months = new Map();
  for (const lead of leads) {
    if (lead.stage !== "ganho") continue;
    const key = reportDate(lead.closeDate).slice(0, 7) || "sem-data";
    const row = months.get(key) ?? { key, count: 0, cents: 0, companies: {} };
    const cents = Math.round((Number(lead.proposalValue) || 0) * 100);
    row.count += 1;
    row.cents += cents;
    row.companies[lead.company] = (row.companies[lead.company] ?? 0) + cents;
    months.set(key, row);
  }
  return [...months.values()].sort((a, b) => a.key.localeCompare(b.key)).map((row) => ({
    key: row.key,
    count: row.count,
    value: row.cents / 100,
    companies: Object.fromEntries(Object.entries(row.companies).map(([key, cents]) => [key, cents / 100])),
  }));
}
