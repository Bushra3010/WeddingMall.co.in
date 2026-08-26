'use client'

import { Check, Lock } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { STEPS, STEP_INDEX, type StepKey } from '@/components/vendor/wizard-config'
import { cn } from '@/lib/utils'

/**
 * The step journey, in two genuinely different shapes.
 *
 * Desktop gets a vertical rail beside the form. Mobile gets a horizontal
 * scrolling row of circles — not the vertical rail shrunk, which would eat half
 * a phone screen before the first field. Same state, same semantics, laid out
 * for the space available.
 *
 * Marked up as a `<ol>` of buttons: a locked step is a disabled button rather
 * than a missing one, so screen readers announce that the step exists and is
 * not yet available instead of it simply vanishing.
 */

type StepState = 'complete' | 'active' | 'upcoming' | 'locked'

function stateOf(
  step: StepKey,
  current: StepKey,
  isComplete: (s: StepKey) => boolean,
  isUnlocked: (s: StepKey) => boolean,
): StepState {
  if (step === current) return 'active'
  if (isComplete(step)) return 'complete'
  return isUnlocked(step) ? 'upcoming' : 'locked'
}

function StepIcon({ step, state }: { step: (typeof STEPS)[number]; state: StepState }) {
  const Icon = step.icon
  if (state === 'complete') return <Check aria-hidden="true" className="size-4" strokeWidth={3} />
  if (state === 'locked') return <Lock aria-hidden="true" className="size-3.5" />
  return <Icon aria-hidden="true" className="size-4" />
}

/** Wording appended to the accessible name so the state is spoken, not just seen. */
const STATE_LABEL: Record<StepState, string> = {
  complete: 'completed',
  active: 'current step',
  upcoming: 'not started',
  locked: 'locked — finish the earlier steps first',
}

export function WizardStepper({
  current,
  onSelect,
  isComplete,
  isUnlocked,
}: {
  current: StepKey
  onSelect: (step: StepKey) => void
  isComplete: (step: StepKey) => boolean
  isUnlocked: (step: StepKey) => boolean
}) {
  const railRef = useRef<HTMLOListElement>(null)
  const activePillRef = useRef<HTMLLIElement>(null)

  /*
   * Keep the current step in view on the mobile rail.
   *
   * Seven pills are far wider than a phone, so arriving at step 5 put the step
   * you are actually on half off the right edge — the rail showed four ticks
   * and a sliver of the thing you came to do. Scrolling is horizontal only and
   * measured from rects rather than `offsetLeft`, because `contain: paint`
   * makes the rail a containing block and moves what `offsetParent` reports.
   */
  useEffect(() => {
    const rail = railRef.current
    const pill = activePillRef.current
    if (!rail || !pill) return

    const offset =
      pill.getBoundingClientRect().left -
      rail.getBoundingClientRect().left -
      (rail.clientWidth - pill.offsetWidth) / 2

    rail.scrollTo({
      left: Math.max(0, rail.scrollLeft + offset),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [current])

  return (
    <nav aria-label="Listing steps">
      {/* ---------------- Desktop: vertical rail ---------------- */}
      <ol className="hidden lg:block">
        {STEPS.map((step, index) => {
          const state = stateOf(step.id, current, isComplete, isUnlocked)
          const last = index === STEPS.length - 1
          return (
            <li key={step.id} className="relative">
              {/* Connector, drawn behind the circle and stopping at the last step. */}
              {!last ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-9 left-[1.125rem] h-[calc(100%-1.5rem)] w-px',
                    isComplete(step.id) ? 'bg-brand-300' : 'bg-sand-200',
                  )}
                />
              ) : null}

              <button
                type="button"
                onClick={() => onSelect(step.id)}
                disabled={state === 'locked'}
                aria-current={state === 'active' ? 'step' : undefined}
                aria-label={`Step ${index + 1} of ${STEPS.length}: ${step.label} — ${STATE_LABEL[state]}`}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors',
                  state === 'active' && 'bg-brand-50',
                  state !== 'active' && state !== 'locked' && 'hover:bg-sand-50',
                  state === 'locked' && 'cursor-not-allowed',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                    state === 'active' && 'border-brand-600 bg-brand-600 text-white',
                    state === 'complete' && 'border-brand-200 bg-brand-50 text-brand-700',
                    state === 'upcoming' && 'border-sand-200 text-sand-500 bg-white',
                    state === 'locked' && 'border-sand-200 bg-sand-50 text-sand-400',
                  )}
                >
                  <StepIcon step={step} state={state} />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-sm',
                      state === 'active' && 'text-brand-800 font-semibold',
                      state === 'complete' && 'text-sand-800 font-medium',
                      state === 'upcoming' && 'text-sand-700',
                      state === 'locked' && 'text-sand-400',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-sand-500 block text-xs">
                    {state === 'complete' ? 'Completed' : `Step ${index + 1}`}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* ---------------- Mobile / tablet: horizontal rail ---------------- */}
      <ol
        ref={railRef}
        className={cn(
          'flex gap-2 overflow-x-auto px-0.5 py-1 lg:hidden',
          /*
           * `contain: paint` is load-bearing, not a micro-optimisation.
           *
           * Chrome sizes the mobile layout viewport from the scrollable content
           * of descendants, so seven pills totalling 448px widened the whole
           * dashboard's viewport to 461px at a 390px device width — every page
           * rendered zoomed out to fit a rail that was already scrolling
           * happily inside itself. Paint containment stops that measurement
           * escaping. `overflow-x-auto` alone does not; this was measured.
           *
           * The padding keeps focus rings off the clipped edges: `overflow-x`
           * forces `overflow-y` to compute to `auto`, so the box was clipping
           * vertically too and rings on the pills had nowhere to draw.
           */
          '[contain:paint]',
          // The scrollbar is noise on seven items; the clipped edge already
          // signals there is more.
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {STEPS.map((step, index) => {
          const state = stateOf(step.id, current, isComplete, isUnlocked)
          return (
            <li
              key={step.id}
              ref={state === 'active' ? activePillRef : undefined}
              className="shrink-0"
            >
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                disabled={state === 'locked'}
                aria-current={state === 'active' ? 'step' : undefined}
                aria-label={`Step ${index + 1} of ${STEPS.length}: ${step.label} — ${STATE_LABEL[state]}`}
                className={cn(
                  // 44px minimum touch target, per the accessibility brief.
                  'flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 transition-colors',
                  state === 'active' && 'border-brand-600 bg-brand-50 text-brand-800',
                  state === 'complete' && 'border-brand-200 text-sand-800 bg-white',
                  state === 'upcoming' && 'border-sand-200 text-sand-600 bg-white',
                  state === 'locked' && 'border-sand-200 bg-sand-50 text-sand-400',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full',
                    state === 'active' && 'bg-brand-600 text-white',
                    state === 'complete' && 'bg-brand-50 text-brand-700',
                    state === 'upcoming' && 'bg-sand-100 text-sand-500',
                    state === 'locked' && 'bg-sand-100 text-sand-400',
                  )}
                >
                  {state === 'complete' ? (
                    <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                  ) : state === 'locked' ? (
                    <Lock aria-hidden="true" className="size-3" />
                  ) : (
                    <span className="text-[11px] font-semibold tabular-nums">{index + 1}</span>
                  )}
                </span>
                {/* Only the current step keeps its label, so seven of them do
                    not turn the rail into a wall of text on a phone. */}
                <span
                  className={cn(
                    'text-sm whitespace-nowrap',
                    state === 'active' ? 'font-semibold' : 'sr-only',
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** `Step 3 of 7` plus the bar, shared by both layouts. */
/**
 * Position on the left, actual progress on the right.
 *
 * The bar counts completed steps rather than how far along the rail you have
 * clicked. Measuring position made the review screen read "Step 7 of 7 — 100%"
 * directly above a list saying Media and Documents were not finished yet, which
 * is worse than no percentage at all. "Step 7 of 7" already says where you are;
 * the bar is only worth its space if it says something else.
 */
export function WizardProgress({
  current,
  isComplete,
}: {
  current: StepKey
  isComplete: (step: StepKey) => boolean
}) {
  const index = STEP_INDEX[current]
  const done = STEPS.filter((step) => isComplete(step.id)).length
  const pct = Math.round((done / STEPS.length) * 100)

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sand-600 text-xs font-medium tracking-wide uppercase">
          Step {index + 1} of {STEPS.length}
        </p>
        <span className="text-sand-500 text-xs tabular-nums">{pct}%</span>
      </div>
      <div
        className="bg-sand-200 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-valuetext={`${done} of ${STEPS.length} steps complete`}
        aria-label="Listing progress"
      >
        <div
          className="bg-brand-600 h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
