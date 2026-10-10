/**
 * Single configuration value for the working name (PRD title block), plus the
 * copy that depends on it. Rebranding touches this file only.
 */
export const site = {
  name: 'WeddingMall',
  tagline: 'Find trusted wedding professionals, compare options, and plan confidently.',
  description:
    'Discover verified wedding venues, photographers, makeup artists, caterers and more. Compare packages, shortlist favourites, and send enquiries in minutes.',
  supportEmail: 'hello@example.com',
  /**
   * WhatsApp for the floating chat button: country code + number, digits only
   * (e.g. '919876543210'). Empty hides the button.
   */
  whatsappNumber: '919472416401',
  defaultCurrency: 'INR',
  defaultLocale: 'en-IN',
  defaultTimezone: 'Asia/Kolkata',
} as const

export type Site = typeof site
