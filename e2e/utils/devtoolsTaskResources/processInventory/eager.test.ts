import type { ResolvedWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleInstallationProcesses } from '../processes'

const mocks = vi.hoisted(() => ({ ps: vi.fn(), paths: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
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
  for (const stdout of values) {
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
  it('uses the existing second round before initial fallback and retains a verified foreign process that then exits', async () => {
    const events: string[] = []
    const later = withNew(row(44, 1, 500))
    const values = [initial, later, later, initial, initial]
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
      newProcesses: [{ pid: 44, firstSeenRound: 1, classification: 'verified-foreign', imageSource: 'kernel-path' }],
      rssAnchor: 'initial-ps-inventory-only; later-rows-never-replace-or-add-rss',
    } })
    expect(events).toEqual(['ps', 'paths:11,22,33', 'ps', 'paths:44', 'ps', 'ps', 'fallback:33', 'ps'])
    expect(mocks.paths).toHaveBeenCalledTimes(2)
  })

  it('keeps an exit before the kernel-path postcondition unknown even when the path query returned a foreign image', async () => {
    inventories(initial, withNew(row(44)), initial, initial, initial)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      verifiedNewForeignProcessCount: 0,
      uninspectedNewProcessCount: 1,
      newProcesses: [{ pid: 44, classification: 'unclassified', imageSource: 'not-verified' }],
    } })
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44]])
  })

  it.each([
    [executable, 1, 'installation-image'],
    [foreignImage, 11, 'descendant'],
  ])('does not erase a newly verified selected member when it exits before the terminal inventory (%s, %i)', async (image, parentPid, classification) => {
    const later = withNew(row(44, parentPid))
    inventories(initial, later, later, initial, initial)
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
    inventories(initial, later, later, initial, later)
    const sample = await sampleInstallationProcesses(target, 'darwin')
    expect(sample).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      identityChangedProcessCount: 1,
      newProcesses: [{ pid: 44, firstSeenRound: 1, classification: 'identity-changed' }],
    } })
    if (sample.status !== 'observed') {
      throw new Error(sample.reason)
    }
    const identity = { pid: 44, parentPid: 1, started: 'Mon Oct 19 10:00:00 2026', zombie: false }
    expect(sample.value.identityChangedProcesses).toEqual([{
      ...identity,
      changedTo: identity,
      reasons: ['returned-after-absence'],
      firstObserved: { round: 1, phase: 'after-fallback' },
    }])
    expect(sample.value.identityChangedProcesses).toHaveLength(sample.value.identityChangedProcessCount)
    expect(sample.value.unclassifiedProcesses).toHaveLength(sample.value.unclassifiedProcessCount)
    expect(sample.value.missingIdentities).toHaveLength(sample.value.missingIdentityCount)
    expect(mocks.ps).toHaveBeenCalledTimes(5)
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44]])
  })

  it('does not infer foreign ownership from a foreign image and an unknown parent before the process exits', async () => {
    const later = withNew(row(44, 88))
    inventories(initial, later, later, initial, initial)
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
      newProcesses: expect.arrayContaining([{ pid: 66, parentPid: 1, started: 'Mon Oct 19 10:00:00 2026', firstSeenRound: 3, classification: 'unclassified', imageSource: 'not-verified' }]),
    } })
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 22, 33], [44], [55]])
    expect(mocks.ps).toHaveBeenCalledTimes(7)
  })

  it('retains an early inspection failure without retrying the identity or spending another round', async () => {
    inventories(initial, withNew(row(44)), initial)
    mocks.paths.mockResolvedValueOnce(new Map([[11, executable], [22, executable], [33, foreignImage]]))
    mocks.paths.mockRejectedValueOnce(new Error('fixture early kernel inspection failed'))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      inventoryRoundCount: 2,
      inventoryInspectionError: 'fixture early kernel inspection failed',
      uninspectedNewProcessCount: 1,
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(2)
    expect(mocks.ps).toHaveBeenCalledTimes(3)
  })
})
