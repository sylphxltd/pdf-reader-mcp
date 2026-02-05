// PNG encoding utilities for PDF images

import { PNG } from 'pngjs';
import { IMAGE_CHANNELS, IMAGE_FORMATS, ImageKind } from '../../constants/pdf.js';
import type { ExtractedImage } from '../../types/pdf.js';

/**
 * Encode raw pixel data to PNG format
 */
export const encodePixelsToPNG = (
  pixelData: Uint8Array,
  width: number,
  height: number,
  channels: number
): string => {
  const png = new PNG({ width, height });

  // Convert pixel data to RGBA format expected by pngjs
  if (channels === 4) {
    // Already RGBA
    png.data = Buffer.from(pixelData);
  } else if (channels === 3) {
    // RGB -> RGBA (add alpha channel)
    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * 3;
      const dstIdx = i * 4;
      png.data[dstIdx] = pixelData[srcIdx] ?? 0; // R
      png.data[dstIdx + 1] = pixelData[srcIdx + 1] ?? 0; // G
      png.data[dstIdx + 2] = pixelData[srcIdx + 2] ?? 0; // B
      png.data[dstIdx + 3] = 255; // A (fully opaque)
    }
  } else if (channels === 1) {
    // Grayscale -> RGBA
    for (let i = 0; i < width * height; i++) {
      const gray = pixelData[i] ?? 0;
      const dstIdx = i * 4;
      png.data[dstIdx] = gray; // R
      png.data[dstIdx + 1] = gray; // G
      png.data[dstIdx + 2] = gray; // B
      png.data[dstIdx + 3] = 255; // A
    }
  }

  // Encode to PNG and convert to base64
  const pngBuffer = PNG.sync.write(png);
  return pngBuffer.toString('base64');
};

/**
 * Process raw image data from PDF.js and convert to ExtractedImage
 */
export const processImageData = (
  imageData: unknown,
  pageNum: number,
  arrayIndex: number
): ExtractedImage | null => {
  if (!imageData || typeof imageData !== 'object') {
    return null;
  }

  const img = imageData as {
    width?: number;
    height?: number;
    data?: Uint8Array;
    kind?: number;
  };

  if (!img.data || !img.width || !img.height) {
    return null;
  }

  // Determine number of channels and format based on kind
  // ImageKind: GRAYSCALE=1, RGB=2, RGBA=3
  const kind = (img.kind ?? ImageKind.RGB) as number;
  const channels = IMAGE_CHANNELS[kind as keyof typeof IMAGE_CHANNELS] ?? 3;
  const format = IMAGE_FORMATS[kind as keyof typeof IMAGE_FORMATS] ?? 'rgb';

  // Encode raw pixel data to PNG format
  const pngBase64 = encodePixelsToPNG(img.data, img.width, img.height, channels);

  return {
    page: pageNum,
    index: arrayIndex,
    width: img.width,
    height: img.height,
    format,
    data: pngBase64,
  };
};
