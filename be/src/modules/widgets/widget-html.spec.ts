import { HOST_MARKER, injectHost, validateWidgetHtml } from './widget-html';

const ok =
  '<!doctype html><html><head><title>x</title></head><body><div id="a">hi</div><script>document.getElementById("a").onclick=()=>{}</script></body></html>';

describe('validateWidgetHtml', () => {
  it('accepts a self-contained widget and a cdnjs script', () => {
    expect(() => validateWidgetHtml(ok, 'a.html')).not.toThrow();
    expect(() =>
      validateWidgetHtml(
        '<div></div><script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>',
        'a.html',
      ),
    ).not.toThrow();
    expect(() =>
      validateWidgetHtml(
        '<svg></svg><img src="data:image/png;base64,AAAA">',
        'a.html',
      ),
    ).not.toThrow();
  });

  it.each([
    ['fetch', '<div></div><script>fetch("/x")</script>'],
    ['XMLHttpRequest', '<div></div><script>new XMLHttpRequest()</script>'],
    ['WebSocket', '<div></div><script>new WebSocket("wss://x")</script>'],
    ['iframe', '<div></div><iframe src="x"></iframe>'],
    ['form action', '<form action="https://evil"><input></form><div></div>'],
    ['localStorage', '<div></div><script>localStorage.x=1</script>'],
    ['parent access', '<div></div><script>parent.document.body</script>'],
    [
      'external script',
      '<div></div><script src="https://evil.example/x.js"></script>',
    ],
    ['external image', '<div></div><img src="https://x/y.png">'],
    ['css import', '<style>@import url(https://x/y.css)</style><div></div>'],
    ['css remote url', '<div style="background:url(//x/y.png)"></div>'],
    [
      'meta refresh',
      '<meta http-equiv="refresh" content="0;url=x"><div></div>',
    ],
  ])('rejects %s', (_l, html) => {
    expect(() => validateWidgetHtml(html, 'a.html')).toThrow(/Widget "a.html"/);
  });

  it('rejects oversized and non-HTML input', () => {
    expect(() =>
      validateWidgetHtml(`<div>${'x'.repeat(1024 * 1024)}</div>`, 'a.html'),
    ).toThrow(/1 MB/);
    expect(() => validateWidgetHtml('plain text only', 'a.html')).toThrow(
      /HTML/,
    );
  });
});

describe('injectHost', () => {
  it('puts the CSP meta first in <head> and the host script before </body>', () => {
    const out = injectHost(ok);
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(
      out.indexOf('<title>'),
    );
    expect(out).toContain("connect-src 'none'");
    expect(out.indexOf('widget-height')).toBeLessThan(out.indexOf('</body>'));
  });

  it('handles fragments without html/head/body and is idempotent', () => {
    const out = injectHost('<div>frag</div>');
    expect(out).toMatch(/^<!doctype html><html/i);
    expect(out).toContain('<div>frag</div>');
    expect(injectHost(out)).toBe(out);
    expect(out.split(HOST_MARKER)).toHaveLength(2);
  });

  it('adds the CSP even when the document has <html> but no <head>', () => {
    const out = injectHost('<html><body><p>x</p></body></html>');
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(
      out.indexOf('<body>'),
    );
  });
});
