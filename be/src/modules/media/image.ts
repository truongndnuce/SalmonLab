import * as sharp from 'sharp';
import { AppError } from '../../common/errors/app-error';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 2400;

const FORMATS = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
  gif: { mime: 'image/gif', ext: 'gif' },
} as const;

export interface ProcessedImage {
  buffer: Buffer;
  mime: string;
  ext: string;
  width: number;
  height: number;
}

/**
 * Decode the upload (trusting the bytes, never the client's mime type), downscale oversized images and drop
 * metadata such as EXIF/GPS. SVG and anything else sharp can't decode as a raster format is rejected.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { animated: true }).metadata();
  } catch {
    throw new AppError('INVALID_IMAGE', 'File không phải ảnh hợp lệ');
  }
  const format = FORMATS[meta.format as keyof typeof FORMATS];
  if (!format)
    throw new AppError(
      'UNSUPPORTED_IMAGE',
      'Chỉ hỗ trợ ảnh JPG, PNG, WebP, GIF',
    );

  // Animated GIFs are kept as-is: re-encoding would drop frames for little gain.
  if (meta.format === 'gif' && (meta.pages ?? 1) > 1) {
    return {
      buffer: input,
      mime: format.mime,
      ext: format.ext,
      width: meta.width ?? 0,
      height: meta.pageHeight ?? meta.height ?? 0,
    };
  }

  const { data, info } = await sharp(input)
    .rotate() // apply EXIF orientation before the metadata is stripped
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFormat(meta.format as keyof typeof FORMATS)
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    mime: format.mime,
    ext: format.ext,
    width: info.width,
    height: info.height,
  };
}
