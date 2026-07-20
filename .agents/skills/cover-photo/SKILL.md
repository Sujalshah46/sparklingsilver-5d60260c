---
name: cover-photo
description: Sparkling Silver homepage category/subcategory cover tiles — locked emerald velvet drape backdrop, charcoal marble pedestal, jewelry on the left, ivory overlay on the right. Use whenever generating or replacing an `opt-cat-*.webp` tile.
---

# Cover Photo Skill (Sparkling Silver category tiles)

Purpose: keep every category and subcategory cover tile visually identical to the approved Antique + CZ tiles so the homepage grid reads as one system. Never invent a new look — reuse the recipe below verbatim.

## Locked visual contract

- **Dimensions / export**: **1376 x 768** (≈16:9, matches the shipped Antique + CZ tiles), export as WebP, quality 90, method 6, to `src/assets/opt-cat-<slug>.webp`. Reuse the existing asset filename for the category being replaced. Do NOT ship at 1920x960 or any other ratio — both live tiles are 1376x768 and mismatched dimensions break the homepage grid alignment.
- **Layout**: jewelry lives on the LEFT half; RIGHT half is calm negative space for the `CategoryTile` overlay ("<Name> / N DESIGNS" + "+N NEW" chip). Never bake text into the pixels.
- **Backdrop — emerald velvet drape (NOT a flat radial)**: this is the detail that must carry across every tile. The Antique + CZ tiles use a **textured velvet drape** with:
  - Base emerald hue centered at `#0A2E22`, falling to `#041610` at the edges.
  - Soft **vertical drape folds** — gentle darker-to-lighter bands running top-to-bottom, as if heavy velvet is hanging behind the pedestal. Not a symmetric radial, not a flat fill.
  - A **warm top-left key light** glow that lifts the upper-left quadrant slightly (adds warmth without shifting hue off emerald). The rest of the frame falls into deeper shadow.
  - Subtle velvet nap/grain texture across the whole surface — enough to read as fabric on a large screen, never so busy that the right-half overlay text loses contrast.
  - No seams between halves, no reserved logo box, no watermark, no baked-in gradient bands across the horizontal axis.
- **Pedestal**: **round charcoal marble plinth** (subtle grey veining, matte reflection, soft rim light on the top edge) centered under the jewelry on the left half. Round base — not rectangular, not wood, not fabric. This is the "premium/museum" cue and it must appear on every tile.
- **Lighting**: single soft top-left key on the jewelry, matching the backdrop's warm glow direction. Gentle rim on the pedestal edge; everything else falls into the velvet. No harsh specular highlights, no colored gels, no bottom uplight.
- **Jewelry**: extract as a clean feathered RGBA cutout from the source photo — never carry the source background over. **Upscale the cutout to at least 1600px on its longest side using `imagegen--edit_image` (premium)** before compositing; the shipped tiles use hi-res cutouts and a low-res source is visible on desktop. Scale so the piece occupies ~55–72% of the left half's height, centered on the pedestal top, front-facing.
- **Color fidelity (non-negotiable)**: preserve the exact metal tone (antique gold stays antique gold, silver stays silver — do not force silver) and the exact bead/gemstone hue from the source. Same rule as `mem://preferences/preserve-jewelry-color` — after compositing, sample the beads/stones and match saturation/hue back to the original if the model shifted them.
- **Logo**: do NOT overlay the Sparkling Silver logo on cover tiles. The logo overlay rule from the jewelry-image-pipeline applies to product SKU images only, not homepage covers.

## Text-overlay contract (must stay legible)

The `CategoryTile` component (`src/components/CategoryTile.tsx`) renders the name, a divider, and "N DESIGNS" on the right half over a soft dark scrim, in warm ivory `#F5EFE0` with a `0 1px 3px rgba(0,0,0,0.55)` shadow. The "+N NEW" chip sits top-right in mint `#A5D7D2` on teal-900. Do not edit `CategoryTile.tsx` when shipping a new tile — the overlay already handles the text.

When designing a new tile:
1. Keep the right half free of high-frequency detail (no chains, no beads, no bright highlights) — the scrim relies on a calm dark field to keep contrast high.
2. Sample four points on the right half after export; all four must stay within the emerald hue range (H ~150–165, S > 25, V 15–35 in HSV). If any point drifts (e.g. a bright pedestal edge bleeds right, or a fold band lights up), rebuild the composition.
3. Do not add on-image typography, taglines, or watermarks — the component owns all text.

## Workflow

1. **Gather source**: get the reference jewelry image from the user (or from the category's hero SKU). Confirm which category slug + asset path is being replaced.
2. **Cutout**: extract the jewelry to a transparent PNG. Feather the alpha edge slightly; remove the source background completely.
3. **Upscale the cutout**: run `imagegen--edit_image` (model: `premium`) on the cutout to reach ≥1600px on its longest side before compositing. Do not skip — low-res cutouts are visible on the live homepage.
4. **Match the reference tile, don't re-derive it**: the safest path is to reuse the shipped Antique tile (`src/assets/opt-cat-premium-antique.webp`) as a direct style reference — same drape folds, same warm top-left glow, same round charcoal marble plinth. Use `imagegen--edit_image` with the reference tile + upscaled cutout to place the new jewelry into the identical scene. This is what produced the CZ tile match; re-deriving the backdrop from scratch drifts off.
5. **Verify dimensions and negative space**: output must be 1376x768 with the jewelry sitting in the left half and the right half calm dark velvet.
6. **Color pass**: compare against the source. If the beads/stones/metal shifted, apply a targeted HSL correction to just those pixels until they match the source hue and saturation.
7. **Preview first**: save a JPG preview to `/mnt/documents/<category>-tile-preview.jpg` (or `-v2`, `-v3` for revisions) and show it to the user with `<presentation-artifact>`. Do NOT overwrite the live asset until the user approves.
8. **Ship on approval**: convert the approved preview to WebP (quality 90, method 6) at **1376x768** and write to `src/assets/opt-cat-<slug>.webp`, overwriting the existing file.
9. **Verify**: load `/` in the preview, screenshot the tile in the grid, and confirm the overlay text is legible and the tile sits consistently next to the Antique + CZ tiles.

## Consistency checklist (run before shipping)

- [ ] 1376 x 768 WebP at the right `opt-cat-*.webp` path (matches Antique + CZ)
- [ ] Jewelry on the LEFT half, right half is calm dark velvet
- [ ] Emerald velvet **drape with vertical folds** (not a flat radial), base `#0A2E22` falling to `#041610`
- [ ] Warm top-left key-light glow present on the backdrop
- [ ] Round charcoal marble pedestal with subtle veining and rim light
- [ ] Jewelry cutout upscaled to ≥1600px before compositing
- [ ] Top-left key light on the jewelry matches the backdrop light direction
- [ ] Metal tone matches source exactly (gold stays gold, silver stays silver)
- [ ] Bead/stone hue and saturation match source
- [ ] No baked-in text, no logo overlay, no watermark
- [ ] Right-half HSV sample stays in emerald range (contrast for ivory overlay text)
- [ ] Side-by-side visual match against `opt-cat-premium-antique.webp` and `opt-cat-premium-cz.webp`
- [ ] User approved the `/mnt/documents/*-tile-preview*` artifact before overwriting `src/assets/opt-cat-*.webp`

## References

- Approved reference tiles (use as direct style match): `src/assets/opt-cat-premium-antique.webp`, `src/assets/opt-cat-premium-cz.webp`
- Overlay component: `src/components/CategoryTile.tsx`
- Related rules: `mem://preferences/preserve-jewelry-color`, `mem://preferences/no-auto-pricing`
- Related pipeline (product SKU images, NOT covers): `knowledge://skill/jewelry-image-pipeline`
