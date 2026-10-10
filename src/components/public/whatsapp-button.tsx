import { site } from '@/lib/site'

/**
 * Floating WhatsApp chat button, bottom-right on every public page.
 *
 * A plain link to wa.me — no script, no tracking, and nothing session-specific,
 * so the public layout stays static. On mobile it sits above the fixed bottom
 * nav (`h-16` plus the safe area); from `lg` the nav is gone.
 */
export function WhatsAppButton() {
  if (!site.whatsappNumber) return null

  const text = encodeURIComponent(`Hi ${site.name}, I need help with a booking.`)

  return (
    <a
      href={`https://wa.me/${site.whatsappNumber}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed right-4 bottom-[calc(4rem+1px+env(safe-area-inset-bottom)+1rem)] z-30 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none lg:right-6 lg:bottom-6"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 fill-current">
        <path d="M16.04 3C9.4 3 4 8.38 4 15c0 2.12.56 4.19 1.62 6.01L4 29l8.2-1.6A12.04 12.04 0 0 0 16.04 27C22.66 27 28 21.62 28 15S22.66 3 16.04 3Zm0 21.8c-1.86 0-3.68-.5-5.27-1.45l-.38-.22-4.86.95.97-4.73-.25-.39A9.73 9.73 0 0 1 6.3 15c0-5.37 4.37-9.74 9.74-9.74 5.36 0 9.72 4.37 9.72 9.74 0 5.37-4.36 9.8-9.72 9.8Zm5.34-7.3c-.29-.15-1.73-.85-2-.95-.27-.1-.46-.15-.66.15-.2.29-.76.95-.93 1.14-.17.2-.34.22-.63.07-.29-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.58-.9-2.17-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44 0 1.44 1.05 2.83 1.2 3.03.15.2 2.06 3.15 5 4.42.7.3 1.24.48 1.67.62.7.22 1.34.19 1.84.11.56-.08 1.73-.71 1.97-1.39.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34Z" />
      </svg>
    </a>
  )
}
