/** Lowercase, accent-free text that keeps a 1:1 character mapping, so match offsets apply to the original. */
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD')[0] ?? ch;
    out += base === 'đ' || base === 'Đ' ? 'd' : base.toLowerCase();
  }
  return out;
}

/** Query terms: letters/digits only (so they're safe inside a tsquery), folded, de-duplicated. */
export function searchTerms(q: string): string[] {
  const terms = fold(q)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((t) => t.slice(0, 40));
  return [...new Set(terms)].slice(0, 8);
}

const stripMarkdown = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^::.*$/gm, ' ')
    .replace(/[#>*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** A short plain-text excerpt around the first matching term (or the start of the text when none matches). */
export function makeSnippet(md: string, terms: string[], length = 180): string {
  const text = stripMarkdown(md);
  if (!text) return '';
  const folded = fold(text);
  const hits = terms.map((t) => folded.indexOf(t)).filter((i) => i >= 0);
  const at = hits.length ? Math.min(...hits) : 0;
  const start = Math.max(0, at - 50);
  const slice = text.slice(start, start + length).trim();
  return `${start > 0 ? '… ' : ''}${slice}${start + length < text.length ? ' …' : ''}`;
}
