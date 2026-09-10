/**
 * Browser-side photo preparation, before anything is sent to a Server Action.
 *
 * ## Why this exists
 *
 * Every upload in this application goes through a Server Action, and Next sends
 * a Server Action's whole form as **one** request body. `next.config.ts` caps
 * that at 12 MB. Two photographs off a modern phone are routinely 13-14 MB
 * together, so the Media step refused the most ordinary thing a vendor does:
 * pick their two best pictures. The message named the cap, which is accurate and
 * useless — the vendor's photos are the size they are.
 *
 * Raising the cap only moves the wall. A 48-megapixel camera produces 12 MB
 * files on its own, and the bytes have to cross a phone connection either way.
 * So the fix is to stop sending originals: a portfolio photograph is displayed
 * at most a couple of thousand pixels wide, and everything above that is weight
 * with no visible return.
 *
 * Downscaling to {@link MAX_EDGE_PX} and re-encoding takes a typical 6.7 MB
 * phone photo to roughly 400-800 KB — under the per-file limit, under the body
 * cap, and faster to upload on the mobile connections most vendors are on. The
 * uploader then sends **one file per request**, so the batch size stops
 * mattering at all.
 *
 * ## What is deliberately not done here
 *
 * No validation. The server still checks MIME and size in `uploadMedia()`, and
 * the storage bucket enforces its own limit behind that. This is a convenience
 * that runs in a context the user controls; it is not a security boundary and
 * must never be treated as one.
 */

/** The longest edge a stored portfolio photo needs. */
export const MAX_EDGE_PX = 2400

/**
 * What a prepared photo should weigh.
 *
 * Not a hard limit — a genuinely detailed 2400px image can land above it and is
 * still fine to keep. It is the point at which {@link compressImage} stops
 * spending quality to save bytes.
 */
export const TARGET_BYTES = 1_200_000

/**
 * Below this, re-encoding is not worth it.
 *
 * Recompressing an already-small JPEG costs quality and saves nothing, and
 * running a picture through a canvas discards any colour profile it carried.
 */
export const SKIP_BELOW_BYTES = 600 * 1024

/** Quality steps tried in order until the result fits {@link TARGET_BYTES}. */
const QUALITY_LADDER = [0.82, 0.72, 0.62, 0.5] as const

/**
 * Formats a browser can reliably decode into a canvas.
 *
 * HEIC/HEIF is excluded on purpose. Safari decodes it; Chrome and Firefox do
 * not, so `createImageBitmap` throws there. That failure is worth naming —
 * "your iPhone is set to HEIC" is actionable, "we could not read that image" is
 * not.
 */
const DECODABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return true
  // iOS sometimes hands over an empty `type` for a HEIC pulled from the photo
  // library, so the extension is the only signal left.
  return /\.hei[cf]$/i.test(file.name)
}

export function isDecodable(file: File): boolean {
  return DECODABLE_TYPES.includes(file.type.toLowerCase())
}

/**
 * The size an image should be drawn at, preserving aspect ratio.
 *
 * Pure, and exported so the sizing rule can be tested without a DOM. An image
 * already inside the box is returned untouched — upscaling a small photo would
 * add bytes and no detail.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge || longest === 0) return { width, height }

  const scale = maxEdge / longest
  return {
    // `round` rather than `floor`: flooring a 4032×3024 photo at scale
    // 0.5952… gives 2400×1799, which is a different aspect ratio than the
    // original by half a pixel and shows up as a one-pixel crop.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** Whether {@link compressImage} would do anything for this file. */
export function shouldCompress(file: File): boolean {
  return isDecodable(file) && file.size > SKIP_BELOW_BYTES
}

export class ImagePrepareError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImagePrepareError'
  }
}

/**
 * Downscale and re-encode a photograph in the browser.
 *
 * Returns the **original file untouched** when it is already small, or when the
 * re-encode came out larger than the input — which happens with flat graphics
 * and screenshots, where PNG beats JPEG. Never returns something worse than what
 * it was given.
 *
 * Throws {@link ImagePrepareError} with a message written for the vendor when
 * the browser cannot decode the file at all.
 */
export async function compressImage(file: File, maxEdge = MAX_EDGE_PX): Promise<File> {
  if (isHeic(file)) {
    throw new ImagePrepareError(
      `${file.name} is a HEIC photo, which most browsers cannot read. On iPhone: Settings › Camera › Formats › Most Compatible, or share the photo to convert it to JPEG first.`,
    )
  }
  if (!shouldCompress(file)) return file

  let bitmap: ImageBitmap
  try {
    // `from-image` applies the EXIF orientation tag. Without it a photo taken in
    // portrait is drawn on its side — the tag lives in metadata a canvas throws
    // away, so the rotation has to happen during decode or not at all.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImagePrepareError(
      `${file.name} could not be read as an image. Try saving it as a JPEG and uploading again.`,
    )
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return file

    // A JPEG has no alpha channel, so a transparent PNG would otherwise
    // composite onto black. White is what the site's own background is.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    for (const quality of QUALITY_LADDER) {
      const blob = await toBlob(canvas, 'image/jpeg', quality)
      if (!blob) return file

      if (blob.size <= TARGET_BYTES || quality === QUALITY_LADDER[QUALITY_LADDER.length - 1]) {
        // Re-encoding made it bigger — keep the original rather than storing a
        // worse copy of the same picture at a larger size.
        if (blob.size >= file.size) return file
        return new File([blob], renameToJpeg(file.name), {
          type: 'image/jpeg',
          lastModified: file.lastModified,
        })
      }
    }

    return file
  } finally {
    bitmap.close()
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** `beach-ceremony.png` → `beach-ceremony.jpg`. The bytes are JPEG now. */
export function renameToJpeg(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'photo'
  return `${base}.jpg`
}

/** `1.4 MB` — for messages a vendor reads. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
