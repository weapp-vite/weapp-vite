import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleInstallationProcesses } from './processes'

const mocks = vi.hoisted(() => ({ native: vi.fn(), realpath: vi.fn(), execute: vi.fn() }))
vi.mock('./nativeInventory', () => ({ sampleNativeInstallationProcesses: mocks.native }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('execa', () => ({ execa: mocks.execute }))
const target = { installationId: 'selected' } as ResolvedWechatDevtoolsTarget
beforeEach(() => vi.resetAllMocks())

describe('installation sampling platform boundary', () => {
  it('returns the native Darwin observation unchanged', async () => {
    const observation = { status: 'unavailable', reason: 'Exact native evidence unavailable' }
    mocks.native.mockResolvedValue(observation)
    expect(await sampleInstallationProcesses(target, 'darwin')).toBe(observation)
    expect(mocks.native).toHaveBeenCalledExactlyOnceWith(target)
  })

  it.each(['win32', 'linux'] as const)('does not resolve, compile, start or inspect on %s', async (platform) => {
    expect(await sampleInstallationProcesses(target, platform)).toEqual({ status: 'unavailable', reason: `Selected-installation RSS sampling is not implemented for ${platform}.` })
    expect(mocks.native).not.toHaveBeenCalled()
    expect(mocks.realpath).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('defaults to the actual host platform', async () => {
    mocks.native.mockResolvedValue({ status: 'unavailable', reason: 'Native fixture' })
    const observation = await sampleInstallationProcesses(target)
    if (process.platform === 'darwin') {
      expect(mocks.native).toHaveBeenCalledExactlyOnceWith(target)
      expect(observation).toEqual({ status: 'unavailable', reason: 'Native fixture' })
    }
    else {
      expect(mocks.native).not.toHaveBeenCalled()
      expect(observation).toEqual({ status: 'unavailable', reason: `Selected-installation RSS sampling is not implemented for ${process.platform}.` })
    }
  })
})
