import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runLoggedCommand } from './lifecycle'
import { prepareTutorialWorkspace } from './prepare'

vi.mock('./lifecycle', () => ({ runLoggedCommand: vi.fn() }))

describe('tutorial runtime preparation', () => {
  beforeEach(() => {
    vi.stubEnv('TUTORIAL_E2E_SKIP_WORKSPACE_BUILD', '0')
    vi.mocked(runLoggedCommand).mockResolvedValue({ durationMs: 0, stderr: '', stdout: '' })
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it.each(['handbook-wevu-counter', 'multi-platform'] as const)('builds harness dependencies for npm %s', async (scenario) => {
    const log = vi.fn()
    await prepareTutorialWorkspace({ scenarios: [scenario], source: 'npm' }, log)
    expect(runLoggedCommand).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      command: { args: ['--filter', '@mpcore/simulator^...', '--if-present', 'run', 'build'], command: 'pnpm' },
      log,
    }))
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('keeps npm dependencies prepared when workspace building is skipped', async () => {
    vi.stubEnv('TUTORIAL_E2E_SKIP_WORKSPACE_BUILD', '1')
    await prepareTutorialWorkspace({ scenarios: ['handbook-wevu-counter'], source: 'npm' }, vi.fn())
    expect(runLoggedCommand).toHaveBeenCalledOnce()
  })

  it('does not build local product packages for the npm create-only tutorial', async () => {
    await prepareTutorialWorkspace({ scenarios: ['guide-create'], source: 'npm' }, vi.fn())
    expect(runLoggedCommand).not.toHaveBeenCalled()
  })

  it('uses the existing full workspace build once when it also prepares the harness', async () => {
    await prepareTutorialWorkspace({ scenarios: ['handbook-wevu-counter'], source: 'workspace' }, vi.fn())
    expect(runLoggedCommand).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      command: { args: ['build:pkgs:ci'], command: 'pnpm' },
    }))
    expect(process.stdout.write).toHaveBeenCalledWith('dist sync: rebuilt weapp-vite before downstream validation\n')
  })

  it('prepares the harness independently of a skipped workspace build', async () => {
    vi.stubEnv('TUTORIAL_E2E_SKIP_WORKSPACE_BUILD', '1')
    await prepareTutorialWorkspace({ scenarios: ['multi-platform'], source: 'workspace' }, vi.fn())
    expect(runLoggedCommand).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      label: 'tutorial runtime harness dependency build',
    }))
  })

  it('propagates dependency build failure before any tutorial runs', async () => {
    const failure = new Error('runtime dependency build failed')
    vi.mocked(runLoggedCommand).mockRejectedValueOnce(failure)
    await expect(prepareTutorialWorkspace({ scenarios: ['multi-platform'], source: 'npm' }, vi.fn()))
      .rejects
      .toBe(failure)
    expect(runLoggedCommand).toHaveBeenCalledOnce()
  })
})
