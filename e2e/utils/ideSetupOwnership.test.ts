import { afterEach, describe, expect, it, vi } from 'vitest'

const { registerAfterAll, registerBeforeAll, cleanup, ensureJournal, provider } = vi.hoisted(() => ({
  registerAfterAll: vi.fn(),
  registerBeforeAll: vi.fn(),
  cleanup: vi.fn(async () => {}),
  ensureJournal: vi.fn(async () => 'owned-task-journal'),
  provider: vi.fn(() => 'devtools'),
}))
vi.mock('vitest', async importOriginal => ({
  ...await importOriginal<typeof import('vitest')>(),
  afterAll: registerAfterAll,
  beforeAll: registerBeforeAll,
  beforeEach: vi.fn(),
}))
vi.mock('./devtoolsProcessOwnership', () => ({
  cleanupOwnedDevtoolsProcesses: cleanup,
  ensureDevtoolsProjectJournal: ensureJournal,
}))
vi.mock('./ide-hmr-companion', () => ({ registerIdeHmrCompanion: vi.fn() }))
vi.mock('./runtimeProvider', () => ({ resolveRuntimeProviderName: provider }))

describe('IDE worker owned project teardown', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    provider.mockReturnValue('devtools')
  })

  it('registers independent window cleanup for a directly invoked IDE worker', async () => {
    await import('../vitest.e2e.ide.setup')
    await (registerBeforeAll.mock.calls[0]![0] as () => Promise<void>)()
    expect(ensureJournal).toHaveBeenCalledOnce()
    expect(registerAfterAll).toHaveBeenCalledOnce()
    const teardown = registerAfterAll.mock.calls[0]![0] as () => Promise<void>
    await teardown()
    expect(cleanup).toHaveBeenCalledWith({ journalPath: 'owned-task-journal', scope: 'journal' })
  })

  it('propagates unconfirmed cleanup so the IDE worker cannot report success', async () => {
    cleanup.mockRejectedValueOnce(new Error('window remains open'))
    await import('../vitest.e2e.ide.setup')
    await (registerBeforeAll.mock.calls[0]![0] as () => Promise<void>)()
    const teardown = registerAfterAll.mock.calls[0]![0] as () => Promise<void>
    await expect(teardown()).rejects.toThrow('window remains open')
  })

  it('does not create or clean IDE journals for a headless worker', async () => {
    provider.mockReturnValue('headless')
    await import('../vitest.e2e.ide.setup')
    await (registerBeforeAll.mock.calls[0]![0] as () => Promise<void>)()
    const teardown = registerAfterAll.mock.calls[0]![0] as () => Promise<void>
    await teardown()
    expect(ensureJournal).not.toHaveBeenCalled()
    expect(cleanup).not.toHaveBeenCalled()
  })
})
