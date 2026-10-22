import type { ResolvedWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleInstallationProcesses } from '../processes'

const mocks = vi.hoisted(() => ({ ps: vi.fn(), paths: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('./darwinSnapshot', async () => ({ readDarwinSnapshot: (await import('./snapshotFixture')).createSnapshotFixture(mocks) }))
vi.mock('execa', () => ({ execa: mocks.ps }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwinKernelPaths', () => ({ readDarwinKernelPaths: mocks.paths }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => '/Applications/Selected.app' }))

const executable = '/Applications/Selected.app/Contents/MacOS/Electron'
const foreignImage = '/System/Library/Foreign'
const target = { installationId: 'selected' } as ResolvedWechatDevtoolsTarget
const row = (pid: number, parentPid = 1, rss = 10, started = 'Mon Oct 19 10:00:00 2026') => `${pid} ${parentPid} ${rss} S ${started}`
const initial = [row(11), row(22, 11), row(33)].join('\n')
const withNew = (...rows: string[]) => [initial, ...rows].join('\n')
const result = (stdout: string) => Object.assign(Promise.resolve({ stdout, stderr: '', exitCode: 0 }), { pid: 99 })

function inventories(...values: string[]) {
  // 前三帧固定准备身份，随后依次提供唯一 RSS 锚点与后验闭合帧。
  for (const stdout of [values[0]!, values[0]!, ...values]) {
    mocks.ps.mockImplementationOnce(() => result(stdout))
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue('/Applications/Selected.app')
  mocks.paths.mockImplementation(async (pids: number[]) => new Map(pids.map(pid => [pid, pid === 11 || pid === 22 ? executable : foreignImage])))
})
afterEach(() => vi.restoreAllMocks())

describe('bounded resource inventory closure', () => {
  it('uses the single post-preparation anchor and never replaces its RSS during closure', async () => {
    const later = [row(11, 1, 100), row(22, 11, 200), row(33), row(44, 1, 500)].join('\n')
    inventories(initial, later, later, later, later)
    const sample = await sampleInstallationProcesses(target, 'darwin')
    expect(sample).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 300 * 1024,
      installationRssBytes: { status: 'observed', value: 300 * 1024 },
      inventoryRoundCount: 2,
      verifiedNewForeignProcessCount: 1,
      uninspectedNewProcessCount: 0,
      newProcesses: [{ pid: 44, parentPid: 1, firstSeenRound: 1, classification: 'verified-foreign', imageSource: 'kernel-path' }],
      rssAnchor: 'single-post-preparation-ps-inventory; preparation-and-later-rows-never-contribute-rss',
    } })
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44]])
    expect(JSON.stringify(sample)).not.toContain(foreignImage)
  })

  it.each([
    [executable, 1, 'installation-image'],
    [foreignImage, 11, 'descendant'],
  ])('keeps a newly observed selected member as a gap (%s, parent %i)', async (image, parentPid, classification) => {
    const later = withNew(row(44, parentPid))
    inventories(initial, initial, later, later, later)
    mocks.paths.mockImplementationOnce(async () => new Map([[11, executable], [22, executable], [33, foreignImage]]))
    mocks.paths.mockResolvedValueOnce(new Map([[44, image]]))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 20 * 1024,
      installationRssBytes: { status: 'unavailable' },
      newSelectedProcessCount: 1,
      newProcesses: [{ pid: 44, classification }],
    } })
  })

  it.each([
    [[foreignImage], 'verified-foreign', 'observed'],
    [[foreignImage, executable], 'installation-image', 'unavailable'],
  ])('requires all fallback text images for a new identity (%j)', async (images, classification, status) => {
    const later = withNew(row(44))
    inventories(initial, initial, later, later, later)
    mocks.paths.mockImplementationOnce(async () => new Map([[11, executable], [22, executable], [33, foreignImage]]))
    mocks.paths.mockResolvedValueOnce(new Map([[44, null]]))
    mocks.images.mockResolvedValue(images)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status },
      newProcesses: [{ pid: 44, classification, imageSource: 'text-images' }],
    } })
    expect(mocks.images).toHaveBeenCalledExactlyOnceWith(44, 10_000)
  })

  it('does not infer a transient new process was unrelated after it disappears before inspection', async () => {
    inventories(initial, initial, withNew(row(44)), initial, initial)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      uninspectedNewProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
      newProcesses: [{ pid: 44, classification: 'unclassified', imageSource: 'not-verified' }],
    } })
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44]])
  })

  it('keeps a newly observed zero-RSS zombie as an unverifiable new identity', async () => {
    const later = withNew(row(44, 1, 0).replace(' S ', ' Z '))
    inventories(initial, initial, later)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 20 * 1024,
      installationRssBytes: { status: 'unavailable' },
      uninspectedNewProcessCount: 1,
      newProcesses: [{ pid: 44, classification: 'unclassified', imageSource: 'not-verified', zombie: true, final: { pid: 44, parentPid: 1, started: 'Mon Oct 19 10:00:00 2026', zombie: true }, causes: [{ reason: 'zombie', firstObserved: { round: 1, phase: 'after-anchor' } }] }],
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(1)
    expect(mocks.ps).toHaveBeenCalledTimes(5)
  })

  it.each([
    row(44, 1, 10, 'Mon Oct 19 10:00:01 2026'),
    row(44, 11),
  ])('retains new identity drift as a gap instead of verifying the replacement (%s)', async (replacement) => {
    const later = withNew(row(44))
    const changed = withNew(replacement)
    inventories(initial, initial, later, changed, changed)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      identityChangedProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
      newProcesses: [{ pid: 44, classification: 'identity-changed' }],
    } })
  })

  it('closes at the third round by inspecting only additional PIDs', async () => {
    const first = withNew(row(44))
    const second = withNew(row(44), row(55, 44))
    inventories(initial, initial, first, second, second, second, second)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 20 * 1024 },
      inventoryRoundCount: 3,
      verifiedNewForeignProcessCount: 2,
      uninspectedNewProcessCount: 0,
    } })
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44], [55]])
  })

  it('stops after three rounds and retains continuing new process activity as a gap', async () => {
    const first = withNew(row(44))
    const second = withNew(row(44), row(55))
    inventories(initial, initial, first, second, second, second, withNew(row(44), row(55), row(66)))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      inventoryRoundCount: 3,
      verifiedNewForeignProcessCount: 2,
      uninspectedNewProcessCount: 1,
      newProcesses: expect.arrayContaining([{ pid: 66, parentPid: 1, started: 'Mon Oct 19 10:00:00 2026', zombie: false, firstSeenRound: 3, classification: 'unclassified', imageSource: 'not-verified', final: { pid: 66, parentPid: 1, started: 'Mon Oct 19 10:00:00 2026', zombie: false }, causes: [] }]),
    } })
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44], [55]])
    expect(mocks.ps).toHaveBeenCalledTimes(9)
  })

  it.each([
    [row(44, 88)],
    [row(44, 55), row(55, 44)],
  ])('keeps unverifiable or cyclic ancestry unknown despite foreign images (%j)', async (...rows) => {
    const later = withNew(...rows)
    inventories(initial, initial, later, later, later)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      verifiedNewForeignProcessCount: 0,
      uninspectedNewProcessCount: rows.length,
      installationRssBytes: { status: 'unavailable' },
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(2)
  })

  it('never heals an initial unknown by classifying later unrelated processes', async () => {
    const later = withNew(row(44))
    inventories(initial, later, later, later, later)
    mocks.paths.mockImplementationOnce(async () => new Map([[11, executable], [22, executable], [33, null]]))
    mocks.images.mockRejectedValue(new Error('No verifiable text images'))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      unclassifiedProcessCount: 1,
      verifiedNewForeignProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
    } })
    expect(mocks.images).toHaveBeenCalledTimes(1)
  })

  it('rejects an initial PID that disappears and returns with the same seconds-resolution identity', async () => {
    inventories(initial, [row(11), row(22, 11)].join('\n'), initial)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      identityChangedProcessCount: 1,
      unclassifiedProcessCount: 0,
      installationRssBytes: { status: 'unavailable' },
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(1)
  })

  it('does not use a new foreign image to bypass an unstable foreign ancestor', async () => {
    const later = withNew(row(44, 33))
    const changed = [row(11), row(22, 11), row(33, 1, 10, 'Mon Oct 19 10:00:01 2026'), row(44, 33)].join('\n')
    inventories(initial, initial, later, changed, changed)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      identityChangedProcessCount: 1,
      verifiedNewForeignProcessCount: 0,
      uninspectedNewProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
    } })
  })

  it('still checks initial selected identities at the final closure boundary', async () => {
    const later = withNew(row(44))
    inventories(initial, initial, later, later, [row(11, 1, 10, 'Mon Oct 19 10:00:01 2026'), row(22, 11), row(33), row(44)].join('\n'))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      missingIdentityCount: 1,
      identityChangedProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
    } })
  })

  it('does not reset the shared deadline before additional inventory rounds', async () => {
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    let calls = 0
    mocks.ps.mockImplementation(() => {
      calls++
      if (calls === 5) {
        now = 10_001
      }
      return result(calls === 5 ? withNew(row(44)) : initial)
    })
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      inventoryBudgetExhausted: true,
      inventoryRoundCount: 1,
      uninspectedNewProcessCount: 1,
      installationRssBytes: { status: 'unavailable' },
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(1)
    expect(mocks.ps).toHaveBeenCalledTimes(5)
  })

  it.each([10_000, 10_001])('rejects a completed final inventory at or beyond the deadline without new PIDs (%i ms)', async (completedAt) => {
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    let calls = 0
    mocks.ps.mockImplementation(() => {
      if (++calls === 5) {
        now = completedAt
      }
      return result(initial)
    })
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      inventoryBudgetExhausted: true,
      inventoryRoundCount: 1,
      uninspectedNewProcessCount: 0,
      installationRssBytes: { status: 'unavailable' },
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(1)
    expect(mocks.ps).toHaveBeenCalledTimes(5)
  })

  it('passes the same diminishing budget through ps, kernel paths, fallback and closure', async () => {
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const later = withNew(row(44))
    inventories(initial, initial, later, later, later)
    mocks.paths.mockImplementationOnce(async () => {
      now = 500
      return new Map([[11, executable], [22, executable], [33, null]])
    })
    mocks.images.mockImplementationOnce(async () => {
      now = 1500
      return [foreignImage]
    })
    mocks.paths.mockImplementationOnce(async () => {
      now = 2500
      return new Map([[44, foreignImage]])
    })
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 20 * 1024 },
      samplingBudgetMs: 10_000,
    } })
    expect(mocks.paths.mock.calls.map(call => call[1])).toEqual([10_000, 8500])
    expect(mocks.images).toHaveBeenCalledExactlyOnceWith(33, 9500)
    expect(mocks.ps.mock.calls.map(call => (call[2] as { timeout: number }).timeout)).toEqual([10_000, 9500, 8500, 8500, 8500, 7500, 7500])
  })
})
