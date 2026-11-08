// Outfit suggestions from the looks database (data/looks). Rules are DRAFT until confirmed by the author.
const LOOKS = [
  require('../../data/looks/look-001.json'),
  require('../../data/looks/look-002.json'),
  require('../../data/looks/look-003.json'),
  require('../../data/looks/look-004.json'),
  require('../../data/looks/look-005.json'),
  require('../../data/looks/look-006.json'),
  require('../../data/looks/look-007.json'),
  require('../../data/looks/look-008.json'),
];

const norm = (s) => String(s || '').toLowerCase().trim();
const sameColour = (a, b) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));

// item: { slot: 'outer'|'top'|'bottom'|'shoes'|..., colors: string[] }
export function suggestLooks(item, limit = 3) {
  const colors = (item.colors || []).map(norm).filter(Boolean);
  return LOOKS
    .map((look) => {
      const colourHits = colors.filter((c) => look.palette.some((p) => sameColour(p, c))).length;
      const slotHit = item.slot && look.pieces.some((p) => p.slot === item.slot) ? 1 : 0;
      return { look, score: colourHits * 2 + slotHit };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => ({ id: x.look.id, silhouette: x.look.silhouette, palette: x.look.palette, rules: x.look.rules.slice(0, 2),
      pieces: x.look.pieces.map((p) => p.item), draft: !x.look.confirmed_by_author }));
}
