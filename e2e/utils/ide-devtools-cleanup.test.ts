import { afterEach, describe, expect, it, vi } from 'vitest'

const { cleanDev, cleanIde, quiescence, cli, rm } = vi.hoisted(() => ({
  cleanDev: vi.fn(async () => {}),
  cleanIde: vi.fn(async () => {}),
  quiescence: vi.fn(async () => {}),
  cli: vi.fn(),
  rm: vi.fn(),
}))
vi.mock('./dev-process-cleanup', () => ({ cleanupResidualDevProcesses: cleanDev }))
vi.mock('./devtoolsProcessOwnership', () => ({
  cleanupOwnedDevtoolsProcesses: cleanIde,
}))
vi.mock('./ide-devtools-logs', () => ({ waitForDevtoolsLogQuiescence: quiescence }))
vi.mock('execa', () => ({ execa: cli }))
vi.mock('node:fs/promises', () => ({ rm }))

describe('automatic IDE cleanup ownership', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it.each(['darwin', 'win32', 'linux'] as const)('releases owned resources without CLI or global cache changes on %s', async (platform) => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'devtools')
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', 'owned-journal')
    const { cleanupResidualIdeProcesses } = await import('./ide-devtools-cleanup')
    await cleanupResidualIdeProcesses(platform)
    expect(cleanDev).toHaveBeenCalledOnce()
    expect(cleanIde).toHaveBeenCalledWith({ journalPath: 'owned-journal', scope: 'journal' })
    expect(quiescence).toHaveBeenCalledOnce()
    expect(cli).not.toHaveBeenCalled()
    expect(rm).not.toHaveBeenCalled()
  })

  it('keeps process-scoped cleanup when no task journal is registered', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'devtools')
    const { cleanupResidualDevtoolsProcesses } = await import('./ide-devtools-cleanup')
    await cleanupResidualDevtoolsProcesses()
    expect(cleanIde).toHaveBeenCalledWith()
  })

  it.each(['headless', ' HEADLESS '])('does not touch IDE state from a %s suite', async (provider) => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', provider)
    const { cleanupResidualIdeProcesses, cleanupResidualDevtoolsProcesses } = await import('./ide-devtools-cleanup')
    await cleanupResidualIdeProcesses()
    await cleanupResidualDevtoolsProcesses()
    expect(cleanDev).toHaveBeenCalledOnce()
    expect(cleanIde).not.toHaveBeenCalled()
    expect(quiescence).not.toHaveBeenCalled()
    expect(cli).not.toHaveBeenCalled()
    expect(rm).not.toHaveBeenCalled()
  })
})
