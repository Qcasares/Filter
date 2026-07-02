// Topic allowlist as category score adjustments.
//
// The owner may want to keep US technology while still demoting US politics.
// This is expressed as an adjustment to the single US-relevance score, not as a
// second sensitivity dial: an allowlisted category simply has its score pulled
// down below any sane threshold so it survives, while everything else is judged
// by the one slider exactly as before.

export const ALLOWLIST_ADJUSTMENT = 60;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Pull down the score of a verdict whose category is on the allowlist.
 * @param {object} verdict a verdict with at least { score, category }
 * @param {string[]} allowlistCategories
 * @returns {object} a new verdict, with `adjusted:true` when a change was made
 */
export function applyAllowlist(verdict, allowlistCategories = []) {
  if (!verdict || !verdict.category) return verdict;
  if (!allowlistCategories.includes(verdict.category)) return verdict;
  return {
    ...verdict,
    score: clamp(verdict.score - ALLOWLIST_ADJUSTMENT, 0, 100),
    adjusted: true
  };
}
