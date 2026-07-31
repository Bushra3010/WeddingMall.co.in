'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { openDocumentAction } from '@/features/vendors/document-actions'

/**
 * Opens a private verification document through a short-lived signed URL
 * (PRD 10.1). The URL is minted on demand rather than embedded in the page, so
 * it cannot be scraped from the HTML or shared after it expires.
 */
export function DocumentLink({ documentId }: { documentId: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setPending(true)
    setError(null)
    const result = await openDocumentAction(documentId)
    setPending(false)

    if (!result.ok) {
      setError(result.message)
      return
    }
    window.open(result.data.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <span className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </span>
      ) : null}
      <Button variant="outline" size="sm" onClick={open} disabled={pending} aria-busy={pending}>
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <ExternalLink aria-hidden="true" />
        )}
        Open
      </Button>
    </span>
  )
}
