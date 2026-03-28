import sharp from 'sharp';
import { join } from 'node:path';
import type { MaterialFile } from '../types.js';

// Japan visa photo: 45mm x 35mm at 300dpi = 531 x 413 px
const WIDTH = 413;
const HEIGHT = 531;

export async function processPhoto(imageBuffer: Buffer, outputDir: string): Promise<MaterialFile> {
  const outputPath = join(outputDir, 'photo.jpg');

  await sharp(imageBuffer)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 95 })
    .toFile(outputPath);

  const { size } = await sharp(outputPath).metadata();

  return {
    name: '签证照片',
    path: outputPath,
    type: 'jpg',
    size: size ?? 0,
  };
}
