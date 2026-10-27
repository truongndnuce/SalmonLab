import type { Metadata } from 'next';
import { Lora } from 'next/font/google';
import { SITE_URL } from '@/lib/env';
import './globals.css';

const lora = Lora({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-lora',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

// Runs before first paint so there is no flash of the wrong theme. A stored choice wins over the system setting.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={lora.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
