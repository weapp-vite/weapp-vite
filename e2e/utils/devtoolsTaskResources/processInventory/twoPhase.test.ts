import type { ResolvedWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleInstallationProcesses } from '../processes'

const mocks = vi.hoisted(() => ({ ps: vi.fn(), paths: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('./darwinSnapshot', async () => ({ readDarwinSnapshot: (await import('./snapshotFixture')).createSnapshotFixture(mocks) }))
vi.mock('execa', () => ({ execa: mocks.ps }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => '/Applications/Selected.app' }))

const target = { installationId: 'selected' } as ResolvedWechatDevtoolsTarget
const executable = '/Applications/Selected.app/Contents/MacOS/Electron'
const row = (pid: number, parentPid = 1, rss = 10) => `${pid} ${parentPid} ${rss} S Mon Oct 19 10:00:00 2026`
const initial = [row(11), row(22, 11), row(33)].join('\n')
const absent = [row(11), row(22, 11)].join('\n')
const result = (stdout: string) => Object.assign(Promise.resolve({ stdout, stderr: '', exitCode: 0 }), { pid: 99 })

function frames(...values: string[]) {
  for (const stdout of values) {
    mocks.ps.mockImplementationOnce(() => result(stdout))
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue('/Applications/Selected.app')
  mocks.paths.mockImplementation(async (pids: number[]) => new Map(pids.map(pid => [pid, pid === 11 || pid === 22 ? executable : '/System/Library/Foreign'])))
})
afterEach(() => vi.restoreAllMocks())

describe('prepared identities and a single fixed RSS anchor', () => {
  it('discards preparation and later RSS even when both differ from the only anchor', async () => {
    const snapshot = (rss: number) => [row(11, 1, rss), row(22, 11, rss * 2), row(33)].join('\n')
    frames(snapshot(1), snapshot(2), snapshot(3), snapshot(10), snapshot(1000))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 30 * 1024 },
      verifiedMemberRssBytes: 30 * 1024,
      processes: [{ pid: 11, rssBytes: 10 * 1024 }, { pid: 22, rssBytes: 20 * 1024 }],
      preAnchorExitedProcesses: [],
      inventoryRoundCount: 1,
      rssAnchor: 'single-post-preparation-ps-inventory; preparation-and-later-rows-never-contribute-rss',
    } })
    expect(mocks.ps).toHaveBeenCalledTimes(5)
    expect(mocks.paths).toHaveBeenCalledTimes(1)
  })

  it('records an unknown preparation exit without classifying it as foreign', async () => {
    frames(initial, absent, absent, absent, absent)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, executable], [33, null]]))
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 20 * 1024 },
      unclassifiedProcessCount: 0,
      verifiedNewForeignProcessCount: 0,
      preAnchorExitedProcesses: [{ pid: 33, final: null, causes: [
        { reason: 'process-absent', firstObserved: { round: 1, phase: 'after-kernel' } },
        { reason: 'pre-anchor-exited', firstObserved: { round: 1, phase: 'rss-anchor' } },
      ] }],
    } })
    expect(mocks.images).not.toHaveBeenCalled()
    expect(mocks.paths).toHaveBeenCalledTimes(1)
  })

  it('separates a new unknown preparation identity that exits before the anchor', async () => {
    frames(initial, `${initial}\n${row(44)}`, initial, initial, initial)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 20 * 1024 },
      uninspectedNewProcessCount: 0,
      verifiedNewForeignProcessCount: 0,
      newProcesses: [{ pid: 44, classification: 'pre-anchor-exited', imageSource: 'not-verified' }],
      preAnchorExitedProcesses: [{ pid: 44, final: null }],
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(1)
  })

  it('keeps a proven selected preparation exit incomplete instead of dropping its identity', async () => {
    const selectedAbsent = [row(22, 11), row(33)].join('\n')
    frames(initial, selectedAbsent, selectedAbsent, selectedAbsent, selectedAbsent)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      missingIdentityCount: 1,
      missingIdentities: [{ pid: 11, final: null }],
      preAnchorExitedProcesses: [],
    } })
  })

  it('retains a selected descendant first observed during preparation when it exits before the anchor', async () => {
    const prepared = [row(11), row(33)].join('\n')
    frames(prepared, `${prepared}\n${row(44, 11)}`, prepared, prepared, prepared)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      missingIdentityCount: 1,
      missingIdentities: [{ pid: 44, parentPid: 11, final: null, causes: [
        { reason: 'process-absent', firstObserved: { round: 1, phase: 'after-fallback' } },
      ] }],
      newProcesses: [{ pid: 44, classification: 'unclassified', imageSource: 'not-verified' }],
      preAnchorExitedProcesses: [],
    } })
    expect(mocks.ps).toHaveBeenCalledTimes(5)
    expect(mocks.paths.mock.calls.map(call => call[0])).toEqual([[11, 33]])
  })

  it('rejects a preparation PID that returns with the same seconds-resolution identity', async () => {
    frames(initial, absent, initial, initial, initial)
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'unavailable' },
      identityChangedProcessCount: 1,
      identityChangedProcesses: [{ pid: 33, reasons: ['returned-after-absence'], firstObserved: { round: 1, phase: 'after-fallback' } }],
      preAnchorExitedProcesses: [],
    } })
    expect(mocks.paths).toHaveBeenCalledTimes(1)
  })

  it('does not take a replacement anchor when the preparation consumes the shared deadline', async () => {
    let now = 0
    let reads = 0
    vi.mocked(Date.now).mockImplementation(() => now)
    mocks.ps.mockImplementation(() => {
      if (++reads === 3) {
        now = 10_000
      }
      return result(initial)
    })
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('shared process inspection budget') })
    expect(mocks.ps).toHaveBeenCalledTimes(3)
    expect(mocks.paths).toHaveBeenCalledTimes(1)
  })
})
