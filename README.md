Situation: My old portfolio highlighted graphic design, not my recent UI/UX growth.

Task: I wanted to show my full digital design and web skills.

Action: Collaborating with AI to build the site, I used Figma to reorganize it into four clear categories.

Result: The new site is cleaner, easier to navigate, and better shows what I can do.

## Responsive images

Photos are served as WebP through `<picture>` elements. Source files stay where
they are (`works/...`, `hero_bg.png`) and every derivative lives under `img/`,
one directory per pixel width:

```
img/320/works/NZXT/NZXT_3.webp
img/640/works/NZXT/NZXT_3.webp
img/2048/works/NZXT/NZXT_3.webp   <- also what the zoom viewer loads
```

Widths are 320 / 480 / 640 / 960 / 1280 / 1600 / 2048. Images are never upscaled,
so a 913px source ends up as a 913px file in `img/960/`; `img/manifest.json`
records the real pixel width of each variant, which is what the `srcset` `w`
descriptors use.

The original PNG/JPG stays as the `<img src>` fallback, so browsers without WebP
support still render the page.

### Workflow

```bash
npm install          # one-time, for the tooling
npm run images       # encode variants for any new/changed source image
npm run pictures     # rewrite index.html's <img> tags as <picture> elements
npm run build        # both of the above
```

Both asset steps are incremental and idempotent: `npm run images` skips sources
whose content hash is unchanged, and `npm run pictures` rewrites wrappers it
generated earlier, so it is safe to re-run after adding images. `--check`
(e.g. `npm run images:check`) reports staleness without writing anything.

After adding an image to `works/`, reference it in `index.html` with a plain
`<img src="works/...">` and run `npm run images && npm run pictures`.

The `sizes` attributes are derived from the grid class each image sits in; that
mapping lives in `SIZE_RULES` in `scripts/apply-picture-tags.mjs` and needs
updating if the modal grid layout changes.
