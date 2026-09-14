import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { VendorGallery, type GalleryImage } from '@/components/public/vendor-gallery'

// Explicit, because `globals` is off in vitest.config.ts — see decision-form.test.tsx.
afterEach(cleanup)

/**
 * The gallery replaced a static cover image plus a grid capped at eight photos.
 *
 * The assertions that matter are the two the design is easy to get wrong: every
 * photograph must still be reachable (the grid's cap was the reported problem),
 * and the large frame must NOT mount all of them at once — a thirty-image venue
 * would otherwise fetch thirty full-size photographs on first paint, because
 * opacity-hidden images are still "visible" to the lazy-loading observer.
 */
function makeImages(count: number): GalleryImage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    src: `https://cdn.test/photo-${index}.jpg`,
    alt: `Venue — photo ${index + 1}`,
    caption: index === 0 ? 'Venue overview' : null,
  }))
}

describe('the vendor gallery', () => {
  it('reaches every photograph from the thumbnail strip', () => {
    render(<VendorGallery images={makeImages(31)} />)

    const thumbnails = screen.getAllByRole('button', { name: /^Show photo \d+ of 31$/ })
    expect(thumbnails).toHaveLength(31)
  })

  it('mounts only the current slide and its two neighbours', () => {
    render(<VendorGallery images={makeImages(31)} />)

    // Thumbnails carry alt="" and are presentational, so this counts the frame.
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('counts and advances', () => {
    render(<VendorGallery images={makeImages(4)} />)

    expect(screen.getByText('1 / 4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByText('2 / 4')).toBeInTheDocument()

    // And wraps backwards off the first slide rather than dead-ending.
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(screen.getByText('4 / 4')).toBeInTheDocument()
  })

  it('shows the caption only for a photo that has one', () => {
    render(<VendorGallery images={makeImages(4)} />)

    expect(screen.getByText('Venue overview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.queryByText('Venue overview')).not.toBeInTheDocument()
  })

  it('opens every image in a dialog and jumps to the one picked', () => {
    render(<VendorGallery images={makeImages(31)} />)

    fireEvent.click(screen.getByRole('button', { name: /View all images/ }))

    const dialog = screen.getByRole('dialog', { name: 'All 31 photos' })
    expect(within(dialog).getAllByRole('img')).toHaveLength(31)

    fireEvent.click(within(dialog).getByRole('img', { name: 'Venue — photo 9' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('9 / 31')).toBeInTheDocument()
  })

  it('drops the carousel chrome when there is a single photo', () => {
    render(<VendorGallery images={makeImages(1)} />)

    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /View all images/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('renders nothing when the vendor has no approved photos', () => {
    const { container } = render(<VendorGallery images={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
