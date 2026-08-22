'use client'

import { useState } from 'react'

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="border-sand-300 rounded-lg border bg-white px-3 py-2 text-xs font-medium hover:bg-sand-50"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
