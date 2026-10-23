import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The polling fallback must not re-render the server page on a timer: that
 * is what exhausted the Vercel Hobby CPU budget. It may only ask Supabase for
 * the newest message id, and refresh when that id changes.
 */
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const latest = vi.fn<() => Promise<{ data: { id: string } | null; error: null }>>()
const query = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: () => latest(),
}
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => query,
    auth: { getSession: async () => ({ data: { session: null } }) },
    realtime: { setAuth: async () => undefined },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  }),
}))

import { useLiveMessages } from '@/components/customer/use-live-messages'

const flush = async () => {
  await vi.advanceTimersByTimeAsync(20_000)
}

let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  vi.useFakeTimers()
  refresh.mockClear()
  latest.mockReset()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  // Unmount, or earlier hooks keep their visibilitychange listeners on the
  // shared document and answer the next test's events.
  cleanup()
  vi.useRealTimers()
})

describe('useLiveMessages polling fallback', () => {
  it('never refreshes while the newest message is unchanged', async () => {
    latest.mockResolvedValue({ data: { id: 'm1' }, error: null })
    renderHook(() => useLiveMessages('conv-1', false))

    await flush()
    await flush()
    await flush()

    expect(latest).toHaveBeenCalledTimes(4)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes once when a new message appears', async () => {
    latest.mockResolvedValueOnce({ data: { id: 'm1' }, error: null })
    latest.mockResolvedValue({ data: { id: 'm2' }, error: null })
    renderHook(() => useLiveMessages('conv-1', false))

    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)

    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh for the first sample of an empty thread', async () => {
    latest.mockResolvedValue({ data: null, error: null })
    renderHook(() => useLiveMessages('conv-1', false))

    await flush()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('stops polling while the tab is hidden and checks on return', async () => {
    latest.mockResolvedValue({ data: { id: 'm1' }, error: null })
    renderHook(() => useLiveMessages('conv-1', false))
    await flush()
    const before = latest.mock.calls.length

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    await flush()
    expect(latest).toHaveBeenCalledTimes(before)

    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(latest).toHaveBeenCalledTimes(before + 1)
  })

  it('does nothing without a conversation', async () => {
    renderHook(() => useLiveMessages(null, false))
    await flush()
    expect(latest).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
