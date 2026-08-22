import { type ReactNode } from 'react'

export interface WizardStep {
  slug: string
  label: string
  description: string
}

export function WizardStepper({
  steps,
  currentStep,
}: {
  steps: WizardStep[]
  currentStep: string
}) {
  const currentIndex = steps.findIndex((s) => s.slug === currentStep)

  return (
    <nav aria-label="Listing setup steps" className="hidden sm:block">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isActive = step.slug === currentStep
          const isComplete = index < currentIndex

          return (
            <li key={step.slug} className="flex items-center">
              <a
                href={`/vendor-dashboard/list/${step.slug}`}
                className={[
                  'flex flex-col items-center gap-1 px-3 py-1 transition-colors',
                  isActive
                    ? 'text-brand-700'
                    : isComplete
                      ? 'text-sand-600 hover:text-sand-900'
                      : 'text-sand-400',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                    isActive
                      ? 'bg-brand-600 text-white'
                      : isComplete
                        ? 'bg-[var(--color-success)] text-white'
                        : 'bg-sand-200 text-sand-400',
                  ].join(' ')}
                >
                  {isComplete ? (
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="text-xs font-medium">{step.label}</span>
                <span className="text-sand-500 text-[10px]">{step.description}</span>
              </a>
              {index < steps.length - 1 ? (
                <span
                  className={[
                    'mx-1 h-0.5 w-8 rounded-full',
                    isComplete ? 'bg-[var(--color-success)]' : 'bg-sand-200',
                  ].join(' ')}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function WizardSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5 sm:p-6">
      <h2 className="font-display text-sand-900 text-lg">{title}</h2>
      <p className="text-sand-600 mt-1 text-sm">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  )
}
