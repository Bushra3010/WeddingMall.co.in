import { z } from 'zod'

import { PermissionError } from '@/lib/permissions'
import { logError, requestId as newRequestId } from '@/lib/observability/logger'

/** Standard server action envelope (PRD 15). */
export type ActionResult<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false
      code: string
      message: string
      fieldErrors?: Record<string, string[]>
      requestId: string
    }

export function success<T>(data: T, requestId = newRequestId()): ActionResult<T> {
  return { ok: true, data, requestId }
}

export function failure(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
  requestId = newRequestId(),
): ActionResult<never> {
  return { ok: false, code, message, fieldErrors, requestId }
}

/** Raised by services for expected, user-presentable failures. */
export class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

/**
 * Wraps a server action body. Guarantees that raw database or provider errors
 * never reach the user (PRD 15) while preserving the correlation id in logs.
 */
export async function runAction<T>(
  name: string,
  body: (requestId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  const requestId = newRequestId()
  try {
    return success(await body(requestId), requestId)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const flattened = z.flattenError(error)
      return failure(
        'validation_error',
        'Please check the highlighted fields.',
        flattened.fieldErrors as Record<string, string[]>,
        requestId,
      )
    }
    if (error instanceof PermissionError) {
      return failure(error.code, error.message, undefined, requestId)
    }
    if (error instanceof ServiceError) {
      return failure(error.code, error.message, error.fieldErrors, requestId)
    }
    logError(name, error, { requestId })
    return failure(
      'internal_error',
      'Something went wrong on our side. Please try again.',
      undefined,
      requestId,
    )
  }
}
