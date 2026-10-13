/**
 * @template {{ id: string }} T
 * @param {T[]} leads
 * @returns {Map<string, string>}
 */
export function indexLeadVersions(leads) {
  return new Map(leads.map((lead) => [lead.id, JSON.stringify(lead)]));
}

/**
 * @template {{ id: string }} T
 * @param {T[]} leads
 * @param {Map<string, string>} syncedVersions
 * @returns {T[]}
 */
export function changedLeads(leads, syncedVersions) {
  return leads.filter(
    (lead) => syncedVersions.get(lead.id) !== JSON.stringify(lead),
  );
}
