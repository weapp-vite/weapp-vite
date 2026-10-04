import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.doUnmock('@weapp-vite/miniprogram-automator')
  vi.resetModules()
})

it.each(['launchAutomator', 'connectOpenedAutomator'] as const)('%s rejects an already cancelled operation before loading the launcher', async (method) => {
  const loader = vi.fn(() => ({ Launcher: vi.fn() }))
  vi.doMock('@weapp-vite/miniprogram-automator', loader)
  const api = await import('../src/cli/automator')
  const cancelled = new Error('cancelled before initialization')
  await expect(api[method]({ projectPath: 'project', signal: AbortSignal.abort(cancelled) })).rejects.toBe(cancelled)
  expect(loader).not.toHaveBeenCalled()
})

it.each([
  ['launchAutomator', 'timeout'],
  ['launchAutomator', 'abort'],
  ['connectOpenedAutomator', 'timeout'],
  ['connectOpenedAutomator', 'abort'],
] as const)('%s bounds a pending launcher import by %s and never starts late work', async (method, reason) => {
  let finishLoading!: (value: { Launcher: ReturnType<typeof vi.fn> }) => void
  const loading = new Promise<{ Launcher: ReturnType<typeof vi.fn> }>((resolve) => {
    finishLoading = resolve
  })
  let observeLoading!: () => void
  const startedLoading = new Promise<void>((resolve) => {
    observeLoading = resolve
  })
  const launcher = vi.fn()
  vi.doMock('@weapp-vite/miniprogram-automator', () => {
    observeLoading()
    return loading
  })
  const api = await import('../src/cli/automator')
  const controller = new AbortController()
  const cancelled = new Error('cancelled during initialization')
  const result = api[method]({ projectPath: 'project', timeout: reason === 'timeout' ? 50 : 5_000, signal: controller.signal }).catch(error => error)
  try {
    await startedLoading
    if (reason === 'abort') {
      controller.abort(cancelled)
    }
    if (reason === 'timeout') {
      await expect(result).resolves.toMatchObject({ code: 'DEVTOOLS_OPERATION_TIMEOUT', operation: { stage: 'load-automator', attempts: 0 } })
    }
    else {
      await expect(result).resolves.toBe(cancelled)
    }
    expect(launcher).not.toHaveBeenCalled()
  }
  finally {
    finishLoading({ Launcher: launcher })
    await vi.dynamicImportSettled()
  }
  expect(launcher).not.toHaveBeenCalled()
})

vi.mock('@weapp-vite/devtools-runtime', async importOriginal => ({
  ...await importOriginal<typeof import('@weapp-vite/devtools-runtime')>(),
  withMachineE2ELease: async (run: () => Promise<unknown>) => await run(),
}))
