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
    <nav aria-label="Listing setup steps" className="mb-8">
      {/* Mobile: horizontal scrollable dots + labels */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 sm:hidden">
        {steps.map((step, index) => {
          const isActive = step.slug === currentStep
          const isComplete = index < currentIndex

          return (
            <div key={step.slug} className="flex shrink-0 flex-col items-center gap-1">
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
              <span
                className={[
                  'text-[10px] font-medium',
                  isActive ? 'text-brand-700' : isComplete ? 'text-sand-600' : 'text-sand-400',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Desktop: full horizontal stepper */}
      <ol className="hidden items-center sm:flex">
        {steps.map((step, index) => {
          const isActive = step.slug === currentStep
          const isComplete = index < currentIndex

          return (
            <li key={step.slug} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
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
                <span
                  className={[
                    'text-xs font-medium',
                    isActive ? 'text-brand-700' : isComplete ? 'text-sand-600' : 'text-sand-400',
                  ].join(' ')}
                >
                  {step.label}
                </span>
                <span className="text-sand-500 text-[10px]">{step.description}</span>
              </div>
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

      {/* Progress bar */}
      <div className="mt-4 h-1 w-full rounded-full bg-sand-200">
        <div
          className="bg-brand-600 h-1 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex) / (steps.length - 1)) * 100}%` }}
        />
      </div>
      <p className="text-sand-500 mt-1.5 text-right text-xs">
        Step {currentIndex + 1} of {steps.length}
      </p>
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
