import { describe, expect, it } from 'vitest'
import { classifyTerminalRuntimeFailure, parseTerminalRuntimeFailureLine, TERMINAL_RUNTIME_FAILURE_MARKER } from './terminalRuntimeFailure'

const bootCode = 'E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED'
const deadlineCode = 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE'

describe('terminal runtime failure classification', () => {
  it('classifies the typed boot error without copying private error details', () => {
    const error = Object.assign(new Error('simulator launch failed token=private-value'), { code: bootCode })
    expect(classifyTerminalRuntimeFailure(error)).toEqual({
      code: bootCode,
      reason: 'WeChat DevTools simulator failed to start before webview page ready.',
    })
  })

  it('finds a typed log subscription deadline through wrapped causes', () => {
    const deadline = Object.assign(new Error('Runtime log subscription deadline exhausted'), { code: deadlineCode })
    const error = new Error('startup failed', { cause: new Error('operation failed', { cause: deadline }) })
    expect(classifyTerminalRuntimeFailure(error)).toEqual({
      code: deadlineCode,
      reason: 'Runtime log subscription did not complete before the launch deadline.',
    })
  })

  it('preserves the outer typed failure when its cause has another terminal code', () => {
    const cause = Object.assign(new Error('subscription failed'), { code: deadlineCode })
    const error = Object.assign(new Error('simulator failed', { cause }), { code: bootCode })
    expect(classifyTerminalRuntimeFailure(error)?.code).toBe(bootCode)
  })

  it('terminates circular cause chains without classifying ordinary errors', () => {
    const first = new Error('first')
    const second = new Error('second', { cause: first })
    first.cause = second
    expect(classifyTerminalRuntimeFailure(first)).toBeUndefined()
  })

  it('requires an explicit cause instead of guessing from aggregate members', () => {
    const failure = Object.assign(new Error('startup failed'), { code: bootCode })
    const cleanup = new Error('cleanup failed')
    expect(classifyTerminalRuntimeFailure(new AggregateError([failure, cleanup], 'Unclassified aggregate'))).toBeUndefined()
    expect(classifyTerminalRuntimeFailure(new AggregateError([failure, cleanup], 'cleanup failed', { cause: failure }))?.code).toBe(bootCode)
  })

  it('does not classify ordinary errors based on names, messages or non-error payloads', () => {
    const error = new Error(`${bootCode}: simulator launch failed; ${deadlineCode}`)
    error.name = 'WechatIdeSimulatorBootLogError'
    expect(classifyTerminalRuntimeFailure(error)).toBeUndefined()
    expect(classifyTerminalRuntimeFailure({ code: bootCode, message: 'simulator launch failed' })).toBeUndefined()
    expect(classifyTerminalRuntimeFailure(Object.assign(new Error('failed'), { code: 'UNKNOWN' }))).toBeUndefined()
  })
})

describe('terminal runtime failure line parsing', () => {
  it.each([bootCode, deadlineCode])('accepts the exact marker and declared code %s', (code) => {
    expect(parseTerminalRuntimeFailureLine(`${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code, reason: ' startup failed ' })}`))
      .toEqual({ code, reason: 'startup failed' })
  })

  it.each([
    '',
    'not-json',
    'null',
    '[]',
    'false',
    '"failure"',
    JSON.stringify({ code: 'UNKNOWN', reason: 'failed' }),
    JSON.stringify({ code: bootCode }),
    JSON.stringify({ reason: 'failed' }),
    JSON.stringify({ code: bootCode, reason: '' }),
    JSON.stringify({ code: bootCode, reason: ' \n\t ' }),
    JSON.stringify({ code: bootCode, reason: 1 }),
    JSON.stringify({ code: bootCode, reason: 'failed', extra: true }),
  ])('rejects malformed or undeclared payload %s', (payload) => {
    expect(parseTerminalRuntimeFailureLine(`${TERMINAL_RUNTIME_FAILURE_MARKER}${payload}`)).toBeUndefined()
  })

  it('does not accept markers embedded in ordinary or prefixed logs', () => {
    const line = `${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code: bootCode, reason: 'failed' })}`
    expect(parseTerminalRuntimeFailureLine(`prefix ${line}`)).toBeUndefined()
    expect(parseTerminalRuntimeFailureLine(` ${line}`)).toBeUndefined()
    expect(parseTerminalRuntimeFailureLine(line.replace(TERMINAL_RUNTIME_FAILURE_MARKER, '[e2e:runtime-terminal]'))).toBeUndefined()
  })
})
