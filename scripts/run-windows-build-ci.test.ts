import { describe, expect, it, vi } from 'vitest'
import { runWindowsBuildCi, WINDOWS_TURBO_BUILD_ARGS } from './run-windows-build-ci'

describe('runWindowsBuildCi', () => {
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
