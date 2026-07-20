import sharp from 'sharp';

// docs/05_SECURITY_PRIVACY.md "Uploads": "Remover EXIF no processamento" +
// "Allowlist de MIME e verificação por assinatura quando possível". Re-encoding through
// sharp does both at once: sharp.jpeg() never carries metadata forward unless
// .withMetadata() is called (EXIF, including GPS, is dropped by omission — not scrubbed
// after the fact), and sharp only produces output for bytes it can actually decode as an
// image, which is a real signature check a client.type MIME claim alone is not. .rotate()
// bakes in the EXIF orientation *before* that metadata is dropped, so a photo taken
// sideways doesn't end up looking sideways once the tag that would have fixed it is gone.
//
// Resizing is a size/cost control, not a security requirement: phone cameras routinely
// produce 4000px+ originals no dashboard view ever needs at full resolution.
const MAX_DIMENSION_PX = 2000;
const JPEG_QUALITY = 85;

export async function reencodePhotoAsJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({
      width: MAX_DIMENSION_PX,
      height: MAX_DIMENSION_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}
