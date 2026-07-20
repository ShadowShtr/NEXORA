import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { reencodePhotoAsJpeg } from '@/lib/image-processing';

async function makeJpegWithExif(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 120 } } })
    .withExif({ IFD0: { Copyright: 'Test Studio', GPSLatitude: '38/1,42/1,0/1' } })
    .jpeg()
    .toBuffer();
}

// NEX-094, docs/05_SECURITY_PRIVACY.md "Uploads": "Remover EXIF no processamento" +
// "verificação por assinatura quando possível".
describe('reencodePhotoAsJpeg', () => {
  it('strips EXIF metadata (including GPS) from the output', async () => {
    const input = await makeJpegWithExif(40, 40);
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const output = await reencodePhotoAsJpeg(input);
    const outputMetadata = await sharp(output).metadata();
    expect(outputMetadata.exif).toBeUndefined();
    expect(outputMetadata.format).toBe('jpeg');
  });

  it('caps dimensions at 2000px, preserving aspect ratio', async () => {
    const input = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const output = await reencodePhotoAsJpeg(input);
    const outputMetadata = await sharp(output).metadata();
    expect(outputMetadata.width).toBe(2000);
    expect(outputMetadata.height).toBe(1000);
  });

  it('never upscales a smaller image', async () => {
    const input = await sharp({
      create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const output = await reencodePhotoAsJpeg(input);
    const outputMetadata = await sharp(output).metadata();
    expect(outputMetadata.width).toBe(100);
    expect(outputMetadata.height).toBe(50);
  });

  it('rejects bytes that are not a real image, regardless of claimed type', async () => {
    const notAnImage = Buffer.from(
      'this is definitely not an image, just text pretending to be one',
    );
    await expect(reencodePhotoAsJpeg(notAnImage)).rejects.toThrow();
  });
});
