import Link from 'next/link'
import type { ReactNode } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The required component states from PRD 7.2. Every data-bound view should
 * reach for one of these rather than inventing its own empty/error markup.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-sand-200 animate-pulse rounded-lg', className)} aria-hidden="true" />
  )
}

export function CardSkeleton() {
  return (
    <div className="border-sand-200 space-y-3 rounded-[var(--radius-card)] border bg-white p-4">
      <Skeleton className="aspect-4/3 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
  action?: { label: string; href: string }
  icon?: ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="border-sand-300 flex flex-col items-center rounded-[var(--radius-card)] border border-dashed bg-white px-6 py-12 text-center">
      {icon ? <div className="text-sand-400 mb-3">{icon}</div> : null}
      <h3 className="font-display text-sand-900 text-lg">{title}</h3>
      {description ? <p className="text-sand-600 mt-1 max-w-prose text-sm">{description}</p> : null}
      {action ? (
        <Link href={action.href} className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}>
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this just now. Please try again.',
  requestId,
  onRetry,
}: {
  title?: string
  description?: string
  requestId?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="border-sand-300 rounded-[var(--radius-card)] border bg-white p-6 text-center"
    >
      <h3 className="font-display text-sand-900 text-lg">{title}</h3>
      <p className="text-sand-600 mt-1 text-sm">{description}</p>
      {onRetry ? (
        <button onClick={onRetry} className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}>
          Try again
        </button>
      ) : null}
      {requestId ? <p className="text-sand-400 mt-3 text-xs">Reference: {requestId}</p> : null}
    </div>
  )
}

export function PermissionDenied({ message }: { message?: string }) {
  return (
    <EmptyState
      title="You do not have access to this"
      description={
        message ?? 'Ask an administrator or the business owner to grant you the right role.'
      }
      action={{ label: 'Back to home', href: '/' }}
    />
  )
}
