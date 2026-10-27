/**
 * Imports a Hugo `content/` tree through the admin API (so slugs, tags, images and widgets get the same validation
 * as a manual import). Posts are created as drafts, keeping their original dates, unless --publish is given.
 *
 *   pnpm --filter @salmon/be import:hugo -- <content-dir> --email admin@example.com --password '...' \
 *     [--api http://localhost:4000/api/v1] [--on-conflict rename|overwrite|reject] [--publish] [--dry-run]
 *
 * A page bundle (a folder with index.md plus images/widgets) is sent as a .zip; a lone .md file is sent as is.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import AdmZip = require('adm-zip');

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const dir = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--') || args[i - 1] === '--publish' || args[i - 1] === '--dry-run'));

const API = opt('api', 'http://localhost:4000/api/v1')!;
const onConflict = opt('on-conflict', 'rename')!;
const publish = flag('publish');
const dry = flag('dry-run');

interface Item {
  name: string;
  data: Buffer;
  filename: string;
}

/** Bundles (folder with index.md) become zips; every other .md/.markdown file is its own item. _index.md is Hugo list metadata. */
function collect(root: string): Item[] {
  const items: Item[] = [];
  const walk = (d: string) => {
    const entries = readdirSync(d);
    const bundle = entries.find((e) => /^index\.(md|markdown)$/i.test(e));
    if (bundle && d !== root) {
      const zip = new AdmZip();
      const add = (p: string) => {
        for (const e of readdirSync(p)) {
          const full = join(p, e);
          if (statSync(full).isDirectory()) add(full);
          else zip.addFile(relative(d, full).split('\\').join('/'), readFileSync(full));
        }
      };
      add(d);
      items.push({ name: relative(root, d), data: zip.toBuffer(), filename: `${basename(d)}.zip` });
      return;
    }
    for (const e of entries) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(md|markdown)$/i.test(e) && !/^_index\./i.test(e)) items.push({ name: relative(root, full), data: readFileSync(full), filename: e });
    }
  };
  walk(root);
  return items;
}

async function call(path: string, init: RequestInit & { token?: string }) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...(init.token && { authorization: `Bearer ${init.token}` }), ...(init.headers as object) } });
  const body = (await res.json().catch(() => ({}))) as { data?: any; meta?: any; error?: { code: string; message: string } };
  if (!res.ok) throw new Error(`${body.error?.code ?? res.status}: ${body.error?.message ?? res.statusText}`);
  return body;
}

async function main() {
  if (!dir) throw new Error('Usage: import-hugo <content-dir> --email ... --password ... [--publish] [--dry-run]');
  const items = collect(dir);
  console.log(`Found ${items.length} item(s) in ${dir}`);
  if (dry) {
    for (const i of items) console.log(`  would import ${i.name} (${i.filename}, ${i.data.length} bytes)`);
    return;
  }
  const email = opt('email');
  const password = opt('password') ?? process.env.IMPORT_PASSWORD;
  if (!email || !password) throw new Error('--email and --password (or IMPORT_PASSWORD) are required');
  const login = await call('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const token = login.data.accessToken as string;

  let ok = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(item.data)]), item.filename);
      form.append('onConflict', onConflict);
      const res = await call('/admin/import', { method: 'POST', body: form, token });
      if (publish) await call(`/admin/posts/${res.data.id}/publish`, { method: 'POST', token });
      ok++;
      const w = res.meta.warnings as string[];
      console.log(`✔ ${item.name} → /${res.data.slug} (${res.meta.outcome}${publish ? ', published' : ''})${w.length ? `\n    ⚠ ${w.join('\n    ⚠ ')}` : ''}`);
    } catch (e) {
      failed++;
      console.error(`✘ ${item.name}: ${(e as Error).message}`);
    }
  }
  console.log(`\nDone: ${ok} imported, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
