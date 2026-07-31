import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * For a link that looks like a button, apply `buttonVariants(...)` to `<Link>`
 * rather than reaching for a Slot polyfill — it avoids a dependency and keeps
 * the anchor semantics that assistive technology expects (PRD 7.3).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-700 text-white hover:bg-brand-800',
        secondary: 'bg-sand-100 text-sand-900 hover:bg-sand-200',
        outline: 'border border-sand-300 bg-white text-sand-900 hover:bg-sand-50',
        ghost: 'text-sand-700 hover:bg-sand-100',
        danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type Props = ComponentProps<'button'> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: Props) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
