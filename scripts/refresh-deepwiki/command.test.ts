import { describe, expect, it, vi } from 'vitest'
import { resolveMode, runDeepWikiCommand } from '../../.github/scripts/deepwiki/command.mjs'

vi.mock('playwright', () => {
  throw new Error('The mode dispatcher must not eagerly load the refresh browser dependency')
})

const mainSha = 'a'.repeat(40)
const summaryPath = 'summary.md'
const invalidArguments = [
  [''],
  ['monitor'],
  ['--mode'],
  ['--mode', 'refresh'],
  ['--mode='],
  ['--mode=unknown'],
  ['--mode=MONITOR'],
  ['--mode=refresh '],
  ['--unknown=refresh'],
  ['--mode=monitor', '--mode=monitor'],
  ['--mode=refresh', '--mode=refresh'],
  ['--mode=refresh', '--mode=monitor'],
  ['--mode=refresh', '--extra'],
]

function loaders(exitCode = 0) {
  const monitor = { run: vi.fn(async () => exitCode) }
  const refresh = { run: vi.fn(async () => exitCode) }
  return { monitor, refresh, loadMonitor: vi.fn(async () => monitor), loadRefresh: vi.fn(async () => refresh) }
}

describe('DeepWiki command mode boundary', () => {
  it.each([
    { args: [], mode: 'monitor' },
    { args: ['--mode=monitor'], mode: 'monitor' },
    { args: ['--mode=refresh'], mode: 'refresh' },
  ])('accepts only the explicit supported argument form: $args', ({ args, mode }) => {
    expect(resolveMode(args)).toBe(mode)
  })

  it('defaults to monitoring without loading the refresh module', async () => {
    const injected = loaders()
    expect(await runDeepWikiCommand({ mainSha, summaryPath, ...injected })).toBe(0)
    expect(injected.loadMonitor).toHaveBeenCalledTimes(1)
    expect(injected.monitor.run).toHaveBeenCalledExactlyOnceWith({ mainSha, summaryPath })
    expect(injected.loadRefresh).not.toHaveBeenCalled()
    expect(injected.refresh.run).not.toHaveBeenCalled()
  })

  it.each(['monitor', 'refresh'] as const)('loads only the selected %s implementation', async (mode) => {
    const injected = loaders()
    expect(await runDeepWikiCommand({ args: [`--mode=${mode}`], mainSha, summaryPath, ...injected })).toBe(0)
    const selected = mode === 'monitor' ? injected.loadMonitor : injected.loadRefresh
    const other = mode === 'monitor' ? injected.loadRefresh : injected.loadMonitor
    expect(selected).toHaveBeenCalledTimes(1)
    expect(injected[mode].run).toHaveBeenCalledExactlyOnceWith({ mainSha, summaryPath })
    expect(other).not.toHaveBeenCalled()
  })

  it.each(invalidArguments.map(args => ({ args })))('rejects invalid arguments before loading either implementation: $args', async ({ args }) => {
    const injected = loaders()
    expect(() => resolveMode(args)).toThrow()
    await expect(runDeepWikiCommand({ args, mainSha, summaryPath, ...injected })).rejects.toThrow()
    expect(injected.loadMonitor).not.toHaveBeenCalled()
    expect(injected.loadRefresh).not.toHaveBeenCalled()
    expect(injected.monitor.run).not.toHaveBeenCalled()
    expect(injected.refresh.run).not.toHaveBeenCalled()
  })

  it.each(['monitor', 'refresh'] as const)('preserves the %s implementation failure exit code', async (mode) => {
    const injected = loaders(7)
    expect(await runDeepWikiCommand({ args: [`--mode=${mode}`], mainSha, summaryPath, ...injected })).toBe(7)
    expect(mode === 'monitor' ? injected.loadRefresh : injected.loadMonitor).not.toHaveBeenCalled()
  })

  it.each(['monitor', 'refresh'] as const)('preserves a %s execution error without falling back to the other mode', async (mode) => {
    const injected = loaders()
    const error = new Error('Selected implementation failed')
    injected[mode].run.mockRejectedValueOnce(error)
    await expect(runDeepWikiCommand({ args: [`--mode=${mode}`], mainSha, summaryPath, ...injected })).rejects.toBe(error)
    expect(mode === 'monitor' ? injected.loadRefresh : injected.loadMonitor).not.toHaveBeenCalled()
  })
})
