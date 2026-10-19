import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseResourceProcessRows, sampleInstallationProcesses } from './processes'

const mocks = vi.hoisted(() => ({ ps: vi.fn(), paths: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.ps }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwinKernelPaths', () => ({ readDarwinKernelPaths: mocks.paths }))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => '/Applications/Selected.app' }))

const executable = '/Applications/Selected.app/Contents/MacOS/Electron'
const foreignImage = '/System/Library/Foreign'
const target = { installationId: 'selected' } as ResolvedWechatDevtoolsTarget
const row = (pid: number, parentPid = 1, rss = 10, started = 'Mon Oct 19 10:00:00 2026') => `${pid} ${parentPid} ${rss} S ${started}`
const initial = [row(11), row(22, 11), row(33)].join('\n')

function inventories(...values: string[]) {
  for (const stdout of values) {
    mocks.ps.mockImplementationOnce(() => Object.assign(Promise.resolve({ stdout, stderr: '', exitCode: 0 }), { pid: 99 }))
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.realpath.mockResolvedValue('/Applications/Selected.app')
  mocks.paths.mockResolvedValue(new Map([[11, executable], [22, `${executable} Helper`], [33, foreignImage]]))
})
afterEach(() => vi.restoreAllMocks())

describe('IDE task installation RSS sampling', () => {
  it('reads RSS as bytes, accepts CRLF, and rejects duplicate or malformed rows', () => {
    expect(parseResourceProcessRows(`${row(11)}\r\n${row(22)}`)[0]).toMatchObject({ pid: 11, rssBytes: 10 * 1024 })
    expect(() => parseResourceProcessRows(`${row(11)}\n${row(11)}`)).toThrow('duplicate')
    expect(() => parseResourceProcessRows('11 1 invalid S Mon Oct 19 10:00:00 2026')).toThrow('unverifiable')
  })

  it('keeps only the selected installation tree and marks the sample as non-atomic and not a peak', async () => {
    inventories(initial, initial, initial)
    const sample = await sampleInstallationProcesses(target, 'darwin')
    expect(sample).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 20 * 1024,
      installationRssBytes: { status: 'observed', value: 20 * 1024 },
      processes: [{ pid: 11 }, { pid: 22 }],
      semantics: 'point-in-time-rss-not-peak',
      atomicity: expect.stringContaining('not-ownership-proof'),
    } })
    expect(JSON.stringify(sample)).not.toContain(foreignImage)
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it('uses the existing text-image fallback for a stable null path without exposing foreign images', async () => {
    inventories(initial, initial, initial)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, `${executable} Helper`], [33, null]]))
    mocks.images.mockResolvedValue([foreignImage])
    const sample = await sampleInstallationProcesses(target, 'darwin')
    expect(mocks.images).toHaveBeenCalledExactlyOnceWith(33)
    expect(sample).toMatchObject({ status: 'observed', value: { unclassifiedProcessCount: 0, installationRssBytes: { status: 'observed' } } })
    expect(JSON.stringify(sample)).not.toContain(foreignImage)
  })

  it('does not classify a disappeared null-path process as selected or invent its earlier RSS ownership', async () => {
    inventories(initial, initial, [row(11), row(22, 11)].join('\n'))
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, `${executable} Helper`], [33, null]]))
    mocks.images.mockRejectedValue(new Error('Process exited during image inspection'))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      unclassifiedProcessCount: 1,
      missingIdentityCount: 0,
      installationRssBytes: { status: 'unavailable' },
      processes: [{ pid: 11 }, { pid: 22 }],
    } })
  })

  it('keeps a stable unverifiable process as a full-inventory gap instead of a zero RSS success', async () => {
    inventories(initial, initial, initial)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, `${executable} Helper`], [33, null]]))
    mocks.images.mockRejectedValue(new Error('Cannot inspect text images'))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 20 * 1024,
      unclassifiedProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
    } })
  })

  it('counts invalid descendant paths and changed selected identities as missing evidence', async () => {
    inventories(initial, initial, [row(11, 1, 10, 'Mon Oct 19 10:00:01 2026'), row(22, 11), row(33)].join('\n'))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      missingIdentityCount: 1,
      installationRssBytes: { status: 'unavailable' },
    } })

    inventories(initial, initial, initial)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, 'relative-unverifiable'], [33, foreignImage]]))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      missingIdentityCount: 1,
      unclassifiedProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
    } })
  })

  it('reports newly appeared processes as uninspected rather than claiming a complete inventory', async () => {
    inventories(initial, initial, `${initial}\n${row(44)}`)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      uninspectedNewProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
    } })
  })

  it('stops dispatching fallback work when its shared start budget is exhausted', async () => {
    inventories(initial, initial, initial)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, `${executable} Helper`], [33, null]]))
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(10_001)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      fallbackBudgetExhausted: true,
      installationRssBytes: { status: 'unavailable' },
    } })
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it('does not start a platform sampler when it is unsupported', async () => {
    expect(await sampleInstallationProcesses(target, 'win32')).toMatchObject({ status: 'unavailable' })
    expect(mocks.ps).not.toHaveBeenCalled()
    expect(mocks.paths).not.toHaveBeenCalled()
  })
})
