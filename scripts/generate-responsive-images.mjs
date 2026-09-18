#!/usr/bin/env node
/**
 * Generates responsive raster variants for every source image on the site.
 *
 * Source images stay exactly where they are (works/..., hero_bg.png). Every
 * derivative lands under img/<width>/<same relative path>.webp, so the tree
 * under img/ mirrors the source tree one directory per pixel width:
 *
 *   works/NZXT/NZXT_3.png  ->  img/320/works/NZXT/NZXT_3.webp
 *                              img/640/works/NZXT/NZXT_3.webp
 *                              img/2048/works/NZXT/NZXT_3.webp
 *
 * Directory names come from a fixed ladder (320/480/640/960/1280/1600/2048) so
 * the tree stays predictable. Images are never upscaled, so a 913px source ends
 * up as a 913px file inside img/960/ -- the manifest records the real pixel
 * width, which is what the `w` descriptors in the srcset need. Buckets stop at
 * the first one that already holds the full-size image, so each source is
 * encoded at full resolution exactly once for the zoomable lightbox.
 *
 * Results are written to img/manifest.json, which scripts/apply-picture-tags.mjs
 * reads to build the srcset attributes in index.html.
 *
 * Usage:
 *   node scripts/generate-responsive-images.mjs           # write missing/stale variants
 *   node scripts/generate-responsive-images.mjs --force   # rebuild everything
 *   node scripts/generate-responsive-images.mjs --check    # fail if anything is stale (CI)
 *   node scripts/generate-responsive-images.mjs --avif     # also emit AVIF variants
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = 'img';
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

/** Directories scanned for source images. */
const SOURCE_DIRS = ['works'];
/** Individual files outside those directories. */
const SOURCE_FILES = ['hero_bg.png'];
/** Never generate variants for these (tiny icons, favicons). */
const EXCLUDE = [/^icons\//, /^img\//];

const WIDTHS = [320, 480, 640, 960, 1280, 1600, 2048];
const MAX_WIDTH = 2048;

const QUALITY = { webp: 80, avif: 55 };

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const CHECK = args.has('--check');
const FORMATS = args.has('--avif') ? ['webp', 'avif'] : ['webp'];

const isRaster = (f) => /\.(png|jpe?g)$/i.test(f);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return [rel];
  });
}

function collectSources() {
  const found = [...SOURCE_DIRS.flatMap(walk), ...SOURCE_FILES];
  return found
    .map((f) => f.split(path.sep).join('/'))
    .filter(isRaster)
    .filter((f) => !EXCLUDE.some((re) => re.test(f)))
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .sort();
}

/** img/640/works/NZXT/NZXT_3.webp */
function variantPath(source, width, format) {
  const withoutExt = source.replace(/\.[^.]+$/, '');
  return `${OUT_DIR}/${width}/${withoutExt}.${format}`;
}

/**
 * Ladder buckets to emit for a source. Every bucket strictly below the source
 * width is a real downscale; the first bucket at or above it holds the
 * full-size (never upscaled) image, and nothing beyond that is emitted.
 */
function widthsFor(sourceWidth) {
  const capped = Math.min(sourceWidth, MAX_WIDTH);
  const buckets = [];
  for (const w of WIDTHS) {
    buckets.push(w);
    if (w >= capped) break;
  }
  return buckets;
}

function hashFile(absPath) {
  return createHash('sha1').update(fs.readFileSync(absPath)).digest('hex').slice(0, 16);
}

async function encode(source, width, format) {
  const out = variantPath(source, width, format);
  const absOut = path.join(ROOT, out);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  const pipeline = sharp(path.join(ROOT, source)).resize({
    width,
    withoutEnlargement: true,
    fit: 'inside',
  });

  if (format === 'webp') pipeline.webp({ quality: QUALITY.webp, effort: 5 });
  else pipeline.avif({ quality: QUALITY.avif, effort: 4 });

  const info = await pipeline.toFile(absOut);
  return { path: out, width: info.width, height: info.height, bytes: info.size };
}

async function main() {
  const sources = collectSources();
  if (sources.length === 0) {
    console.error('No source images found.');
    process.exit(1);
  }

  const previous = fs.existsSync(path.join(ROOT, MANIFEST))
    ? JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8'))
    : { images: {} };

  const manifest = { generatedWith: { widths: WIDTHS, maxWidth: MAX_WIDTH, formats: FORMATS, quality: QUALITY }, images: {} };
  const stale = [];
  let written = 0;
  let reused = 0;
  let sourceBytes = 0;
  let variantBytes = 0;

  for (const source of sources) {
    const abs = path.join(ROOT, source);
    const meta = await sharp(abs).metadata();
    const hash = hashFile(abs);
    const prev = previous.images?.[source];
    const prevValid =
      prev &&
      prev.hash === hash &&
      prev.variants?.every((v) => fs.existsSync(path.join(ROOT, v.path))) &&
      FORMATS.every((f) => prev.variants.some((v) => v.path.endsWith(`.${f}`)));

    sourceBytes += fs.statSync(abs).size;

    if (prevValid && !FORCE) {
      manifest.images[source] = prev;
      reused += prev.variants.length;
      variantBytes += prev.variants.reduce((n, v) => n + v.bytes, 0);
      continue;
    }

    if (CHECK) {
      stale.push(source);
      manifest.images[source] = prev ?? null;
      continue;
    }

    const variants = [];
    for (const format of FORMATS) {
      for (const width of widthsFor(meta.width)) {
        variants.push(await encode(source, width, format));
        written += 1;
      }
    }
    variantBytes += variants.reduce((n, v) => n + v.bytes, 0);
    manifest.images[source] = {
      hash,
      width: meta.width,
      height: meta.height,
      variants: variants.sort((a, b) => a.width - b.width || a.path.localeCompare(b.path)),
    };
    console.log(`  ${source} -> ${variants.length} variants`);
  }

  if (CHECK) {
    if (stale.length) {
      console.error(`${stale.length} image(s) have no up-to-date variants:\n  ${stale.join('\n  ')}`);
      console.error('Run: npm run images');
      process.exit(1);
    }
    console.log(`All ${sources.length} source images have current variants.`);
    return;
  }

  fs.writeFileSync(path.join(ROOT, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);

  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  console.log(
    `\n${sources.length} sources (${mb(sourceBytes)}) -> ${written + reused} variants (${mb(variantBytes)}); ` +
      `${written} written, ${reused} reused.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
