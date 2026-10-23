import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { describeUploadProcessTreeError, observeWindowsProcessTreeQuery } from './processTreeDiagnostics'

const clock = vi.hoisted(() => ({ monotonic: 100 }))
vi.mock('node:perf_hooks', () => ({ performance: { now: () => clock.monotonic } }))

const UTC_START = 1700000000000
const PREFIX = '[weapp-vite:upload-process-tree:v1]'
const PRIVATE_TEXT = 'private-command-and-stderr-must-not-be-logged'

function marker(stage: string, elapsedMs: number, utcOffset: number): string {
  return `${PREFIX} ${stage} ${elapsedMs} ${UTC_START + utcOffset}`
}

function observeFailure(error: object, elapsedMs = 30000, wallElapsedMs = elapsedMs): { description: string, diagnostic: Record<string, unknown> } {
  vi.mocked(Date.now).mockReturnValue(UTC_START)
  let caught: unknown
  try {
    observeWindowsProcessTreeQuery(() => {
      clock.monotonic += elapsedMs
      vi.mocked(Date.now).mockReturnValue(UTC_START + wallElapsedMs)
      throw error
    })
  }
  catch (actual) {
    caught = actual
  }
  expect(caught).toBe(error)
  const description = describeUploadProcessTreeError(error)
  expect(description).not.toContain(PRIVATE_TEXT)
  return {
    description,
    diagnostic: JSON.parse(description.slice(description.indexOf('{'))) as Record<string, unknown>,
  }
}

function timeout(stderr?: unknown): Error & { code: string, stderr: unknown } {
  return Object.assign(new Error(PRIVATE_TEXT), { code: 'ETIMEDOUT', stderr })
}

beforeEach(() => {
  clock.monotonic = 100
  vi.spyOn(Date, 'now').mockReturnValue(UTC_START)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Windows upload process query diagnostics', () => {
  it('keeps an unobserved timeout unknown and preserves the original error', () => {
    const error = timeout(PRIVATE_TEXT)
    const { diagnostic } = observeFailure(error)
    expect(diagnostic).toEqual({ elapsedMs: 30000, stage: 'before-script-entry-or-unobserved', code: 'ETIMEDOUT' })
    expect(error.code).toBe('ETIMEDOUT')
    expect(error.message).toBe(PRIVATE_TEXT)
  })

  it('separates time before script entry from an active child CIM query', () => {
    const stderr = [marker('script-enter', 0, 29000), marker('children-query-start', 5, 29005)].join('\n')
    expect(observeFailure(timeout(stderr)).diagnostic).toEqual({
      elapsedMs: 30000,
      stage: 'children-query-start',
      code: 'ETIMEDOUT',
      startupMs: 29000,
      activeQueryMs: 995,
    })
  })

  it('reports a long child CIM query with CRLF Buffer diagnostics', () => {
    const stderr = Buffer.from([marker('script-enter', 0, 100), marker('children-query-start', 5, 105)].join('\r\n'))
    expect(observeFailure(timeout(stderr)).diagnostic).toMatchObject({ startupMs: 100, activeQueryMs: 29895, stage: 'children-query-start' })
  })

  it('identifies an active parent CIM query before descendant discovery', () => {
    const stderr = [marker('script-enter', 0, 100), marker('parent-query-start', 2, 102)].join('\n')
    expect(observeFailure(timeout(stderr)).diagnostic).toMatchObject({ startupMs: 100, activeQueryMs: 29898, stage: 'parent-query-start' })
  })

  it('retains completed query durations and identifies a stall after enumeration', () => {
    const stderr = [
      marker('script-enter', 0, 100),
      marker('parent-query-start', 2, 102),
      marker('parent-query-end', 1002, 1102),
      marker('children-query-start', 1005, 1105),
      marker('children-query-end', 2005, 2105),
    ].join('\n')
    expect(observeFailure(timeout(stderr)).diagnostic).toEqual({
      elapsedMs: 30000,
      stage: 'children-query-end',
      code: 'ETIMEDOUT',
      startupMs: 100,
      parentQueryMs: 1000,
      childrenQueryMs: 1000,
    })
  })

  it.each([31000, 29000])('does not infer startup or active-query duration after a parent wall-clock jump to %i ms', (wallElapsedMs) => {
    const stderr = [marker('script-enter', 0, 100), marker('children-query-start', 5, 105)].join('\n')
    expect(observeFailure(timeout(stderr), 30000, wallElapsedMs).diagnostic).toEqual({ elapsedMs: 30000, stage: 'children-query-start', code: 'ETIMEDOUT' })
  })

  it('preserves same-clock completed query duration when UTC changes between markers', () => {
    const stderr = [
      marker('script-enter', 0, 100),
      marker('children-query-start', 5, 105),
      marker('children-query-end', 1005, 3105),
    ].join('\n')
    expect(observeFailure(timeout(stderr)).diagnostic).toEqual({ elapsedMs: 30000, stage: 'children-query-end', code: 'ETIMEDOUT', childrenQueryMs: 1000 })
  })

  it.each([
    ['negative startup', [marker('script-enter', 0, -1), marker('children-query-start', 5, 4)]],
    ['script entry after total elapsed', [marker('script-enter', 0, 30001), marker('children-query-start', 5, 30006)]],
  ])('leaves cross-clock estimates unknown for %s', (_, lines) => {
    expect(observeFailure(timeout(lines.join('\n'))).diagnostic).toEqual({ elapsedMs: 30000, stage: 'children-query-start', code: 'ETIMEDOUT' })
  })

  it.each([
    ['missing entry', [marker('children-query-start', 5, 105)]],
    ['out-of-order stage', [marker('script-enter', 0, 100), marker('children-query-end', 5, 105)]],
    ['duplicate stage', [marker('script-enter', 0, 100), marker('script-enter', 0, 100)]],
    ['decreasing elapsed', [marker('script-enter', 2, 102), marker('children-query-start', 1, 101)]],
    ['elapsed beyond process lifetime', [marker('script-enter', 30001, 30101)]],
    ['unsafe UTC integer', [`${PREFIX} script-enter 0 9999999999999999`]],
    ['too many markers', Array.from({ length: 9 }, () => marker('script-enter', 0, 100))],
  ])('rejects malformed marker sequences: %s', (_, lines) => {
    expect(observeFailure(timeout(lines.join('\n'))).diagnostic).toEqual({ elapsedMs: 30000, stage: 'before-script-entry-or-unobserved', code: 'ETIMEDOUT' })
  })

  it.each(['string', 'buffer'])('bounds %s stderr scanning to 8192 bytes', (kind) => {
    const text = `${'x'.repeat(8192)}\n${marker('script-enter', 0, 100)}\n${marker('children-query-start', 5, 105)}`
    const stderr = kind === 'buffer' ? Buffer.from(text) : text
    expect(observeFailure(timeout(stderr)).diagnostic.stage).toBe('before-script-entry-or-unobserved')
  })

  it('ignores unrelated stderr while retaining only whitelisted scalar fields', () => {
    const error = Object.assign(timeout(`${PRIVATE_TEXT}\n${marker('script-enter', 0, 100)}`), { signal: 'SIGTERM', status: 1, environment: PRIVATE_TEXT })
    expect(observeFailure(error).diagnostic).toEqual({ elapsedMs: 30000, stage: 'script-enter', code: 'ETIMEDOUT', signal: 'SIGTERM', status: 1, startupMs: 100 })
  })

  it('does not include unrecognized error codes, signals or invalid status', () => {
    const error = Object.assign(new Error(PRIVATE_TEXT), { code: PRIVATE_TEXT, signal: PRIVATE_TEXT, status: Number.NaN, stderr: PRIVATE_TEXT })
    expect(observeFailure(error).diagnostic).toEqual({ elapsedMs: 30000, stage: 'before-script-entry-or-unobserved' })
  })

  it('keeps a safe fallback if error diagnostics cannot be read', () => {
    const error = Object.defineProperty(new Error(PRIVATE_TEXT), 'stderr', {
      get() {
        throw new Error(PRIVATE_TEXT)
      },
    })
    expect(observeFailure(error).diagnostic).toEqual({ elapsedMs: 30000, stage: 'before-script-entry-or-unobserved' })
  })

  it('returns successful PID output unchanged', () => {
    expect(observeWindowsProcessTreeQuery(() => '202\r\n303\r\n')).toBe('202\r\n303\r\n')
  })

  it('keeps unrelated cleanup errors unchanged', () => {
    expect(describeUploadProcessTreeError(new Error('taskkill denied'))).toBe('Error: taskkill denied')
  })
})
