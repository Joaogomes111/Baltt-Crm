import test from "node:test";
import assert from "node:assert/strict";
import { changedLeads, indexLeadVersions } from "../lib/crm-sync.mjs";

test("saving one lead does not resend unchanged sales from an older tab", () => {
  const loaded = [
    { id: "sale", stage: "ganho", proposalValue: 100 },
    { id: "note", stage: "novo", notes: "" },
  ];
  const versions = indexLeadVersions(loaded);
  const edited = [loaded[0], { ...loaded[1], notes: "Retornar amanha" }];

  assert.deepEqual(changedLeads(edited, versions), [edited[1]]);
});

test("new leads and actual sale edits are included", () => {
  const loaded = [{ id: "sale", stage: "ganho", proposalValue: 100 }];
  const edited = [
    { ...loaded[0], proposalValue: 150 },
    { id: "new", stage: "novo", proposalValue: 0 },
  ];

  assert.deepEqual(changedLeads(edited, indexLeadVersions(loaded)), edited);
});

test("the merged server response becomes the next sync baseline", () => {
  const response = [
    { id: "sale", proposalValue: 200 },
    { id: "note", notes: "Retornar amanha" },
  ];

  assert.deepEqual(changedLeads(response, indexLeadVersions(response)), []);
});
