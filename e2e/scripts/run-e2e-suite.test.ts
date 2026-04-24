import { describe, expect, it } from 'vitest'
import { shouldCleanupIdeBeforeEachTask } from './run-e2e-suite'

describe('run-e2e-suite ide cleanup hooks', () => {
  it('enables cleanup hooks for devtools-backed ide suites', () => {
    expect(shouldCleanupIdeBeforeEachTask('ide')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('ide-smoke')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('ide-gate')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('ide-full')).toBe(true)
    expect(shouldCleanupIdeBeforeEachTask('ide-full:templates')).toBe(true)
  })

  it('skips cleanup hooks for non-devtools or headless suites', () => {
    expect(shouldCleanupIdeBeforeEachTask('ci')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('full')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('full-regression')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('ide-headless-smoke')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('ide-headless-gate')).toBe(false)
    expect(shouldCleanupIdeBeforeEachTask('ide-headless-full')).toBe(false)
  })
})
