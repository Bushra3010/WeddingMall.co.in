'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Staggered scroll reveal (PRD 7.2 loading/entrance polish).
 *
 * The base state is fully visible: the "pending" attribute is only set once
 * JavaScript is running and the user has not asked for reduced motion. So
 * content is never hidden from a crawler, a no-JS visitor, or someone with
 * prefers-reduced-motion set.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'article'
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    node.dataset.reveal = 'pending'

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const target = entry.target as HTMLElement
          target.style.animationDelay = `${delay}ms`
          target.dataset.reveal = 'shown'
          observer.unobserve(target)
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [delay])

  return (
    <Tag
      // @ts-expect-error — one ref type across the allowed tag union
      ref={ref}
      className={cn('reveal-on-scroll', className)}
    >
      {children}
    </Tag>
  )
}
