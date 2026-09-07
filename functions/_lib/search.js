// Turns raw user input into a safe FTS5 MATCH expression: strips anything
// that could be interpreted as an FTS5 operator (AND/OR/NOT/NEAR, quotes,
// parens, colons), then treats each remaining word as a quoted prefix match,
// OR'd together so a search matches any of the given words.
export function buildFtsQuery(rawQuery) {
  const words = rawQuery
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(w => w.length > 0)
    .slice(0, 8); // cap term count - keeps the query cheap regardless of input length

  if (words.length === 0) return null;
  return words.map(w => `"${w}"*`).join(" OR ");
}
