import { describe, expect, it, vi } from 'vitest'
import { runWindowsBuildCi, WINDOWS_TURBO_BUILD_ARGS } from './run-windows-build-ci'

describe('runWindowsBuildCi', () => {
  it('applies explicit project exclusions from the child environment', async () => {
    const spawn = vi.fn(() => ({ status: 0 }))
    await runWindowsBuildCi({
      env: { WEAPP_VITE_E2E_EXCLUDE_PROJECTS: 'uview-plus-compat,wot-ui-compat' },
      spawn,
      runReport: async () => {},
      turboEntry: 'turbo-entry',
    })
    expect(spawn).toHaveBeenCalledWith(expect.any(String), [
      'turbo-entry',
      ...WINDOWS_TURBO_BUILD_ARGS,
      '--filter=!./e2e-apps/uview-plus-compat',
      '--filter=!./e2e-apps/wot-ui-compat',
    ], expect.objectContaining({ stdio: 'inherit' }))
  })

  it('runs the size report in the existing process after a successful build', async () => {
    const spawn = vi.fn(() => ({ status: 0 }))
    const runReport = vi.fn(async () => {})

    await expect(runWindowsBuildCi({
      cwd: 'repo-root',
      env: { CI: 'true' },
      execPath: 'node-executable',
      runReport,
      spawn,
      turboEntry: 'turbo-entry',
    })).resolves.toBe(0)

    expect(spawn).toHaveBeenCalledWith(
      'node-executable',
      ['turbo-entry', ...WINDOWS_TURBO_BUILD_ARGS],
      {
        cwd: 'repo-root',
        env: { CI: 'true' },
        stdio: 'inherit',
      },
    )
    expect(runReport).toHaveBeenCalledOnce()
  })

  it('propagates the build exit code without running the report', async () => {
    const runReport = vi.fn(async () => {})

    await expect(runWindowsBuildCi({
      runReport,
      spawn: () => ({ status: 7 }),
    })).resolves.toBe(7)
    expect(runReport).not.toHaveBeenCalled()
  })

  it('throws process launch errors without running the report', async () => {
    const error = new Error('launch failed')
    const runReport = vi.fn(async () => {})

    await expect(runWindowsBuildCi({
      runReport,
      spawn: () => ({ error, status: null }),
    })).rejects.toThrow(error)
    expect(runReport).not.toHaveBeenCalled()
  })
})
