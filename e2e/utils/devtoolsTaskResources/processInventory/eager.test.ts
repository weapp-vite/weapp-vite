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

describe('first-observation process identity capture', () => {
  it('prepares fallback before the unique RSS anchor and retains a subsequently verified foreign exit', async () => {
    const events: string[] = []
    const later = withNew(row(44, 1, 500))
    const values = [initial, initial, initial, later, later, later, initial]
    mocks.ps.mockImplementation(() => {
      events.push('ps')
      return result(values.shift()!)
    })
    mocks.paths.mockImplementation(async (pids: number[]) => {
      events.push(`paths:${pids.join(',')}`)
      return new Map(pids.map(pid => [pid, pid === 33 ? null : pid === 11 || pid === 22 ? executable : foreignImage]))
    })
    mocks.images.mockImplementation(async (pid: number) => {
      events.push(`fallback:${pid}`)
      return [foreignImage]
    })
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 20 * 1024,
      installationRssBytes: { status: 'observed', value: 20 * 1024 },
      inventoryRoundCount: 2,
      verifiedNewForeignProcessCount: 1,
      uninspectedNewProcessCount: 0,
      newProcesses: [{ pid: 44, firstSeenRound: 1, classification: 'verified-foreign', imageSource: 'kernel-path', final: null, causes: [{ reason: 'process-absent', firstObserved: { round: 2, phase: 'after-fallback' } }] }],
      rssAnchor: 'single-post-preparation-ps-inventory; preparation-and-later-rows-never-contribute-rss',
    } })
    expect(events).toEqual(['ps', 'paths:11,22,33', 'ps', 'fallback:33', 'ps', 'ps', 'ps', 'paths:44', 'ps', 'ps'])
    expect(mocks.paths).toHaveBeenCalledTimes(2)
  })

  it('keeps an exit before the kernel-path postcondition unknown even when the path query returned a foreign image', async () => {
    inventories(initial, initial, withNew(row(44)), initial, initial)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      verifiedNewForeignProcessCount: 0,
      uninspectedNewProcessCount: 1,
      newProcesses: [{ pid: 44, classification: 'unclassified', imageSource: 'not-verified', final: null, causes: [{ reason: 'process-absent', firstObserved: { round: 2, phase: 'after-kernel' } }] }],
    } })
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44]])
  })

  it.each([
    [executable, 1, 'installation-image'],
    [foreignImage, 11, 'descendant'],
  ])('does not erase a newly verified selected member when it exits before the terminal inventory (%s, %i)', async (image, parentPid, classification) => {
    const later = withNew(row(44, parentPid))
    inventories(initial, later, later, later, initial)
    mocks.paths.mockResolvedValueOnce(new Map([[11, executable], [22, executable], [33, foreignImage]]))
    mocks.paths.mockResolvedValueOnce(new Map([[44, image]]))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      newSelectedProcessCount: 1,
      newProcesses: [{ pid: 44, classification }],
    } })
  })

  it.each([
    row(44, 1, 10, 'Mon Oct 19 10:00:01 2026'),
    row(44, 11),
    row(44).replace(' S ', ' Z '),
  ])('retains drift after early verification as a gap (%s)', async (replacement) => {
    const later = withNew(row(44))
    const changed = withNew(replacement)
    inventories(initial, later, later, changed, changed)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      identityChangedProcessCount: 1,
      newProcesses: [{ pid: 44, classification: 'identity-changed' }],
    } })
  })

  it('rejects a verified PID that disappears and returns with the same seconds-resolution identity', async () => {
    const later = withNew(row(44))
    const returned = withNew(row(44), row(55))
    inventories(initial, later, later, later, withNew(row(55)), returned, returned)
    const sample = await sampleInstallationProcesses(target, 'darwin')
    expect(sample).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      identityChangedProcessCount: 1,
      verifiedNewForeignProcessCount: 1,
      uninspectedNewProcessCount: 0,
      newProcesses: [
        { pid: 44, firstSeenRound: 1, classification: 'identity-changed' },
        { pid: 55, firstSeenRound: 2, classification: 'verified-foreign', imageSource: 'kernel-path' },
      ],
    } })
    if (sample.status !== 'observed') {
      throw new Error(sample.reason)
    }
    const identity = { pid: 44, parentPid: 1, started: 'Mon Oct 19 10:00:00 2026', zombie: false }
    expect(sample.value.identityChangedProcesses).toEqual([{
      ...identity,
      changedTo: identity,
      reasons: ['returned-after-absence'],
      firstObserved: { round: 3, phase: 'after-kernel' },
    }])
    expect(sample.value.newProcesses).toEqual(expect.arrayContaining([{
      ...identity,
      firstSeenRound: 1,
      classification: 'identity-changed',
      imageSource: 'kernel-path',
      final: identity,
      causes: [
        { reason: 'process-absent', firstObserved: { round: 2, phase: 'after-fallback' } },
        { reason: 'identity-changed', firstObserved: { round: 3, phase: 'after-kernel' } },
      ],
    }]))
    expect(sample.value.identityChangedProcesses).toHaveLength(sample.value.identityChangedProcessCount)
    expect(sample.value.unclassifiedProcesses).toHaveLength(sample.value.unclassifiedProcessCount)
    expect(sample.value.missingIdentities).toHaveLength(sample.value.missingIdentityCount)
    expect(mocks.ps).toHaveBeenCalledTimes(9)
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44], [55]])
  })

  it('does not infer foreign ownership from a foreign image and an unknown parent before the process exits', async () => {
    const later = withNew(row(44, 88))
    inventories(initial, later, later, later, initial)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      verifiedNewForeignProcessCount: 0,
      uninspectedNewProcessCount: 1,
      newProcesses: [{ pid: 44, classification: 'unclassified', imageSource: 'kernel-path' }],
    } })
  })

  it('keeps the original three-round cap when new identities continue after the early second round', async () => {
    const first = withNew(row(44))
    const second = withNew(row(44), row(55))
    const third = withNew(row(44), row(55), row(66))
    inventories(initial, first, first, second, second, third, third)
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

  it('retains an early inspection failure without retrying the identity or spending another round', async () => {
    inventories(initial, withNew(row(44)), withNew(row(44)))
    mocks.paths.mockResolvedValueOnce(new Map([[11, executable], [22, executable], [33, foreignImage]]))
    mocks.paths.mockRejectedValueOnce(new Error('fixture early kernel inspection failed'))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      inventoryRoundCount: 2,
      inventoryInspectionError: 'fixture early kernel inspection failed',
      uninspectedNewProcessCount: 1,
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(2)
    expect(mocks.ps).toHaveBeenCalledTimes(5)
  })

  it.each([
    ['text-images-query-failed', new Error('unverifiable images')],
    ['text-images-empty', []],
    ['text-images-invalid', ['relative-unverifiable']],
  ])('persists a new identity fallback gap and its final metadata (%s)', async (reason, images) => {
    const later = withNew(row(44))
    inventories(initial, later, later, later, later)
    mocks.paths.mockResolvedValueOnce(new Map([[11, executable], [22, executable], [33, foreignImage]]))
    mocks.paths.mockResolvedValueOnce(new Map([[44, null]]))
    if (images instanceof Error) {
      mocks.images.mockRejectedValue(images)
    }
    else {
      mocks.images.mockResolvedValue(images)
    }
    const sample = await sampleInstallationProcesses(target, 'darwin')
    const identity = { pid: 44, parentPid: 1, started: 'Mon Oct 19 10:00:00 2026', zombie: false }
    expect(sample).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      verifiedNewForeignProcessCount: 0,
      uninspectedNewProcessCount: 1,
      newProcesses: [{ ...identity, final: identity, imageSource: 'not-verified', causes: [{ reason, firstObserved: { round: 2, phase: 'fallback' } }] }],
    } })
    expect(JSON.stringify(sample)).not.toContain('unverifiable images')
    expect(JSON.stringify(sample)).not.toContain('relative-unverifiable')
    expect(mocks.images).toHaveBeenCalledExactlyOnceWith(44, 10_000)
    expect(mocks.paths).toHaveBeenCalledTimes(2)
    expect(mocks.ps).toHaveBeenCalledTimes(7)
  })

  it('persists an unverifiable kernel path for a new identity without inferring foreign ownership', async () => {
    const later = withNew(row(44))
    inventories(initial, later, later, later, later)
    mocks.paths.mockResolvedValueOnce(new Map([[11, executable], [22, executable], [33, foreignImage]]))
    mocks.paths.mockResolvedValueOnce(new Map([[44, 'relative-unverifiable']]))
    const sample = await sampleInstallationProcesses(target, 'darwin')
    const identity = { pid: 44, parentPid: 1, started: 'Mon Oct 19 10:00:00 2026', zombie: false }
    expect(sample).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      verifiedNewForeignProcessCount: 0,
      uninspectedNewProcessCount: 1,
      newProcesses: [{ ...identity, final: identity, imageSource: 'not-verified', causes: [{ reason: 'kernel-path-unverifiable', firstObserved: { round: 2, phase: 'after-kernel' } }] }],
    } })
    expect(JSON.stringify(sample)).not.toContain('relative-unverifiable')
    expect(mocks.images).not.toHaveBeenCalled()
    expect(mocks.paths).toHaveBeenCalledTimes(2)
    expect(mocks.ps).toHaveBeenCalledTimes(7)
  })
})
