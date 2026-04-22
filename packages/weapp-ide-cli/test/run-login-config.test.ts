import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('resolveLoginRetryConfig', () => {
  let originalStdinIsTTY: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('CI', '')
    originalStdinIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    })
  })

  afterEach(() => {
    if (originalStdinIsTTY) {
      Object.defineProperty(process.stdin, 'isTTY', originalStdinIsTTY)
    }
    else {
      delete (process.stdin as any).isTTY
    }
    vi.unstubAllEnvs()
  })

  it('strips login retry control flags from runtime argv', async () => {
    const { resolveLoginRetryConfig } = await import('../src/cli/run-login-config')

    const result = resolveLoginRetryConfig([
      'open',
      '--project',
      '/tmp/demo',
      '--login-retry=once',
      '--login-retry-timeout',
      '1234',
      '--non-interactive',
    ])

    expect(result).toEqual({
      nonInteractive: true,
      retryMode: 'once',
      retryTimeoutMs: 1234,
      runtimeArgv: ['open', '--project', '/tmp/demo'],
    })
  })

  it('defaults retry mode to never in ci mode', async () => {
    vi.stubEnv('CI', 'true')
    const { resolveLoginRetryConfig } = await import('../src/cli/run-login-config')

    const result = resolveLoginRetryConfig(['open'])

    expect(result.retryMode).toBe('never')
    expect(result.nonInteractive).toBe(true)
  })
})
