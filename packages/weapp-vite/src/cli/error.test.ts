import { describe, expect, it } from 'vitest'
import { findWatchLimitErrorCode } from './error'

describe('cli error handling', () => {
  it('extracts EMFILE from nested error tree', () => {
    const code = findWatchLimitErrorCode({
      cause: {
        errors: [
          { message: 'other error' },
          { cause: { code: 'EMFILE' } },
        ],
      },
    })

    expect(code).toBe('EMFILE')
  })

  it('extracts ENOSPC from direct code', () => {
    const code = findWatchLimitErrorCode({ code: 'ENOSPC' })

    expect(code).toBe('ENOSPC')
  })

  it('falls back to EMFILE for fs event message', () => {
    const code = findWatchLimitErrorCode({ message: 'unable to start FSEvent stream' })

    expect(code).toBe('EMFILE')
  })

  it('returns undefined for unrelated error', () => {
    const code = findWatchLimitErrorCode(new Error('boom'))

    expect(code).toBeUndefined()
  })
})

