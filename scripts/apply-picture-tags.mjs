#!/usr/bin/env node
/**
 * Rewrites the raster <img> tags in index.html as <picture> elements that serve
 * the responsive WebP variants produced by generate-responsive-images.mjs.
 *
 *   <img src="works/NZXT/NZXT_3.png" class="work-modal-grid-img" ...>
 *
 * becomes
 *
 *   <picture>
 *     <source type="image/webp" sizes="..." srcset="img/320/works/NZXT/NZXT_3.webp 320w, ...">
 *     <img src="works/NZXT/NZXT_3.png" class="work-modal-grid-img" ... data-lightbox-src="img/2048/works/NZXT/NZXT_3.webp">
 *   </picture>
 *
 * The original file stays as the <img src> so browsers without WebP still get a
 * working page, and width/height/loading/decoding attributes are left untouched.
 *
 * The rewrite is a surgical splice on the raw source rather than a parse-and-
 * serialize, so the rest of the file keeps its exact formatting. Re-running the
 * script replaces previously generated <picture> wrappers, which keeps it safe
 * to run after adding images or changing the width ladder.
 *
 * Usage:
 *   node scripts/apply-picture-tags.mjs           # rewrite index.html in place
 *   node scripts/apply-picture-tags.mjs --check   # exit 1 if it would change anything
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_FILE = 'index.html';
const MANIFEST_FILE = 'img/manifest.json';

/**
 * How wide each image actually renders, so the browser can pick the right
 * variant. Rules are matched against the <img> classes and its ancestors'
 * classes, most specific first.
 *
 * Desktop: the modal is max-width 960px with 40px of padding per side, leaving
 * an 880px content box; grid gaps are 16px.
 * Mobile (<=768px): every modal grid collapses to one column inside 16px
 * padding, so images fill calc(100vw - 32px).
 */
const MOBILE = '(max-width: 768px) calc(100vw - 32px)';
const SIZE_RULES = [
  // Project cover images. Their container is display:none below 1025px and
  // max-width:calc(50vw - 100px) above it.
  { match: 'work-img-slide', sizes: '(max-width: 1024px) 100vw, calc(50vw - 100px)' },
  // Three across: (880 - 2*16) / 3
  { match: 'work-modal-grid-3', sizes: `${MOBILE}, 283px` },
  // Two across: (880 - 16) / 2
  { match: 'nzxt-dielines-grid', sizes: `${MOBILE}, 432px` },
  { match: 'work-modal-grid-2', sizes: `${MOBILE}, 432px` },
  { match: 'work-modal-grid-tall-left', sizes: `${MOBILE}, 432px` },
  { match: 'work-modal-grid-text-img', sizes: `${MOBILE}, 432px` },
  // Full content width.
  { match: 'work-modal-grid-1', sizes: `${MOBILE}, 880px` },
];
const DEFAULT_SIZES = `${MOBILE}, 880px`;

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const CHECK = process.argv.slice(2).includes('--check');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_FILE), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, HTML_FILE), 'utf8');

const classesOf = (tag) => {
  const m = tag.match(/\sclass\s*=\s*"([^"]*)"/i);
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
};
const attrOf = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
};

/** Walk the raw HTML, yielding every <img> together with its ancestor stack. */
function findImages(source) {
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const stack = [];
  const images = [];
  let match;
  while ((match = tagRe.exec(source)) !== null) {
    const [full, closing, rawName, , selfClosing] = match;
    const name = rawName.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (name === 'img') {
      images.push({
        tag: full,
        start: match.index,
        end: match.index + full.length,
        ancestors: stack.slice(),
      });
      continue;
    }
    if (!VOID_ELEMENTS.has(name) && !selfClosing) {
      stack.push({ name, classes: classesOf(full), start: match.index });
    }
  }
  return images;
}

function sizesFor(img) {
  const names = new Set([...classesOf(img.tag), ...img.ancestors.flatMap((a) => a.classes)]);
  const rule = SIZE_RULES.find((r) => names.has(r.match));
  return rule ? rule.sizes : DEFAULT_SIZES;
}

/** Everything on the img's line before the tag, used to keep indentation. */
function indentOf(source, start) {
  const lineStart = source.lastIndexOf('\n', start - 1) + 1;
  const prefix = source.slice(lineStart, start);
  return /^\s*$/.test(prefix) ? prefix : '';
}

const edits = [];
const skipped = [];
let rewritten = 0;

for (const img of findImages(html)) {
  const src = attrOf(img.tag, 'src');
  if (!src) continue;

  const entry = manifest.images[src];
  if (!entry) {
    if (/\.(png|jpe?g)$/i.test(src)) skipped.push(`${src} (no variants in manifest)`);
    continue;
  }

  const webp = entry.variants.filter((v) => v.path.endsWith('.webp'));
  if (webp.length === 0) {
    skipped.push(`${src} (no webp variants)`);
    continue;
  }

  const largest = webp[webp.length - 1];
  const srcset = webp.map((v) => `${v.path} ${v.width}w`).join(', ');
  const sizes = sizesFor(img);

  // Serve the lightbox a capped full-size WebP instead of the multi-megabyte
  // original; the original stays available as an onerror fallback.
  let imgTag = img.tag
    .replace(/\s+data-lightbox-src\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+data-lightbox-fallback\s*=\s*"[^"]*"/gi, '')
    .replace(/\s*\/?>$/, '');
  imgTag += ` data-lightbox-src="${largest.path}" data-lightbox-fallback="${src}">`;

  // If this img was already wrapped by a previous run, replace the whole wrapper.
  const wrapper = img.ancestors[img.ancestors.length - 1];
  const inPicture = wrapper && wrapper.name === 'picture';
  let start = img.start;
  let end = img.end;
  if (inPicture) {
    start = wrapper.start;
    const close = html.indexOf('</picture>', img.end);
    if (close === -1) {
      skipped.push(`${src} (unterminated <picture>)`);
      continue;
    }
    end = close + '</picture>'.length;
  }

  const indent = indentOf(html, start);
  const inner = indent ? `${indent}  ` : '';
  const replacement = indent
    ? [
        '<picture>',
        `${inner}<source type="image/webp" sizes="${sizes}" srcset="${srcset}">`,
        `${inner}${imgTag}`,
        `${indent}</picture>`,
      ].join('\n')
    : `<picture><source type="image/webp" sizes="${sizes}" srcset="${srcset}">${imgTag}</picture>`;

  edits.push({ start, end, replacement, src, sizes, variants: webp.length });
  rewritten += 1;
}

edits.sort((a, b) => a.start - b.start);
let out = '';
let cursor = 0;
for (const edit of edits) {
  out += html.slice(cursor, edit.start) + edit.replacement;
  cursor = edit.end;
}
out += html.slice(cursor);

if (CHECK) {
  if (out !== html) {
    console.error(`${HTML_FILE} is out of date. Run: npm run pictures`);
    process.exit(1);
  }
  console.log(`${HTML_FILE} is up to date (${rewritten} responsive images).`);
} else {
  if (out === html) {
    console.log(`${HTML_FILE} already up to date (${rewritten} responsive images).`);
  } else {
    fs.writeFileSync(path.join(ROOT, HTML_FILE), out);
    console.log(`Rewrote ${rewritten} <img> tags in ${HTML_FILE}.`);
  }
  for (const edit of edits) {
    console.log(`  ${edit.src.padEnd(30)} ${String(edit.variants).padStart(2)} variants  sizes="${edit.sizes}"`);
  }
}

if (skipped.length) {
  console.log(`\nSkipped ${skipped.length}:`);
  for (const s of skipped) console.log(`  ${s}`);
}
