import { AppError } from '../../common/errors/app-error';

export const MAX_WIDGET_BYTES = 1024 * 1024;
export const WIDGET_NAME_RE = /^[a-z0-9][a-z0-9-]*\.html$/;

const ALLOWED_SCRIPT_HOSTS = ['cdnjs.cloudflare.com'];

/**
 * Heuristic scan of AI-generated widget HTML. These checks catch obvious mistakes early with a readable message;
 * the real enforcement is the CSP <meta> injected below plus the iframe sandbox, so a miss here is not a breach.
 */
const FORBIDDEN: [RegExp, string][] = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bEventSource\b/, 'EventSource'],
  [/\bsendBeacon\b/, 'navigator.sendBeacon'],
  [/\bimportScripts\b|\bnew\s+Worker\b|\bSharedWorker\b/, 'Worker'],
  [
    /<\s*(iframe|frame|frameset|embed|object|applet)\b/i,
    'thẻ iframe/embed/object',
  ],
  [/<\s*form\b[^>]*\baction\s*=/i, '<form action>'],
  [/<\s*meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh/i, 'meta refresh'],
  [/<\s*base\b/i, '<base>'],
  [
    /\b(localStorage|sessionStorage|indexedDB)\b/,
    'localStorage/sessionStorage/indexedDB',
  ],
  [/\bdocument\.cookie\b/, 'document.cookie'],
  [
    /\b(window\.)?(top|parent)\.(location|document)\b/,
    'truy cập window.top/parent',
  ],
];

export const HOST_MARKER = 'data-salmon-widget-host';

export function validateWidgetHtml(html: string, name: string): void {
  const fail = (why: string): never => {
    throw new AppError('WIDGET_INVALID', `Widget "${name}": ${why}`);
  };
  if (Buffer.byteLength(html) > MAX_WIDGET_BYTES) fail('vượt quá 1 MB');
  if (!/<\s*(html|body|div|svg|script|style|canvas|main|section)\b/i.test(html))
    fail('không giống một file HTML');
  for (const [re, label] of FORBIDDEN)
    if (re.test(html)) fail(`không được dùng ${label}`);

  for (const m of html.matchAll(
    /<\s*script\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi,
  )) {
    const src = m[1];
    if (/^data:/i.test(src)) continue;
    let host = '';
    try {
      host = new URL(src.startsWith('//') ? `https:${src}` : src).hostname;
    } catch {
      /* relative */
    }
    if (!ALLOWED_SCRIPT_HOSTS.includes(host))
      fail(
        `script ngoài không được phép (${src}); chỉ cho phép ${ALLOWED_SCRIPT_HOSTS.join(', ')}`,
      );
  }
  // Everything else must be self-contained (data: URIs / inline SVG); CSP blocks remote loads anyway.
  if (
    /<\s*(img|source|video|audio|link)\b[^>]*\b(src|href)\s*=\s*["']?\s*(https?:)?\/\//i.test(
      html,
    )
  )
    fail(
      'ảnh/phông/CSS phải nhúng dạng data: URI hoặc inline SVG, không tải từ URL ngoài',
    );
  if (/@import|url\(\s*["']?\s*(https?:)?\/\//i.test(html))
    fail('CSS không được tải tài nguyên ngoài');
}

export const WIDGET_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

const THEME_CSS = `:root{--bg:#fefdf8;--fg:#222;--accent:#7c4530;--muted:#6b6458;--border:#d9d4c7;color-scheme:light}
:root[data-theme="dark"]{--bg:#1b1a17;--fg:#ece8de;--accent:#e0a47c;--muted:#a8a193;--border:#3a3731;color-scheme:dark}
html,body{background:var(--bg);color:var(--fg)}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}`;

/** Reports the content height to the host page and applies the host's theme. The id comes from the URL hash. */
const HOST_SCRIPT = `(function(){var id=(location.hash.match(/id=([\\w-]+)/)||[])[1]||'';
function h(){var b=document.body,e=document.documentElement;return Math.ceil(Math.max(b?b.scrollHeight:0,e.scrollHeight));}
var last=0;function send(){var v=h();if(v&&v!==last){last=v;parent.postMessage({type:'widget-height',id:id,height:v},'*');}}
if(window.ResizeObserver){new ResizeObserver(send).observe(document.documentElement);}
addEventListener('load',send);setInterval(send,1000);
addEventListener('message',function(e){var d=e.data;if(d&&d.type==='theme'&&(d.value==='light'||d.value==='dark')){document.documentElement.setAttribute('data-theme',d.value);}});
parent.postMessage({type:'widget-ready',id:id},'*');})();`;

/** Wraps the author's HTML with the host CSP, theme variables and resize/theme script (idempotent). */
export function injectHost(html: string): string {
  if (html.includes(HOST_MARKER)) return html;
  const head = `<meta http-equiv="Content-Security-Policy" content="${WIDGET_CSP}" ${HOST_MARKER}><meta name="viewport" content="width=device-width,initial-scale=1"><style>${THEME_CSS}</style>`;
  const tail = `<script>${HOST_SCRIPT}</script>`;
  let out = html;
  // CSP must come before any author script, so it goes first in <head> (or at the very top).
  out = /<head[^>]*>/i.test(out)
    ? out.replace(/<head[^>]*>/i, (m) => `${m}${head}`)
    : /<html[^>]*>/i.test(out)
      ? out.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`)
      : `<!doctype html><html lang="vi"><head><meta charset="utf-8">${head}</head><body>${out}`;
  out = /<\/body>/i.test(out)
    ? out.replace(/<\/body>/i, `${tail}</body>`)
    : `${out}${tail}`;
  if (!/^\s*<!doctype/i.test(out)) out = `<!doctype html>${out}`;
  return out;
}
