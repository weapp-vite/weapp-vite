import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { createSuiteSignalScope } from './signals'

describe('suite signal inheritance', () => {
  it('keeps one OS handler and preserves the first cancellation across late children', () => {
    const before = { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM') }
    const owner = createSuiteSignalScope()
    const child = createSuiteSignalScope(owner.signal)
    let lateChild: ReturnType<typeof createSuiteSignalScope> | undefined
    try {
      const interrupt = process.listeners('SIGINT').filter(handler => !before.SIGINT.includes(handler))
      const terminate = process.listeners('SIGTERM').filter(handler => !before.SIGTERM.includes(handler))
      expect(interrupt).toHaveLength(1)
      expect(terminate).toHaveLength(1)
      ;(interrupt[0] as () => void)()
      ;(terminate[0] as () => void)()
      lateChild = createSuiteSignalScope(owner.signal)
      for (const scope of [owner, child, lateChild]) {
        expect(scope.signal.aborted).toBe(true)
        expect(scope.signal.reason).toBe(owner.signal.reason)
        expect(scope.exitCode).toBe(130)
      }
    }
    finally {
      lateChild?.dispose()
      child.dispose()
      owner.dispose()
    }
    expect(process.listeners('SIGINT')).toEqual(before.SIGINT)
    expect(process.listeners('SIGTERM')).toEqual(before.SIGTERM)
  })

  it('removes inherited listeners on dispose without removing the parent scope', () => {
    const owner = createSuiteSignalScope()
    const child = createSuiteSignalScope(owner.signal)
    try {
      child.dispose()
      owner.cancel(new Error('inhibitor failed'))
      expect(owner.signal.aborted).toBe(true)
      expect(child.signal.aborted).toBe(false)
    }
    finally {
      child.dispose()
      owner.dispose()
    }
  })
})
