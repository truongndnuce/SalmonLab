'use client';

import { useEffect } from 'react';

const SELECTOR = 'figure.widget[data-widget-src]:not([data-mounted])';
let seq = 0;

const currentTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function mount(figure: HTMLElement) {
  figure.dataset.mounted = '1';
  const id = `w${++seq}`;
  const iframe = document.createElement('iframe');
  // No allow-same-origin: the widget runs in an opaque origin and can't touch the site's cookies or storage.
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.referrerPolicy = 'no-referrer';
  iframe.loading = 'lazy';
  iframe.title = figure.dataset.widgetTitle ?? 'Hoạt ảnh tương tác';
  iframe.dataset.widgetId = id;
  iframe.className = 'widget-frame';
  iframe.style.height = `${figure.dataset.widgetHeight ?? 400}px`;
  iframe.src = `${figure.dataset.widgetSrc}#id=${id}`;
  figure.insertBefore(iframe, figure.firstChild);
}

/**
 * Upgrades `<figure class="widget">` placeholders (produced by the Markdown pipeline) into sandboxed iframes when
 * they approach the viewport, and relays height/theme messages. With `observe` (the admin live preview) widgets
 * mount immediately and content replaced after mount is picked up.
 */
export function WidgetRuntime({ observe = false }: { observe?: boolean }) {
  useEffect(() => {
    // The admin preview mounts immediately: the author just inserted the widget and expects to see it, wherever
    // the page happens to be scrolled. Public pages stay lazy.
    const io =
      !observe && 'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (!e.isIntersecting) continue;
                io!.unobserve(e.target);
                mount(e.target as HTMLElement);
              }
            },
            { rootMargin: '400px 0px' },
          )
        : null;

    const scan = () => {
      for (const fig of document.querySelectorAll<HTMLElement>(SELECTOR)) {
        if (io) {
          if (fig.dataset.observed) continue;
          fig.dataset.observed = '1';
          io.observe(fig);
        } else {
          mount(fig);
        }
      }
    };
    scan();

    const frames = () => document.querySelectorAll<HTMLIFrameElement>('iframe.widget-frame');
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; id?: string; height?: number } | null;
      if (!d || typeof d !== 'object') return;
      // Trust only messages whose source is one of our widget iframes, never an arbitrary window.
      const frame = [...frames()].find((f) => f.contentWindow === e.source && f.dataset.widgetId === d.id);
      if (!frame) return;
      if (d.type === 'widget-height' && typeof d.height === 'number' && Number.isFinite(d.height)) {
        frame.style.height = `${Math.min(4000, Math.max(80, Math.ceil(d.height)))}px`;
      } else if (d.type === 'widget-ready') {
        frame.contentWindow?.postMessage({ type: 'theme', value: currentTheme() }, '*');
      }
    };
    window.addEventListener('message', onMessage);

    const themeObserver = new MutationObserver(() => {
      for (const f of frames()) f.contentWindow?.postMessage({ type: 'theme', value: currentTheme() }, '*');
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const domObserver = observe ? new MutationObserver(scan) : null;
    domObserver?.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('message', onMessage);
      themeObserver.disconnect();
      domObserver?.disconnect();
      io?.disconnect();
    };
  }, [observe]);

  return null;
}
