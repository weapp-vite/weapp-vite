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
    expect(env.CHOKIDAR_USEPOLLING).toBe('1')
    expect(env.CHOKIDAR_INTERVAL).toBe('120')
    expect(env.WEAPP_VITE_DISABLE_SIDECAR_WATCH).toBeUndefined()
  })

  it('allows opting out of chokidar polling for native watcher diagnostics', async () => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', '1')
    vi.stubEnv('CHOKIDAR_INTERVAL', '120')

    const { createDevProcessEnv } = await import('../utils/dev-process-env')

    const env = createDevProcessEnv({ usePolling: false })

    expect(env.CHOKIDAR_USEPOLLING).toBeUndefined()
    expect(env.CHOKIDAR_INTERVAL).toBeUndefined()
  })

  it('can strip e2e-only env flags from child dev processes', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_TARGET_FILE', 'ide/current.test.ts')
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_DIR', '/tmp/report')
    vi.stubEnv('WEAPP_VITE_AI', 'codex')

    const { createDevProcessEnv } = await import('../utils/dev-process-env')

    const env = createDevProcessEnv({ stripE2EEnv: true })

    expect(env.WEAPP_VITE_E2E_TARGET_FILE).toBeUndefined()
    expect(env.WEAPP_VITE_E2E_REPORT_DIR).toBeUndefined()
    expect(env.WEAPP_VITE_AI).toBe('codex')
  })

  it('strips e2e-only env flags from child dev processes by default', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_TARGET_FILE', 'e2e/ci/current.test.ts')
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_DIR', '/tmp/report')

    const { createDevProcessEnv } = await import('../utils/dev-process-env')

    const env = createDevProcessEnv()

    expect(env.WEAPP_VITE_E2E_TARGET_FILE).toBeUndefined()
    expect(env.WEAPP_VITE_E2E_REPORT_DIR).toBeUndefined()
  })

  it('can keep e2e-only env flags for diagnostics that opt in explicitly', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_TARGET_FILE', 'e2e/ci/current.test.ts')

    const { createDevProcessEnv } = await import('../utils/dev-process-env')

    const env = createDevProcessEnv({ keepE2EEnv: true })

    expect(env.WEAPP_VITE_E2E_TARGET_FILE).toBe('e2e/ci/current.test.ts')
  })

  it('allows opting out of sidecar watch for targeted diagnostics', async () => {
    const { createDevProcessEnv } = await import('../utils/dev-process-env')

    const env = createDevProcessEnv({ disableSidecarWatch: true })

    expect(env.WEAPP_VITE_DISABLE_SIDECAR_WATCH).toBe('1')
  })

  it('allows explicit node options for memory diagnostics', async () => {
    vi.stubEnv('NODE_OPTIONS', '--inspect')

    const { createDevProcessEnv } = await import('../utils/dev-process-env')

    const env = createDevProcessEnv({ nodeOptions: '--expose-gc --inspect=127.0.0.1:0' })

    expect(env.NODE_OPTIONS).toBe('--expose-gc --inspect=127.0.0.1:0')
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

  it('cleans unix dev processes with regex command patterns', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    })

    execaMock.mockImplementation((command: string) => {
      if (command === 'ps') {
        return Promise.resolve({
          stdout: [
            '111 1 pnpm --dir /repo/e2e-apps/base run dev -- --platform weapp',
            '222 1 pnpm --dir /repo/docs-site run dev',
            '333 1 node /repo/packages/weapp-vite/dist/cli.mjs dev /repo/apps/vite-native-ts --platform weapp',
          ].join('\n'),
        })
      }

      return Promise.resolve({
        exitCode: 0,
        signal: undefined,
      })
    })

    const alivePids = new Set([111, 333])
    const killedPids: number[] = []
    vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals | 0) => {
      if (signal === 0) {
        if (alivePids.has(pid)) {
          return true
        }

        const error = new Error('process is gone') as NodeJS.ErrnoException
        error.code = 'ESRCH'
        throw error
      }

      killedPids.push(pid)
      alivePids.delete(pid)
      return true
    }) as typeof process.kill)

    const { cleanupProcessesByCommandPatterns } = await import('../utils/dev-process')

    await cleanupProcessesByCommandPatterns([
      /pnpm\s+--dir\s+\S*e2e-apps\/\S+\s+run\s+\S+/,
      /packages\/weapp-vite\/dist\/cli\.mjs\s+dev[^\n]*apps\//,
    ])

    expect(killedPids).toEqual([111, 333])
  })

  it('cleans package-script dev commands from the residual cleanup entrypoint', async () => {
    vi.useFakeTimers()
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    })

    execaMock.mockImplementation((command: string) => {
      if (command === 'ps') {
        return Promise.resolve({
          stdout: [
            '111 1 pnpm --dir /repo/e2e-apps/base run dev -- --platform weapp',
            '222 1 pnpm --dir /repo/docs-site run dev',
          ].join('\n'),
        })
      }

      return Promise.resolve({
        exitCode: 0,
        signal: undefined,
      })
    })

    const alivePids = new Set([111])
    const killedPids: number[] = []
    vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals | 0) => {
      if (signal === 0) {
        if (alivePids.has(pid)) {
          return true
        }

        const error = new Error('process is gone') as NodeJS.ErrnoException
        error.code = 'ESRCH'
        throw error
      }

      killedPids.push(pid)
      alivePids.delete(pid)
      return true
    }) as typeof process.kill)

    const { cleanupResidualDevProcesses } = await import('../utils/dev-process-cleanup')

    const cleanup = cleanupResidualDevProcesses()
    await vi.advanceTimersByTimeAsync(1_000)
    await cleanup

    expect(execaMock).toHaveBeenCalledWith('pkill', ['-f', 'pnpm.*--dir.*e2e-apps/.+ run '], expect.objectContaining({
      reject: false,
    }))
    expect(killedPids).toEqual([111])
  })
})
