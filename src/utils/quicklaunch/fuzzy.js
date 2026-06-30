// Small, dependency-free fuzzy matcher for the command palette. It scores a
// candidate string against a query: a direct substring match ranks highest,
// otherwise a subsequence match earns points with bonuses for prefix,
// word-boundary and contiguous hits. Returns -Infinity when the query is not a
// subsequence of the text (i.e. no match).

const WORD_BOUNDARY = /[\s\-_./:]/;

export function fuzzyScore(query, text) {
  if (query == null || String(query) === "") return 0;
  if (text == null || String(text) === "") return -Infinity;

  const q = String(query).toLowerCase();
  const t = String(text).toLowerCase();

  // Fast path: a contiguous substring match is always the strongest signal,
  // ranked by how early it appears.
  const idx = t.indexOf(q);
  if (idx !== -1) {
    let score = 100 + q.length * 2;
    if (idx === 0) score += 15;
    else if (WORD_BOUNDARY.test(t[idx - 1])) score += 10;
    score -= idx;
    return score;
  }

  // Subsequence match with positional bonuses.
  let score = 0;
  let ti = 0;
  let prevMatch = -2;
  for (let qi = 0; qi < q.length; qi += 1) {
    const ch = q[qi];
    let found = -1;
    for (; ti < t.length; ti += 1) {
      if (t[ti] === ch) {
        found = ti;
        break;
      }
    }
    if (found === -1) return -Infinity; // not a subsequence -> no match
    score += 1;
    if (found === prevMatch + 1) score += 3; // contiguous run
    if (found === 0) score += 8; // start of string
    else if (WORD_BOUNDARY.test(t[found - 1])) score += 5; // word boundary
    prevMatch = found;
    ti = found + 1;
  }

  // Prefer denser matches (shorter remaining text).
  score -= Math.max(0, t.length - q.length) * 0.05;
  return score;
}

// Filter and rank items by fuzzy score against the query. An empty/whitespace
// query yields no results (matching the palette's "type to search" behaviour).
// The sort is stable, so items with equal scores keep their input order.
export function fuzzyFilter(query, items = [], getText = (item) => item) {
  if (query == null || String(query).trim() === "") return [];
  const scored = [];
  for (const item of items) {
    const score = fuzzyScore(query, getText(item));
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.item);
}
