import type { DarwinProcessEntry } from '../processInventory/darwinInspector/types'
import type { InstallationProcessSample } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureForeign, fixtureInstallation, fixtureSelected, frame } from './fixture'
import { sampleNativeInstallationProcesses } from './index'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
const target = {} as Parameters<typeof sampleNativeInstallationProcesses>[0]

function frames(...rows: DarwinProcessEntry[][]) {
  mocks.read.mockImplementation(async (phase: typeof phases[number]) => frame(phase, structuredClone(rows[phases.indexOf(phase)]!)))
}

async function sample(): Promise<InstallationProcessSample> {
  const result = await sampleNativeInstallationProcesses(target)
  expect(result.status, JSON.stringify(result)).toBe('observed')
  if (result.status !== 'observed') {
    throw new Error(result.reason)
  }
  expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(phases)
  return result.value
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue(fixtureInstallation)
  mocks.prepare.mockResolvedValue({ executable: 'owned-test-helper' })
  mocks.inspect.mockImplementation(async (_deadline, consume) => consume({ readFrame: mocks.read }))
  mocks.images.mockRejectedValue(new Error('Fixture text-image access denied'))
})
afterEach(() => vi.restoreAllMocks())

describe('native inventory ancestry and new selected members', () => {
  it.each(['missing', 'unknown', 'cyclic', 'unstable'] as const)('does not classify external images through a %s ancestor as foreign', async (kind) => {
    const rows = [entry(11), entry(22, { parentPid: kind === 'missing' ? 88 : 33 })]
    if (kind !== 'missing') {
      const ancestor = entry(33, { parentPid: kind === 'cyclic' ? 22 : 1, executable: kind === 'unknown' ? null : fixtureForeign })
      if (kind === 'unstable') {
        ancestor.after.identity!.startedMicroseconds = '123457'
      }
      rows.push(ancestor)
    }
    frames(...phases.map(() => rows))
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedMemberRssBytes).toBe(1000)
    expect(report.unclassifiedProcesses).toEqual(expect.arrayContaining([expect.objectContaining({ pid: 22 })]))
    expect(report.verifiedNewForeignProcessCount).toBe(0)
    expect(report.newProcesses).toEqual([])
  })

  it.each(['installation-image', 'descendant'] as const)('retains a new selected %s that exits before the final boundary', async (membership) => {
    const baseline = [entry(11), entry(22)]
    const added = entry(33, { parentPid: membership === 'descendant' ? 11 : 1, executable: membership === 'installation-image' ? fixtureSelected : fixtureForeign })
    frames(baseline, baseline, [...baseline, added], baseline)
    const report = await sample()
    expect(report).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      verifiedMemberRssBytes: 1000,
      newSelectedProcessCount: 1,
      newProcesses: [{ pid: 33, firstSeenRound: 2, classification: membership, final: null, causes: [{ reason: 'process-absent', firstObserved: { round: 3, phase: 'closure2' } }] }],
    })
    expect(report.processes.some(row => row.pid === 33)).toBe(false)
    expect(report.missingIdentities).toEqual([expect.objectContaining({ pid: 33, final: null })])
  })

  it('does not accept a newly observed zero-byte zombie as a verified foreign process', async () => {
    const baseline = [entry(11), entry(22)]
    const zombie = entry(33, { rssBytes: '0', identity: { status: 5, zombie: true } })
    frames(baseline, baseline, [...baseline, zombie], [...baseline, zombie])
    const report = await sample()
    expect(report).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      verifiedMemberRssBytes: 1000,
      verifiedNewForeignProcessCount: 0,
      uninspectedNewProcessCount: 1,
      newProcesses: [{ pid: 33, zombie: true, classification: 'unclassified', imageSource: 'not-verified', causes: [{ reason: 'zombie', firstObserved: { round: 2, phase: 'closure1' } }] }],
    })
    expect(report.nativeFrames?.find(frame => frame.phase === 'closure1')?.rows.find(row => row.pid === 33)?.rss.bytes).toBe('0')
  })

  it('gives an unverifiable selected descendant its own image and missing-member gaps', async () => {
    frames(...phases.map(() => [entry(11), entry(22, { parentPid: 11, executable: null })]))
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.unclassifiedProcesses).toEqual([expect.objectContaining({ pid: 22, parentPid: 11 })])
    expect(report.missingIdentities).toEqual([expect.objectContaining({ pid: 22, parentPid: 11, causes: expect.arrayContaining([expect.objectContaining({ reason: 'kernel-path-unverifiable' })]) })])
    expect(report.processes).toEqual([expect.objectContaining({ pid: 11 })])
  })

  it('retains a proven descendant that exits between preparation and the anchor', async () => {
    const remaining = [entry(11)]
    frames([...remaining, entry(22, { parentPid: 11 })], remaining, remaining, remaining)
    expect(await sample()).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      missingIdentities: [{ pid: 22, parentPid: 11, final: null, causes: [{ reason: 'process-absent', firstObserved: { round: 1, phase: 'anchor' } }] }],
      preAnchorExitedProcesses: [],
    })
  })

  it('stops at the fixed final boundary while retaining later incomplete identities', async () => {
    const baseline = [entry(11), entry(22)]
    const verified = entry(33)
    const unknown = entry(44, { parentPid: 33, executable: null })
    frames(baseline, [...baseline, verified], [...baseline, verified, unknown], [...baseline, verified, unknown, entry(55, { parentPid: 88 })])
    const report = await sample()
    expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, inventoryRoundCount: 3, verifiedNewForeignProcessCount: 1, uninspectedNewProcessCount: 2 })
    expect(report.newProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 33, firstSeenRound: 1, classification: 'verified-foreign' }),
      expect.objectContaining({ pid: 44, firstSeenRound: 2, classification: 'unclassified' }),
      expect.objectContaining({ pid: 55, firstSeenRound: 3, classification: 'unclassified' }),
    ]))
  })
})
