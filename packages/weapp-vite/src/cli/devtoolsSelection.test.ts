import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withWechatDevtoolsSelectionArgs } from './devtoolsSelection'

const loadIde = vi.hoisted(() => vi.fn())
const select = vi.hoisted(() => vi.fn())

vi.mock('weapp-ide-cli', () => {
  loadIde()
  return { withWechatDevtoolsSelectionArgs: select }
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  select.mockImplementation(async (argv, runner) => runner(argv))
})

describe('lazy DevTools selection', () => {
  it('does not load IDE utilities for a plain build', async () => {
    const args = ['build', 'project', '--platform', 'weapp']
    const runner = vi.fn(async () => 'built')

    await expect(withWechatDevtoolsSelectionArgs(args, runner)).resolves.toBe('built')

    expect(runner).toHaveBeenCalledWith(args)
    expect(loadIde).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
  })

  it.each([
    ['build', '--devtools-channel', 'stable'],
    ['build', '--devtools-version=1.0.0'],
    ['build', '--cli-path', 'custom-cli'],
    ['build', '--require-official-latest=false'],
    ['build', '--require-official-latest'],
    ['build', '--desc', '--devtools-channel'],
    ['build', '--', '--devtools-channel', 'stable'],
  ])('delegates candidate parsing without changing option values or passthrough: %j', async (...args) => {
    const runner = vi.fn(async () => 'selected')

    await expect(withWechatDevtoolsSelectionArgs(args, runner)).resolves.toBe('selected')

    expect(select).toHaveBeenCalledWith(args, runner)
  })

  it('preserves validation failures from the shared selection parser', async () => {
    const failure = new Error('--cli-path requires a value.')
    select.mockRejectedValueOnce(failure)
    const runner = vi.fn()

    await expect(withWechatDevtoolsSelectionArgs(['build', '--cli-path'], runner)).rejects.toBe(failure)

    expect(runner).not.toHaveBeenCalled()
  })
})
