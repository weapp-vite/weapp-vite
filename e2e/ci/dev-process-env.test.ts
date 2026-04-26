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

function createPendingMockChild() {
  const promise = new Promise(() => {})

  return Object.assign(promise, {
    exitCode: null,
    kill: vi.fn(),
    pid: 12345,
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    all: new EventEmitter(),
  })
}

describe('dev process env isolation', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    })
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

  it('stops windows package-script dev processes with taskkill without waiting forever', async () => {
    vi.useFakeTimers()
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    })

    const child = createPendingMockChild()
    execaMock.mockImplementation((command: string) => {
      if (command === 'taskkill') {
        return Promise.resolve({
          exitCode: 0,
          signal: undefined,
        })
      }

      return child
    })

    let isFirstPidCheck = true
    vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals | 0) => {
      if (pid === 12345 && signal === 0 && isFirstPidCheck) {
        isFirstPidCheck = false
        return true
      }

      if (pid === 12345 && signal === 0) {
        const error = new Error('process is gone') as NodeJS.ErrnoException
        error.code = 'ESRCH'
        throw error
      }

      return true
    }) as typeof process.kill)

    const { startDevProcess } = await import('../utils/dev-process')
    const dev = startDevProcess('pnpm', ['--dir', 'fixtures/app', 'run', 'dev'], {
      all: true,
      env: {
        PATH: process.env.PATH ?? '',
      },
    })

    const stopPromise = dev.stop(100)
    await vi.advanceTimersByTimeAsync(1_100)
    await stopPromise

    expect(execaMock).toHaveBeenCalledWith('taskkill', ['/PID', '12345', '/T', '/F'], expect.objectContaining({
      reject: false,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    }))
    expect(child.kill).not.toHaveBeenCalled()
  })
})
