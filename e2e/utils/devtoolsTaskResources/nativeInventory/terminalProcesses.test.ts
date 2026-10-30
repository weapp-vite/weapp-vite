import type { DarwinProcessEntry } from '../processInventory/darwinInspector/types'
import type { InstallationProcessSample } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureInstallation, fixtureSelected, frame } from './fixture'
import { sampleNativeInstallationProcesses } from './index'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn(), execute: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('execa', () => ({ execa: mocks.execute }))

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
const target = {} as Parameters<typeof sampleNativeInstallationProcesses>[0]

function zombie(pid = 33, parentPid = 22): DarwinProcessEntry {
  return {
    ...entry(pid, { parentPid, identity: { status: 5, zombie: true } }),
    pathBefore: { count: 0, errno: 3, executable: null },
    task: { count: 0, errno: 3, identity: null, rssBytes: null },
    pathAfter: { count: 0, errno: 3, executable: null },
    gaps: ['image-before-unavailable', 'image-after-unavailable', 'rss-unavailable', 'zombie'],
  }
}

function exited(pid = 33): DarwinProcessEntry {
  return {
    ...zombie(pid),
    before: { result: 0, length: 0, errno: 0, identity: null },
    after: { result: 0, length: 0, errno: 0, identity: null },
    gaps: ['identity-before-unavailable', 'identity-after-unavailable', 'image-before-unavailable', 'image-after-unavailable', 'rss-unavailable'],
  }
}

function frames(...rows: DarwinProcessEntry[][]) {
  mocks.read.mockImplementation(async (phase: typeof phases[number]) => {
    const selected = rows[phases.indexOf(phase)]!
    const baseline = [entry(11), entry(22)].filter(row => !selected.some(value => value.pid === row.pid))
    return frame(phase, structuredClone([...baseline, ...selected]))
  })
}

async function sample(): Promise<InstallationProcessSample> {
  const result = await sampleNativeInstallationProcesses(target)
  expect(result.status, JSON.stringify(result)).toBe('observed')
  if (result.status !== 'observed') {
    throw new Error(result.reason)
  }
  expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(phases)
  expect(mocks.execute).not.toHaveBeenCalled()
  expect(result.value.nativeFrames?.map(value => value.phase)).toEqual(phases)
  return result.value
}

async function rejected(...rows: DarwinProcessEntry[][]) {
  frames(...rows)
  const report = await sample()
  expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, verifiedTerminalProcessCount: 0, verifiedTerminalProcesses: [] })
  expect(report.newProcesses.every(row => row.classification !== 'verified-terminal')).toBe(true)
  return report
}

function expectSelectedRss(report: InstallationProcessSample, terminalCount = 1) {
  expect(report).toMatchObject({
    installationRssBytes: { status: 'observed', value: 1000 },
    verifiedMemberRssBytes: 1000,
    verifiedTerminalProcessCount: terminalCount,
    unclassifiedProcessCount: 0,
    uninspectedNewProcessCount: 0,
    verifiedNewForeignProcessCount: 0,
  })
  expect(report.processes).toEqual([expect.objectContaining({ pid: 11, rssBytes: 1000 })])
  expect(report.verifiedTerminalProcesses).toHaveLength(terminalCount)
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

describe('strict native terminal process evidence', () => {
  it('retains a prepare zombie and its anchor exit without inventing zero-byte RSS', async () => {
    frames([zombie()], [exited()], [], [])
    const report = await sample()
    expectSelectedRss(report)
    expect(report.verifiedTerminalProcesses).toEqual([expect.objectContaining({
      process: expect.objectContaining({ pid: 33, zombie: true, final: null }),
      firstTerminalPhase: 'prepare',
      proof: 'only-kernel-terminal-identities-observed',
      phases,
      semantics: 'terminated-task-without-executable-or-rss; no-ownership-inference',
    })])
    expect(report.identityChangedProcessCount).toBe(1)
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({ pid: 33 })])
    expect(report.nativeFrames?.[0]?.rows.find(row => row.pid === 33)).toMatchObject({
      before: { pid: 33, zombie: true, status: 5 },
      after: { pid: 33, zombie: true, status: 5 },
      pathBefore: { count: 0, errno: 3, image: null },
      pathAfter: { count: 0, errno: 3, image: null },
      rss: { count: 0, errno: 3, identity: null, bytes: null },
      gaps: zombie().gaps,
    })
    expect(report.nativeFrames?.[1]?.rows.find(row => row.pid === 33)).toMatchObject({ before: null, after: null, rss: { bytes: null }, gaps: exited().gaps })
  })

  it.each(['same-zombie', 'complete-exit', 'absent'] as const)('accepts an anchor-proven foreign task becoming terminal with %s confirmation', async (confirmation) => {
    const live = entry(33, { parentPid: 22 })
    frames([live], [live], [zombie()], confirmation === 'same-zombie' ? [zombie()] : confirmation === 'complete-exit' ? [exited()] : [])
    const report = await sample()
    expectSelectedRss(report)
    expect(report.verifiedTerminalProcesses).toEqual([expect.objectContaining({
      process: expect.objectContaining({ pid: 33, zombie: false }),
      terminalIdentity: expect.objectContaining({ pid: 33, zombie: true }),
      firstTerminalPhase: 'closure1',
      proof: 'anchor-proven-foreign-then-kernel-terminal',
      ancestry: [expect.objectContaining({ pid: 22 })],
    })])
    expect(report.identityChangedProcessCount).toBe(1)
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({ pid: 33, reasons: ['zombie-changed'] })])
  })

  it.each(['same-zombie', 'complete-exit', 'absent'] as const)('classifies a new closure zombie separately from foreign with %s confirmation', async (confirmation) => {
    frames([], [], [zombie()], confirmation === 'same-zombie' ? [zombie()] : confirmation === 'complete-exit' ? [exited()] : [])
    const report = await sample()
    expectSelectedRss(report)
    expect(report.newProcesses).toEqual([expect.objectContaining({ pid: 33, firstSeenRound: 2, classification: 'verified-terminal', imageSource: 'not-verified' })])
    expect(report.verifiedTerminalProcesses?.[0]).toMatchObject({ process: { pid: 33 }, firstTerminalPhase: 'closure1', proof: 'only-kernel-terminal-identities-observed', phases: ['closure1', 'closure2'] })
    expect(report.nativeFrames?.[2]?.rows.find(row => row.pid === 33)?.rss.bytes).toBeNull()
  })

  it('retains all three independent terminal patterns and raw identity changes in one sample', async () => {
    const live = entry(44, { parentPid: 22 })
    frames([zombie(), live], [exited(), live], [zombie(44), zombie(55)], [zombie(44), zombie(55)])
    const report = await sample()
    expectSelectedRss(report, 3)
    expect(report.verifiedTerminalProcesses?.map(proof => proof.process.pid).sort()).toEqual([33, 44, 55])
    expect(report.identityChangedProcessCount).toBe(2)
    expect(report.identityChangedProcesses.map(change => change.pid).sort()).toEqual([33, 44])
    expect(report.newProcesses).toEqual([expect.objectContaining({ pid: 55, classification: 'verified-terminal' })])
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it.each(['selected', 'descendant', 'unknown'] as const)('keeps %s live history blocking after a terminal observation', async (relation) => {
    const live = entry(33, { parentPid: relation === 'descendant' ? 11 : relation === 'unknown' ? 77 : 22, executable: relation === 'selected' ? fixtureSelected : undefined })
    const terminal = zombie(33, live.before.identity!.parentPid)
    await rejected([live], [live], [terminal], [terminal])
  })

  it.each(['anchor', 'closure1'] as const)('rejects live history first observed in %s without a complete prepare/anchor proof', async (phase) => {
    const live = entry(33, { parentPid: 22 })
    await rejected([], phase === 'anchor' ? [live] : [], phase === 'anchor' ? [zombie()] : [live], [zombie()])
  })

  it('requires a later fixed frame to confirm a zombie first seen in closure2', async () => {
    const report = await rejected([], [], [], [zombie()])
    expect(report).toMatchObject({ uninspectedNewProcessCount: 1, newProcesses: [{ pid: 33, classification: 'unclassified' }] })
  })

  it('does not accept a live-to-zombie transition before the RSS anchor', async () => {
    await rejected([entry(33, { parentPid: 22 })], [zombie()], [zombie()], [zombie()])
  })

  it('rejects a prepared live task missing from the anchor before returning as the same terminal instance', async () => {
    const report = await rejected([entry(33, { parentPid: 22 })], [], [zombie()], [zombie()])
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({ pid: 33, reasons: expect.arrayContaining(['returned-after-absence']) })])
  })

  it.each(['uid', 'start'] as const)('rejects a preterminal task-record %s mismatch even after kernel termination', async (kind) => {
    const live = entry(33, { parentPid: 22 })
    const inconsistent = structuredClone(live)
    if (kind === 'uid') {
      inconsistent.task.identity!.uid = 502
    }
    else {
      inconsistent.task.identity!.startedMicroseconds = '123457'
    }
    await rejected([live], [inconsistent], [zombie()], [zombie()])
  })

  it.each(['uid', 'start', 'image'] as const)('rejects %s drift in the proven foreign ancestor before termination', async (kind) => {
    const live = entry(33, { parentPid: 22 })
    const changed = entry(22, kind === 'image'
      ? { executable: '/System/Library/OtherForeign' }
      : {
          identity: kind === 'uid' ? { uid: 502 } : { startedMicroseconds: '123457' },
        })
    await rejected([live], [live, changed], [zombie()], [zombie()])
  })

  it.each([
    { name: 'UID', patch: { uid: 502 } },
    { name: 'parent', patch: { parentPid: 77 } },
    { name: 'start seconds', patch: { startedSeconds: '1792800001' } },
    { name: 'start microseconds', patch: { startedMicroseconds: '123457' } },
  ])('rejects $name drift between terminal frames and from proven live history', async ({ patch }) => {
    const changed = zombie()
    Object.assign(changed.before.identity!, patch)
    Object.assign(changed.after.identity!, patch)
    await rejected([], [], [zombie()], [changed])
    mocks.read.mockClear()
    const live = entry(33, { parentPid: 22 })
    await rejected([live], [live], [changed], [changed])
  })

  it.each(['before', 'after', 'pathBefore', 'pathAfter', 'task'] as const)('rejects a terminal %s permission error', async (field) => {
    const denied = zombie()
    denied[field].errno = 1
    await rejected([denied], [denied], [denied], [denied])
  })

  it.each(['pathBefore', 'pathAfter', 'task'] as const)('rejects a partially successful terminal %s read', async (field) => {
    const partial = zombie()
    Object.assign(partial[field], entry(33, { parentPid: 22, rssBytes: '0', identity: { status: 5, zombie: true } })[field])
    const report = await rejected([], [], [partial], [partial])
    if (field === 'task') {
      expect(report.nativeFrames?.[2]?.rows.find(row => row.pid === 33)?.rss.bytes).toBe('0')
    }
  })

  it.each(['before', 'after'] as const)('requires a complete stable %s terminal identity', async (field) => {
    const partial = zombie()
    partial[field] = { result: 0, length: 0, errno: 0, identity: null }
    await rejected([partial], [partial], [partial], [partial])
  })

  it('rejects disagreeing UID credentials within a terminal frame', async () => {
    const changed = zombie()
    changed.after.identity!.uid = 502
    await rejected([changed], [changed], [changed], [changed])
  })

  it('requires kernel zombie status as well as the zombie flag', async () => {
    const incomplete = zombie()
    incomplete.before.identity!.status = incomplete.after.identity!.status = 2
    await rejected([incomplete], [incomplete], [incomplete], [incomplete])
  })

  it.each(['immediate-live', 'exit-then-live', 'absence-then-live'] as const)('keeps a terminal task followed by %s blocking', async (kind) => {
    const live = entry(33, { parentPid: 22 })
    const middle = kind === 'immediate-live' ? [live] : kind === 'exit-then-live' ? [exited()] : []
    const report = await rejected([zombie()], middle, [live], [live])
    expect(report.identityChangedProcesses).toEqual(expect.arrayContaining([expect.objectContaining({ pid: 33 })]))
  })

  it('rejects a zombie reappearing after a complete exit', async () => {
    await rejected([zombie()], [exited()], [], [zombie()])
  })
})
