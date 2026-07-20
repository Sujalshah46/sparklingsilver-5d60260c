---
name: cover-photo
description: Design a Sparkling Silver homepage category or subcategory cover tile — 2:1 emerald velvet backdrop with the jewelry on the left half, marble pedestal, museum lighting, preserved metal/bead color, and negative space on the right for the CategoryTile text overlay. Use whenever the user asks for a new category/subcategory cover, wants to "change the tile", or asks to replace `src/assets/opt-cat-*.webp`.
---

# Cover Photo Skill (Sparkling Silver category tiles)

Purpose: keep every category and subcategory cover tile visually consistent with the approved Antique tile so the homepage grid reads as one system. Never invent a new look — reuse the recipe below.

## Locked visual contract

- **Aspect / size**: 2:1, render at 1920x960, export as WebP to `src/assets/opt-cat-<slug>.webp` (e.g. `opt-cat-premium-antique.webp`, `opt-cat-cz-jewelry.webp`, `opt-cat-antique-baju.webp`). Reuse the existing asset filename for the category being replaced.
- **Layout**: jewelry lives on the LEFT half; RIGHT half is clean negative space. The `CategoryTile` component overlays "<Name> / N DESIGNS" and the "+N NEW" badge on the right — never bake text into the pixels.
- **Backdrop**: uniform dark emerald velvet, centered at `#0A2E22`, edges falling to `#041610` via a soft radial vignette. No gradients across the horizontal axis, no visible seams, no reserved logo box, no watermark. Both halves must sample to the same hue so the text overlay reads on either side.
- **Pedestal**: charcoal marble plinth (subtle grey veining, matte reflection) centered under the jewelry on the left half. This is the "premium/museum" cue — do not swap for wood, fabric, or a floating shadow.
- **Lighting**: single soft top-left key light on the jewelry, gentle rim on the pedestal edge, everything else falls into the velvet. No harsh specular, no colored gels.
- **Jewelry**: extract as a clean feathered RGBA cutout from the source photo — never carry the source background over (source backgrounds are inconsistent and will break the tile). Scale so the piece occupies ~55–65% of the left half's height, centered on the pedestal top.
- **Color fidelity (non-negotiable)**: preserve the exact metal tone (antique gold stays antique gold, silver stays silver — do not force silver) and the exact bead/gemstone hue from the source. This is the same rule as `mem://preferences/preserve-jewelry-color` — after compositing, sample the beads/stones and match saturation/hue back to the original if the model shifted them.
- **Logo**: do NOT overlay the Sparkling Silver logo on cover tiles. The logo overlay rule from the jewelry-image-pipeline applies to product SKU images only, not homepage covers.

## Text-overlay contract (must stay legible)

The `CategoryTile` component (`src/components/CategoryTile.tsx`) renders the name, a divider, and "N DESIGNS" on the right half over a soft dark scrim, in warm ivory `#F5EFE0` with a `0 1px 3px rgba(0,0,0,0.55)` shadow. The "+N NEW" chip sits top-right in mint `#A5D7D2` on teal-900.

When designing a new tile:
1. Keep the right half free of high-frequency detail (no chains, no beads, no bright highlights) — the scrim relies on a calm dark field to keep contrast high.
2. Sample four points on the right half after export; all four must stay within the emerald hue range (H ~150–165, S > 25, V 15–35 in HSV). If any point drifts (e.g. a bright pedestal edge bleeds right), rebuild the composition.
3. Do not add on-image typography, taglines, or watermarks — the component owns all text.

## Workflow

1. **Gather source**: get the reference jewelry image from the user (or from the category's hero SKU). Confirm which category slug + asset path is being replaced.
2. **Cutout**: extract the jewelry to a transparent PNG. Feather the alpha edge slightly; remove the source background completely. Do not upscale below source resolution.
3. **Compose** at 1920x960:
   - Fill with the emerald radial velvet (`#0A2E22` center → `#041610` edges).
   - Place the marble pedestal on the left half, centered horizontally in that half, sitting ~55% down the canvas.
   - Place the cutout on the pedestal, matching the museum lighting direction.
   - Add a soft contact shadow beneath the piece — never a hard drop shadow.
4. **Color pass**: compare against the source. If the beads/stones/metal shifted, apply a targeted HSL correction to just those pixels until they match the source hue and saturation.
5. **Preview first**: save a JPG preview to `/mnt/documents/<category>-tile-preview.jpg` (or `-v2`, `-v3` for revisions) and show it to the user with `<presentation-artifact>`. Do NOT overwrite the live asset until the user approves.
6. **Ship on approval**: convert the approved preview to WebP (quality 90, method 6) and write to `src/assets/opt-cat-<slug>.webp`, overwriting the existing file. Do not touch `CategoryTile.tsx` — the overlay already handles the text.
7. **Verify**: load `/` in the preview, screenshot the tile in the grid, and confirm the overlay text is legible and the tile sits consistently next to the other category tiles.

## Consistency checklist (run before shipping)

- [ ] 2:1 ratio, 1920x960 source, exported as WebP to the right `opt-cat-*.webp` path
- [ ] Jewelry on the LEFT half, right half is calm dark velvet
- [ ] Emerald velvet `#0A2E22` → `#041610` radial; both halves sample to the same hue
- [ ] Marble pedestal present, charcoal with subtle veining
- [ ] Top-left key light only; no colored lighting
- [ ] Metal tone matches source exactly (gold stays gold, silver stays silver)
- [ ] Bead/stone hue and saturation match source
- [ ] No baked-in text, no logo overlay, no watermark
- [ ] Right-half HSV sample stays in emerald range (contrast for ivory overlay text)
- [ ] User approved the `/mnt/documents/*-tile-preview*` artifact before overwriting `src/assets/opt-cat-*.webp`

## References

- Approved reference tile: `src/assets/opt-cat-premium-antique.webp` (Ram Parivar necklace, v3 preview)
- Overlay component: `src/components/CategoryTile.tsx`
- Related rules: `mem://preferences/preserve-jewelry-color`, `mem://preferences/no-auto-pricing`
- Related pipeline (product SKU images, NOT covers): `knowledge://skill/jewelry-image-pipeline`
