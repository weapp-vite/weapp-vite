import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { execaMock } = vi.hoisted(() => {
  return {
    execaMock: vi.fn(),
  }
})

vi.mock('execa', () => {
  return {
    execa: execaMock,
  }
})

function createMockChild() {
  const promise = Promise.resolve({
    exitCode: 0,
    signal: undefined,
  })

  return Object.assign(promise, {
    pid: 12345,
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    all: new EventEmitter(),
  })
}

describe('dev process env isolation', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('removes ci and vitest-specific env flags from child dev processes', async () => {
    vi.stubEnv('CI', 'true')
    vi.stubEnv('VITEST', 'true')
    vi.stubEnv('VITEST_MODE', 'run')
    vi.stubEnv('VITEST_POOL_ID', 'pool-1')
    vi.stubEnv('VITEST_WORKER_ID', 'worker-1')
    vi.stubEnv('NODE_OPTIONS', '--inspect')

    const { createDevProcessEnv } = await import('../utils/dev-process-env')

    const env = createDevProcessEnv()

    expect(env.CI).toBeUndefined()
    expect(env.VITEST).toBeUndefined()
    expect(env.VITEST_MODE).toBeUndefined()
    expect(env.VITEST_POOL_ID).toBeUndefined()
    expect(env.VITEST_WORKER_ID).toBeUndefined()
    expect(env.NODE_OPTIONS).toBeUndefined()
    expect(env.NODE_ENV).toBe('development')
    expect(env.WEAPP_VITE_DISABLE_SIDECAR_WATCH).toBeUndefined()
  })

  it('allows opting out of sidecar watch for targeted diagnostics', async () => {
    const { createDevProcessEnv } = await import('../utils/dev-process-env')

    const env = createDevProcessEnv({ disableSidecarWatch: true })

    expect(env.WEAPP_VITE_DISABLE_SIDECAR_WATCH).toBe('1')
  })

  it('starts child dev processes with extendEnv disabled so stripped vars stay removed', async () => {
    execaMock.mockReturnValue(createMockChild())

    const { startDevProcess } = await import('../utils/dev-process')
    const env = {
      PATH: process.env.PATH ?? '',
      NODE_ENV: 'development',
    }

    startDevProcess('node', ['script.js'], {
      env,
      all: true,
    })

    expect(execaMock).toHaveBeenCalledWith('node', ['script.js'], expect.objectContaining({
      all: true,
      env,
      extendEnv: false,
    }))
  })

  it('uses taskkill to terminate Windows process trees', async () => {
    const { getWindowsTaskkillArgs } = await import('../utils/dev-process')

    expect(getWindowsTaskkillArgs(12345)).toEqual(['/pid', '12345', '/t', '/f'])
  })
})
