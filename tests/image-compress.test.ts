import { describe, expect, it } from 'vitest'

import {
  fitWithin,
  formatBytes,
  isDecodable,
  isHeic,
  MAX_EDGE_PX,
  renameToJpeg,
  shouldCompress,
  SKIP_BELOW_BYTES,
} from '@/lib/images/compress'

/**
 * The pure half of browser-side photo preparation.
 *
 * `compressImage` itself needs a canvas and `createImageBitmap`, so it is
 * exercised in a real browser rather than here. Everything it *decides* with is
 * pulled out and tested directly: the sizing rule, what is worth re-encoding,
 * and what a vendor is told.
 *
 * This is the code path behind the reported bug — two ordinary phone photos
 * refused with "Those 2 photos come to 13.4 MB". The fix is to stop sending
 * originals, so the arithmetic below is what makes that true.
 */

function file(name: string, size: number, type: string): File {
  // `new File([...], …)` with real bytes would allocate megabytes per case, so
  // the size is stubbed. Nothing here reads the contents.
  const stub = new File([], name, { type })
  Object.defineProperty(stub, 'size', { value: size })
  return stub
}

describe('fitWithin', () => {
  it('leaves an image already inside the box untouched', () => {
    // Upscaling adds bytes and no detail.
    expect(fitWithin(1200, 800, MAX_EDGE_PX)).toEqual({ width: 1200, height: 800 })
  })

  it('scales the longest edge down to the limit, in either orientation', () => {
    expect(fitWithin(4800, 2400, 2400)).toEqual({ width: 2400, height: 1200 })
    expect(fitWithin(2400, 4800, 2400)).toEqual({ width: 1200, height: 2400 })
  })

  it('rounds rather than floors, so the aspect ratio survives', () => {
    /*
     * A 4032×3024 phone photo scales by 0.5952…. Flooring gives 2400×1799,
     * which is a different shape than the original by half a pixel and shows up
     * as a one-pixel crop along an edge.
     */
    expect(fitWithin(4032, 3024, 2400)).toEqual({ width: 2400, height: 1800 })
  })

  it('never produces a zero dimension', () => {
    // A panorama is extreme enough that the short edge rounds toward nothing,
    // and a canvas of width 0 throws.
    const { width, height } = fitWithin(20000, 200, 2400)
    expect(width).toBe(2400)
    expect(height).toBeGreaterThanOrEqual(1)
  })

  it('handles a degenerate size instead of dividing by zero', () => {
    expect(fitWithin(0, 0, 2400)).toEqual({ width: 0, height: 0 })
  })
})

describe('isHeic', () => {
  it('catches HEIC by MIME type', () => {
    expect(isHeic(file('IMG_0001.heic', 4_000_000, 'image/heic'))).toBe(true)
    expect(isHeic(file('IMG_0001.heif', 4_000_000, 'image/heif'))).toBe(true)
  })

  it('catches HEIC by extension when iOS reports no type at all', () => {
    // A HEIC pulled from the iOS photo library often arrives with an empty
    // `type`, and the extension is the only signal left. Without this the file
    // reaches `createImageBitmap`, which throws in Chrome and Firefox, and the
    // vendor is told their photo "could not be read" instead of being told to
    // switch the camera format.
    expect(isHeic(file('IMG_0001.HEIC', 4_000_000, ''))).toBe(true)
  })

  it('does not mistake a JPEG for one', () => {
    expect(isHeic(file('beach.jpg', 4_000_000, 'image/jpeg'))).toBe(false)
    // The substring appears in the name but is not the extension.
    expect(isHeic(file('heicopter-shot.jpg', 4_000_000, 'image/jpeg'))).toBe(false)
  })
})

describe('isDecodable', () => {
  it('accepts the four formats every browser can draw', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) {
      expect(isDecodable(file('x', 1, type)), type).toBe(true)
    }
  })

  it('rejects HEIC and anything that is not an image', () => {
    expect(isDecodable(file('x.heic', 1, 'image/heic'))).toBe(false)
    expect(isDecodable(file('x.pdf', 1, 'application/pdf'))).toBe(false)
  })
})

describe('shouldCompress', () => {
  it('skips a photo already small enough to send', () => {
    /*
     * Recompressing an already-small JPEG costs quality and saves nothing, and
     * running it through a canvas discards whatever colour profile it carried.
     */
    expect(shouldCompress(file('small.jpg', SKIP_BELOW_BYTES - 1, 'image/jpeg'))).toBe(false)
  })

  it('compresses an ordinary phone photo', () => {
    // The 6.7 MB case from the bug report.
    expect(shouldCompress(file('IMG_4821.jpg', 6_700_000, 'image/jpeg'))).toBe(true)
  })

  it('does not try to compress what it cannot decode', () => {
    expect(shouldCompress(file('IMG_0001.heic', 6_700_000, 'image/heic'))).toBe(false)
  })
})

describe('renameToJpeg', () => {
  it('re-extensions a file whose bytes are now JPEG', () => {
    expect(renameToJpeg('beach-ceremony.png')).toBe('beach-ceremony.jpg')
    expect(renameToJpeg('shot.jpeg')).toBe('shot.jpg')
  })

  it('keeps dots that are part of the name', () => {
    expect(renameToJpeg('mr.and.mrs.png')).toBe('mr.and.mrs.jpg')
  })

  it('handles a name with no extension, and one that is only an extension', () => {
    expect(renameToJpeg('photo')).toBe('photo.jpg')
    // `.gitignore`-shaped input would otherwise strip to an empty name.
    expect(renameToJpeg('.png')).toBe('photo.jpg')
  })
})

describe('formatBytes', () => {
  it('reads the way a person would say it', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(6_700_000)).toBe('6.4 MB')
  })

  it('reports the reported number', () => {
    // "Those 2 photos come to 13.4 MB" — the message the vendor saw.
    expect(formatBytes(14_050_000)).toBe('13.4 MB')
  })
})
