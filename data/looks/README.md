# Looks database (outfit rules)

Source of truth for the outfit helper (stage 1). Each look is one JSON file in `data/looks/` named `look-NNN.json`.
Only the author's own looks and descriptions go here. Do not copy third-party videos or photos.

Fields:
- `id`: "look-001"
- `source`: link to the original video (reference only, not copied)
- `pieces`: list of { `slot` (top | bottom | outer | shoes | bag | accessory), `item` (plain description), `brand` (optional), `era` (optional, e.g. FW08) }
- `rules`: short statements of what works and why, using the vocabulary below
- `silhouette`: one of: oversized-top/slim-bottom | slim-top/wide-bottom | long-layered | cropped-wide | all-fitted | all-oversized
- `palette`: list of colours; `contrast`: low | medium | high
- `tags`: free tags (e.g. gothic, archive, avant-garde, streetwear)

Rule vocabulary (extend as the author's taste becomes clear):
- proportion: where the volume sits (top, bottom, balanced), length of layers
- colour: palette limits, number of accent colours, tonal vs contrast
- texture: leather, distressed, matte vs shine mixing
- finishing: shoes, bag and accessory logic
