import assert from "node:assert/strict";
import test from "node:test";
import { dateMatchesPeriod, monthlySales, parseMoneyValue, reportDate, salesInPeriod, sumValues } from "../lib/crm-reporting.mjs";

test("sales use closing date even when the lead arrived in a previous month", () => {
  const leads = [
    { company: "baltec", stage: "ganho", arrivalDate: "2026-08-19", closeDate: "2026-09-24", proposalValue: 31190.45 },
    { company: "vale", stage: "ganho", arrivalDate: "2026-09-10", closeDate: "2026-10-02", proposalValue: 800 },
    { company: "vale", stage: "perdido", closeDate: "2026-09-24", proposalValue: 99999 },
    { company: "baltt", stage: "proposta", closeDate: "2026-09-24", proposalValue: 88888 },
    { company: "baltec", stage: "ganho", closeDate: "2026-09-24", proposalValue: 0 },
  ];
  const sales = salesInPeriod(leads, "custom", "2026-09-01", "2026-09-30");
  assert.equal(sales.length, 2);
  assert.equal(sumValues(sales), 31190.45);
  assert.equal(sumValues(salesInPeriod(leads, "all")), 31990.45);
  assert.deepEqual(monthlySales(sales), [{ key: "2026-09", count: 2, value: 31190.45, companies: { baltec: 31190.45 } }]);
});

test("unknown closing dates remain separate instead of using the arrival date", () => {
  const leads = [{ company: "baltt", stage: "ganho", arrivalDate: "2026-09-01", closeDate: "", proposalValue: 100 }];
  assert.equal(salesInPeriod(leads, "custom", "2026-09-01", "2026-09-30").length, 0);
  assert.equal(salesInPeriod(leads, "all").length, 1);
  assert.equal(monthlySales(leads)[0].key, "sem-data");
});

test("rolling dates use today's calendar date, exclude future dates and respect boundaries", () => {
  const today = new Date(2026, 9, 3, 23);
  assert.equal(dateMatchesPeriod("2026-09-27", "7", "", "", today), true);
  assert.equal(dateMatchesPeriod("2026-09-26", "7", "", "", today), false);
  assert.equal(dateMatchesPeriod("2026-10-03", "7", "", "", today), true);
  assert.equal(dateMatchesPeriod("2026-10-04", "7", "", "", today), false);
  assert.equal(dateMatchesPeriod("2026-08-19", "30", "", "", today), false);
  assert.equal(dateMatchesPeriod("30/09/2026", "custom", "2026-09-01", "2026-09-30"), true);
  assert.equal(dateMatchesPeriod("2026-09-01", "custom", "2026-09-01", "2026-09-30"), true);
  assert.equal(reportDate("31/09/2026"), "");
});

test("monthly totals reconcile to company totals to the cent and exclude lost proposals", () => {
  const leads = [
    { company: "baltec", stage: "ganho", closeDate: "2026-08-31", proposalValue: 0.1 },
    { company: "vale", stage: "ganho", closeDate: "2026-09-01", proposalValue: 0.2 },
    { company: "vale", stage: "ganho", closeDate: "2026-09-01", proposalValue: 0.1 },
    { company: "vale", stage: "perdido", closeDate: "2026-09-01", proposalValue: 100000 },
  ];
  const rows = monthlySales(leads);
  assert.equal(rows[1].value, 0.3);
  assert.equal(rows[1].companies.vale, 0.3);
  assert.equal(sumValues(salesInPeriod(leads, "all")), 0.4);
});

test("reimporting CRM currency values preserves cents instead of multiplying sales", () => {
  for (const amount of [0, 1140, 5332.7, 31190.45, 120735.59]) {
    assert.equal(parseMoneyValue(String(amount)), amount);
  }
  assert.equal(parseMoneyValue("R$ 31.190,45"), 31190.45);
  assert.equal(parseMoneyValue("1.234"), 1234);
  assert.equal(parseMoneyValue("1.234.567,89"), 1234567.89);
});
