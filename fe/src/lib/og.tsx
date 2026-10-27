import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

// Next runs from fe/, where @fontsource/lora is a direct dependency (webpack would rewrite require.resolve).
const FONT_DIR = path.join(process.cwd(), 'node_modules/@fontsource/lora/files');
const font = (subset: string, weight: number) => readFile(path.join(FONT_DIR, `lora-${subset}-${weight}-normal.woff`));

/** Share card: site name, post title and a short description, in the site's palette and Lora (Vietnamese glyphs included). */
export async function renderOg({ title, kicker, description, siteName }: { title: string; kicker: string; description?: string | null; siteName: string }) {
  const [latin, viet, latinRegular, vietRegular] = await Promise.all([font('latin', 700), font('vietnamese', 700), font('latin', 400), font('vietnamese', 400)]);
  const size = title.length > 90 ? 48 : title.length > 50 ? 58 : 70;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fcfbf7', padding: '64px 72px', fontFamily: 'Lora', color: '#292724', borderTop: '14px solid #7c4530' }}>
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: '#7c4530' }}>{kicker}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: size, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
          {description && <div style={{ display: 'flex', marginTop: 24, fontSize: 28, lineHeight: 1.4, color: '#7d7364' }}>{description.length > 140 ? `${description.slice(0, 137)}…` : description}</div>}
        </div>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#7c4530' }}>{siteName}</div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Lora', data: latin, weight: 700, style: 'normal' },
        { name: 'Lora', data: viet, weight: 700, style: 'normal' },
        { name: 'Lora', data: latinRegular, weight: 400, style: 'normal' },
        { name: 'Lora', data: vietRegular, weight: 400, style: 'normal' },
      ],
    },
  );
}
