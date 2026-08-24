import { redirect } from 'next/navigation'

import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({ title: 'Complete your listing', noindex: true })
export const dynamic = 'force-dynamic'

export default async function ListingWizardStepPage() {
  // Old step-based URLs redirect to the single-page listing
  redirect('/vendor-dashboard/list')
}
