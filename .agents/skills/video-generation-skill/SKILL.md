---
name: video-generation-skill
description: Generate long-form videos (>10s) by chaining multiple 10-second clips with visual continuity. Use when the user provides a master prompt, target duration, and optional reference images/videos, and asks for a video longer than the 10s single-clip limit.
---

# Video Generation Skill

Generate a video of arbitrary duration by splitting it into 10-second segments, carrying the last frame of each clip forward as the `starting_frame` of the next, then stitching everything into one MP4 with ffmpeg.

## Inputs required from user

1. **Master prompt** — describes the whole scene, style, mood, subject.
2. **Target duration** in seconds (e.g. 30, 60, 90).
3. **Reference images** (optional) — style/subject anchors, product to preserve (jewelry, garment, packaging), or an explicit first frame.
4. **Reference videos** (optional) — motion / pacing / aesthetic anchor.
5. **Brand logo** (optional) — PNG/JPG to overlay in post (see §6).

If any of these are missing and needed, ask before generating.

## Product-preservation preprocessing (MANDATORY when the user uploads a product image — jewelry, watch, garment, bottle, etc.)

The video model reinterprets uploaded images loosely. To preserve the exact product design, colors, and stones, ALWAYS run this preprocessing before generating clip 1:

1. **Extract the product** from the reference image using `imagegen--edit_image` — isolate the piece on a clean background (transparent or white). Save as `/mnt/documents/<slug>/product_isolated.png`.
2. **Upscale via Lovable pipeline** — call `imagegen--edit_image` again with `model: "premium"`, `width: 1920`, `height: 1920`, prompt to sharpen edges and enhance detail while preserving exact metal tone, stone color, and design.
3. **Composite into the opening frame** — call `imagegen--edit_image` with BOTH `[product_isolated_upscaled.png, scene_reference_or_prompt]` as inputs, instructing the model to place the EXACT product (matching stones, metal, geometry) on the described model/scene. This composited image becomes the `starting_frame` for clip 1.
4. **Reinforce in every clip prompt** — append: "Jewelry/product must match the reference image exactly: [describe stones, metal color, key design details]. Do not restyle, recolor, or redesign the piece."

Skipping this step causes the product to drift into a generic lookalike — the #1 failure mode reported by users.

## Model / character consistency (MANDATORY across every clip)

The generated human model (face, skin tone, ethnicity, age, hair color, hair style, body type, wardrobe) MUST remain identical across every clip in the film. A different-looking person in clip 2 breaks the whole video.

Enforce this with THREE reinforcing mechanisms — use all three, not one:

1. **Lock a canonical model description** the moment you write the shot list. Write one dense sentence and reuse it byte-identical in every clip prompt, e.g.: `"the same woman throughout: South Asian, mid-20s, warm ivory skin, defined cheekbones, dark brown almond eyes, sleek low chignon updo with center part, [wardrobe], [jewelry] — identical face and styling in every shot, do not change the model."` Paste this line into every clip prompt verbatim.
2. **Always carry the previous clip's last frame as `starting_frame`** for clips 2..N (already required for continuity). This is the single strongest identity anchor the video model has — never skip it, even for a cut to close-up or overhead.
3. **For close-ups, macros, or overhead shots** where the face may not be visible in the carry-frame, additionally pass the opening frame (`opening.jpg`) as a second reference by compositing a fresh keyframe with `imagegen--edit_image` from `[opening.jpg, previous_last_frame.jpg]` before generation, prompting: "same woman as reference 1, in the pose/framing of reference 2 — preserve exact face and features from reference 1." Use that composited image as `starting_frame`.

Never write a clip prompt that just says "a woman" or "the model" — always paste the full canonical description. Never let the model choose a fresh face per clip.


## Procedure

### 1. Plan segments
- `num_clips = ceil(duration / 10)`. Prefer 10s clips; only the last may be 5s if the remainder is ≤5s.
- Break the master prompt into a per-clip **shot list**. Each shot description must:
  - Preserve subject identity, wardrobe, lighting, palette, camera language, aspect ratio.
  - Describe the specific action/beat happening in that 10-second window.
  - End on a beat that naturally leads into the next shot (the visual state that the next clip's starting frame will show).
- Keep a single **style suffix** appended to every clip prompt (e.g. "cinematic, 35mm, warm color grade, shallow depth of field, matches reference"). This is the biggest driver of continuity across clips.

### 2. Generate clip 1
- Call `videogen--generate_video` with:
  - `prompt`: shot 1 description + style suffix.
  - `starting_frame`: the user's reference image if they supplied a first frame; otherwise omit.
  - `resolution: "1080p"`, `duration: 10`, and an `aspect_ratio` matching the reference (default `16:9`).
  - `camera_fixed: true` only if the reference/master prompt implies a locked camera.
- Save to `/mnt/documents/<slug>/clip_01.mp4`.

### 3. Extract the last frame and generate the next clip
For each subsequent clip `n`:
```bash
ffmpeg -sseof -0.1 -i /mnt/documents/<slug>/clip_<n-1>.mp4 -vframes 1 -q:v 2 /tmp/<slug>/frame_<n>.jpg
```
Then call `videogen--generate_video` with:
- `prompt`: shot `n` description + same style suffix. Start the prompt with a short "continues from previous shot" clause describing what's already on screen so the model doesn't reset composition.
- `starting_frame`: `/tmp/<slug>/frame_<n>.jpg` (this is the key continuity mechanism — `aspect_ratio` is inferred from the image).
- Same `resolution` and `duration` as clip 1.

Repeat until all clips exist.

### 4. Stitch with ffmpeg
Create a concat list and merge without re-encoding when possible:
```bash
cd /mnt/documents/<slug>
printf "file 'clip_%02d.mp4'\n" $(seq 1 N) > concat.txt
ffmpeg -f concat -safe 0 -i concat.txt -c copy final.mp4
```
If `-c copy` fails due to codec/timebase mismatch, re-encode:
```bash
ffmpeg -f concat -safe 0 -i concat.txt -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -an final.mp4
```

### 4b. Color grade — ALWAYS apply soft pastel (mandatory default)

Every stitched video MUST be color-graded with the **soft pastel** look before the end-card overlay, unless the user explicitly asks for a different grade. This is the locked house style.

Apply to the body of the video (everything before the end-card reveal):
```bash
ffmpeg -y -i stitched.mp4 -vf "eq=contrast=0.95:saturation=0.9:brightness=0.04,unsharp=5:5:0.6" \
  -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -r 24 -an graded.mp4
```
Then run the end-card overlay (step 5) on `graded.mp4`.



### 5. Logo overlay in post (when user provides a brand logo)

The video model cannot render legible logos or text — it will hallucinate glyphs. ALWAYS overlay logos in post with ffmpeg instead of prompting for them.

**Canonical brand end-card format** (default for every brand film unless the user overrides). This matches the reference format the user approved — a soft, elegant reveal where the scene stays visible and the logo appears as if embossed on it. Do NOT dim the frame to black.

Recipe:
- **Reserve clean space** in the final clip's prompt (e.g. "camera holds on empty calm water, center of frame uncluttered, no text").
- **Do NOT darken.** Apply a soft **lift + desaturation** only — the final scene should look misty pale, not black. Fade this in over ~1.5s starting ~2s before the logo.
- **Logo size:** ~30% of frame width (`iw*0.30`), centered horizontally, positioned around vertical middle (`y=(H-h)/2`).
- **Fade in:** logo opacity 0→1 over ~1.5s, then hold to end. No fade-out.
- **Duration:** last 3–4 seconds of the video.

Canonical ffmpeg command (works for both 9:16 and 16:9):

```bash
# Vars — tune LIFT_START (when lift starts), LOGO_START (when logo fade-in starts), TOTAL (video duration)
ffmpeg -y -i final_stitched.mp4 -loop 1 -i /tmp/<slug>/logo.png -filter_complex "\
color=c=white:s=WIDTHxHEIGHT:r=24:d=TOTAL,format=yuv420p[wh];\
[0:v][wh]blend=all_expr='A*(1-0.45*(1/(1+exp(-5*(T-LIFT_START-0.75)))))+B*(0.45*(1/(1+exp(-5*(T-LIFT_START-0.75)))))':shortest=1,hue=s=0.55[soft];\
[1:v]scale=iw*0.30:-1:flags=lanczos,format=rgba[lg];\
[soft][lg]overlay=x=(W-w)/2:y=(H-h)/2:enable='between(t,LOGO_START,TOTAL)':alpha=straight:eval=frame,\
fade=t=in:st=LOGO_START:d=1.5:alpha=1[out]" \
-map "[out]" -t TOTAL -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -movflags +faststart final.mp4
```

For a 25s video: `LIFT_START=21.5`, `LOGO_START=22.0`, `TOTAL=25.2`.

**Watermark alternative** (rarely used): scale to `iw*0.12`, drop the `enable` clause, position at `W-w-40:40` or `40:H-h-40`, no lift, no desaturation.

Preprocess logo: save to `/tmp/<slug>/logo.png` first (from the user's upload). If the logo ships on a solid background, run `imagegen--edit_image` with `transparent_background: true` to isolate it.

### 6. Deliver

Emit a `<presentation-artifact>` for `final.mp4` (mime `video/mp4`). Optionally also expose individual clips if the user asked for them.

## Rules

- Never exceed `duration: 10` per `videogen--generate_video` call — it's the hard cap.
- Every clip after clip 1 MUST pass `starting_frame` extracted from the previous clip's last frame. This is non-negotiable for continuity.
- Keep the same `resolution` and aspect ratio across all clips; mixing them breaks concat.
- Keep the style suffix byte-identical across clips.
- Keep the canonical model description byte-identical across clips (see Model / character consistency).
- End-card: use the lift+desaturate recipe above — never fade to black or heavily dim, and never let the logo sit on a black card.
- Long jobs: with `num_clips` large, generation may take a while — proceed without asking for confirmation unless the user requested a preview first.
- If the user gives reference videos, describe their look (palette, camera, pacing, film stock) in the style suffix — the video model cannot ingest reference videos directly.
- Working dir: `/tmp/<slug>/` for intermediates (frames, concat list scratch); `/mnt/documents/<slug>/` for clips and `final.mp4`.

## Quick checklist before generating

- [ ] Master prompt captured
- [ ] Duration → `num_clips` computed
- [ ] Shot list written (one beat per 10s)
- [ ] Style suffix locked
- [ ] Aspect ratio + resolution decided
- [ ] First-frame source decided (reference image vs model-chosen)
