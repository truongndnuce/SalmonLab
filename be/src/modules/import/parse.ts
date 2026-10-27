import { posix } from 'node:path';
import * as AdmZip from 'adm-zip';
import * as matter from 'gray-matter';
import { parse as parseToml } from 'smol-toml';
import { AppError } from '../../common/errors/app-error';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MAX_UNPACKED_BYTES = 60 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export interface ParsedDoc {
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  tags: string[];
  category: string | null;
  kind: 'POST' | 'INFOGRAPHIC';
  date: Date | null;
  bodyMd: string;
}

const throwJs = () => {
  // gray-matter would otherwise eval a `---js` front matter block.
  throw new AppError(
    'INVALID_FRONTMATTER',
    'Front matter dạng JS không được hỗ trợ',
  );
};

const str = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

function toDate(v: unknown): Date | null {
  // smol-toml's TomlDate subclass keeps the source offset in toISOString(); normalise to a plain Date.
  const d =
    v instanceof Date
      ? new Date(v.getTime())
      : typeof v === 'string'
        ? new Date(v)
        : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function toList(v: unknown): string[] {
  const items = Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? v.split(',')
      : [];
  return items.map((x) => String(x).trim()).filter(Boolean);
}

/** Parses a Markdown file with optional YAML front matter (Hugo/Jekyll style). */
export function parseMarkdown(text: string, filename = ''): ParsedDoc {
  let fm: matter.GrayMatterFile<string>;
  try {
    // Hugo's default front matter is TOML between "+++" lines; everything else is YAML between "---".
    const toml = /^\s*\+\+\+\r?\n/.test(text);
    fm = matter(text, {
      engines: {
        js: throwJs,
        javascript: throwJs,
        toml: (s: string) => parseToml(s),
      },
      ...(toml && { language: 'toml', delimiters: '+++' }),
    });
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('INVALID_FRONTMATTER', 'Front matter YAML không hợp lệ');
  }
  const d = fm.data as Record<string, unknown>;
  let body = fm.content.replace(/^\s+/, '');

  let title = str(d.title);
  if (!title) {
    // Fall back to a leading "# Heading" (removed from the body so it isn't rendered twice), then the filename.
    const h1 = /^#\s+(.+?)\s*#*\s*(?:\r?\n|$)/.exec(body);
    if (h1) {
      title = h1[1].trim();
      body = body.slice(h1[0].length).replace(/^\s+/, '');
    } else {
      title =
        filename
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]+/g, ' ')
          .trim() || null;
    }
  }

  const cat = Array.isArray(d.categories)
    ? d.categories[0]
    : (d.category ?? d.categories);
  return {
    title,
    slug: str(d.slug),
    excerpt: str(d.excerpt) ?? str(d.description) ?? str(d.summary),
    tags: toList(d.tags),
    category: cat == null ? null : str(String(cat)),
    kind:
      String(d.kind ?? d.type ?? '').toLowerCase() === 'infographic'
        ? 'INFOGRAPHIC'
        : 'POST',
    date: toDate(d.date ?? d.publishedAt),
    bodyMd: body,
  };
}

export interface ZipContent {
  mdName: string;
  md: string;
  /** Image bytes keyed by normalised in-archive path. */
  images: Map<string, Buffer>;
  /** Widget HTML files keyed by normalised in-archive path. */
  htmls: Map<string, Buffer>;
}

function safePath(name: string): string | null {
  const n = name.replace(/\\/g, '/');
  if (n.startsWith('/') || /^[a-zA-Z]:/.test(n)) return null;
  const parts = n.split('/');
  if (parts.some((p) => p === '..')) return null;
  return posix.normalize(n);
}

/**
 * Reads a .zip fully in memory (nothing is ever extracted to disk, so path tricks can't write files) and still
 * rejects traversal-style names, oversized archives and decompression bombs.
 */
export function readZip(buffer: Buffer): ZipContent {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new AppError('INVALID_ZIP', 'File .zip không hợp lệ');
  }
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (entries.length > MAX_ENTRIES)
    throw new AppError(
      'ZIP_TOO_MANY_FILES',
      `File .zip có quá ${MAX_ENTRIES} tệp`,
    );

  let declared = 0;
  const mds: { name: string; entry: AdmZip.IZipEntry }[] = [];
  const imgs: { name: string; entry: AdmZip.IZipEntry }[] = [];
  const htmls: { name: string; entry: AdmZip.IZipEntry }[] = [];
  for (const entry of entries) {
    const name = safePath(entry.entryName);
    if (!name)
      throw new AppError(
        'ZIP_UNSAFE_PATH',
        `Đường dẫn không an toàn trong .zip: ${entry.entryName}`,
      );
    if (name.startsWith('__MACOSX/') || posix.basename(name).startsWith('.'))
      continue;
    declared += entry.header.size;
    if (declared > MAX_UNPACKED_BYTES)
      throw new AppError('ZIP_TOO_LARGE', 'Nội dung giải nén của .zip quá lớn');
    if (/\.(md|markdown)$/i.test(name)) mds.push({ name, entry });
    else if (IMAGE_EXT.test(name)) imgs.push({ name, entry });
    else if (/\.html?$/i.test(name)) htmls.push({ name, entry });
  }
  if (mds.length === 0)
    throw new AppError('ZIP_NO_MARKDOWN', 'Không tìm thấy file .md trong .zip');
  // Prefer index.md / the shallowest file when the archive holds more than one.
  mds.sort(
    (a, b) =>
      a.name.split('/').length - b.name.split('/').length ||
      a.name.localeCompare(b.name),
  );
  const main =
    mds.find((m) => /(^|\/)(index|readme)\.(md|markdown)$/i.test(m.name)) ??
    mds[0];

  const images = new Map<string, Buffer>();
  for (const { name, entry } of imgs) {
    if (entry.header.size > MAX_IMAGE_BYTES) continue;
    const data = entry.getData();
    if (data.length <= MAX_IMAGE_BYTES) images.set(name, data);
  }
  const htmlMap = new Map<string, Buffer>();
  for (const { name, entry } of htmls) {
    if (entry.header.size > 1024 * 1024)
      throw new AppError('WIDGET_INVALID', `Widget "${name}": vượt quá 1 MB`);
    htmlMap.set(name, entry.getData());
  }
  return {
    mdName: main.name,
    md: main.entry.getData().toString('utf8'),
    images,
    htmls: htmlMap,
  };
}

const IMG_RE = /(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;

/**
 * Rewrites relative image links to the URLs returned by `resolve` (which uploads on demand). Absolute http(s)/data
 * URLs are left alone. Links that don't resolve are reported in `missing`.
 */
export async function rewriteImages(
  md: string,
  mdName: string,
  images: Map<string, Buffer>,
  resolve: (path: string, data: Buffer) => Promise<string>,
): Promise<{ md: string; missing: string[] }> {
  const dir = posix.dirname(mdName);
  const byBase = new Map<string, string[]>();
  for (const p of images.keys()) {
    const b = posix.basename(p);
    byBase.set(b, [...(byBase.get(b) ?? []), p]);
  }
  const missing = new Set<string>();
  const cache = new Map<string, string>();
  const matches = [...md.matchAll(IMG_RE)];
  let out = '';
  let last = 0;
  for (const m of matches) {
    const target = m[2];
    out += md.slice(last, m.index);
    last = m.index + m[0].length;
    if (/^(https?:|data:|\/\/)/i.test(target)) {
      out += m[0];
      continue;
    }
    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      /* keep raw */
    }
    const rel = decoded.split(/[?#]/)[0];
    const full = posix.normalize(posix.join(dir, rel));
    // Fall back to a unique basename match, because exports often move images into a sibling folder.
    const hit = images.has(full)
      ? full
      : (byBase.get(posix.basename(rel)) ?? []).length === 1
        ? byBase.get(posix.basename(rel))![0]
        : null;
    if (!hit) {
      missing.add(target);
      out += m[0];
      continue;
    }
    if (!cache.has(hit)) cache.set(hit, await resolve(hit, images.get(hit)!));
    out += `${m[1]}${cache.get(hit)}${m[3]}`;
  }
  return { md: out + md.slice(last), missing: [...missing] };
}

const WIDGET_RE = /^::widget\{([^}\n]*)\}[ \t]*$/gm;
const ATTR_RE = /(\w+)="([^"]*)"/g;

export interface WidgetDirective {
  src: string;
  title: string | null;
}

/** `::widget{src="widgets/a.html" ...}` directives in a Markdown body. */
export function findWidgets(md: string): WidgetDirective[] {
  const out: WidgetDirective[] = [];
  for (const m of md.matchAll(WIDGET_RE)) {
    const attrs = Object.fromEntries(
      [...m[1].matchAll(ATTR_RE)].map((a) => [a[1], a[2]]),
    );
    if (attrs.src) out.push({ src: attrs.src, title: attrs.title ?? null });
  }
  return out;
}

/** Replaces each directive's `src` using `map` (old src -> new src); directives not in the map are untouched. */
export function replaceWidgetSrc(md: string, map: Map<string, string>): string {
  return md.replace(WIDGET_RE, (line, attrs: string) =>
    line.replace(
      attrs,
      attrs.replace(/\bsrc="([^"]*)"/, (a, src: string) =>
        map.has(src) ? `src="${map.get(src)}"` : a,
      ),
    ),
  );
}
