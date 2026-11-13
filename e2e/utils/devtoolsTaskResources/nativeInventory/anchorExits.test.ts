import type { DarwinProcessEntry } from '../processInventory/darwinInspector/types'
import type { InstallationProcessSample } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureForeign, fixtureInstallation, fixtureSelected, frame } from './fixture'
import { sampleNativeInstallationProcesses } from './index'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn(), execute: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('execa', () => ({ execa: mocks.execute }))

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
const target = {} as Parameters<typeof sampleNativeInstallationProcesses>[0]

function exited(pid = 33, parentPid = 1): DarwinProcessEntry {
  return {
    ...entry(pid, { parentPid }),
    before: { result: 0, length: 0, errno: 0, identity: null },
    after: { result: 0, length: 0, errno: 0, identity: null },
    pathBefore: { count: 0, errno: 3, executable: null },
    pathAfter: { count: 0, errno: 3, executable: null },
    task: { count: 0, errno: 3, identity: null, rssBytes: null },
    gaps: ['identity-before-unavailable', 'identity-after-unavailable', 'image-before-unavailable', 'image-after-unavailable', 'rss-unavailable'],
  }
}

function exitedWithReadableIdentity(pid = 33, parentPid = 1): DarwinProcessEntry {
  const row = entry(pid, { parentPid })
  row.pathBefore = row.pathAfter = { count: 0, errno: 3, executable: null }
  row.task = { count: 0, errno: 3, identity: null, rssBytes: null }
  row.gaps = ['image-before-unavailable', 'image-after-unavailable', 'rss-unavailable']
  row.absolute = {
    clockDomain: 'mach-absolute-ticks',
    startedAtTicks: '1000',
    endedAtTicks: '2000',
    birthBefore: { result: 0, errno: 0, startedAtTicks: '1100', endedAtTicks: '1110', birthTicks: '500', exitTicks: '1050' },
    birthAfter: { result: 0, errno: 0, startedAtTicks: '1200', endedAtTicks: '1210', birthTicks: '500', exitTicks: '1050' },
  }
  return row
}

function frames(...rows: DarwinProcessEntry[][]) {
  mocks.read.mockImplementation(async (phase: typeof phases[number]) => {
    const observed = rows[phases.indexOf(phase)]!
    const baseline = [entry(11), entry(22)].filter(row => !observed.some(value => value.pid === row.pid))
    return frame(phase, structuredClone([...baseline, ...observed]))
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
  return result.value
}

async function rejected(...rows: DarwinProcessEntry[][]) {
  frames(...rows)
  const report = await sample()
  expect(report).toMatchObject({ installationRssBytes: { status: 'unavailable' }, verifiedTerminalProcessCount: 0, verifiedTerminalProcesses: [] })
  return report
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue(fixtureInstallation)
  mocks.prepare.mockResolvedValue({ executable: 'owned-test-helper' })
  mocks.inspect.mockImplementation(async (_deadline, consume) => consume({ readFrame: mocks.read }))
  mocks.images.mockResolvedValue([fixtureForeign])
})
afterEach(() => vi.restoreAllMocks())

describe('complete native exit at the RSS anchor', () => {
  it.each([1, 22])('retains a prepared foreign process with parent %s and an explicit anchor exit', async (parentPid) => {
    const live = entry(33, { parentPid, rssBytes: '9000000' })
    frames([entry(11, { rssBytes: '7000' }), live], [exited(33, parentPid)], [], [])
    const report = await sample()
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      verifiedMemberRssBytes: 1000,
      verifiedTerminalProcessCount: 1,
      identityChangedProcessCount: 1,
      unclassifiedProcessCount: 0,
      missingIdentityCount: 0,
      newSelectedProcessCount: 0,
    })
    expect(report.processes).toEqual([expect.objectContaining({ pid: 11, rssBytes: 1000 })])
    expect(report.verifiedTerminalProcesses).toEqual([expect.objectContaining({
      process: expect.objectContaining({ pid: 33, final: null }),
      terminalIdentity: expect.objectContaining({ pid: 33, started: 'unverified', startedSeconds: null, startedMicroseconds: null, status: null }),
      firstTerminalPhase: 'anchor',
      proof: 'prepare-proven-foreign-then-anchor-exit',
      phases,
      ancestry: parentPid === 1 ? [] : [expect.objectContaining({ pid: 22 })],
    })])
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({ pid: 33, reasons: expect.arrayContaining(['started-changed', 'parent-changed']) })])
    expect(report.nativeFrames?.[1]?.rows.find(row => row.pid === 33)).toMatchObject({
      enumeratedIdentity: { pid: 33, parentPid },
      before: null,
      after: null,
      pathBefore: { count: 0, errno: 3, image: null },
      pathAfter: { count: 0, errno: 3, image: null },
      rss: { count: 0, errno: 3, identity: null, bytes: null },
      gaps: exited().gaps,
    })
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it('accepts explicit ESRCH identity reads and repeated complete exit observations', async () => {
    const gone = exited()
    gone.before = gone.after = { result: -1, length: 648, errno: 3, identity: null }
    frames([entry(33)], [gone], [gone], [gone])
    const report = await sample()
    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedTerminalProcessCount: 1, identityChangedProcessCount: 1 })
    expect(report.verifiedTerminalProcesses?.[0]?.terminalIdentity.startedSeconds).toBeNull()
    expect(report.nativeFrames?.slice(1).map(value => value.rows.find(row => row.pid === 33)?.before)).toEqual([null, null, null])
  })

  it('proves a foreign anchor exit when prepare RSS alone was denied', async () => {
    const live = entry(33, { rssBytes: null, identity: { uid: 0 } })
    live.gaps = ['rss-unavailable']
    frames([live], [exited()], [], [])
    const report = await sample()
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      closureOwnership: { status: 'observed', value: 'verified' },
      verifiedTerminalProcessCount: 1,
      identityChangedProcessCount: 1,
      verifiedTerminalProcesses: [{ process: { pid: 33 }, proof: 'prepare-proven-foreign-then-anchor-exit' }],
    })
    expect(report.processes).toEqual([expect.objectContaining({ pid: 11, rssBytes: 1000 })])
    expect(report.nativeFrames?.[0]?.rows.find(row => row.pid === 33)?.rss).toEqual({ count: 0, errno: 1, identity: null, bytes: null })
    expect(report.nativeFrames?.[1]?.rows.find(row => row.pid === 33)?.before).toBeNull()
  })

  it.each([
    ['task errno', (row: DarwinProcessEntry) => { row.task.errno = 3 }],
    ['task count', (row: DarwinProcessEntry) => { row.task.count = 232 }],
    ['task identity', (row: DarwinProcessEntry) => { row.task.identity = row.before.identity }],
    ['task RSS', (row: DarwinProcessEntry) => { row.task.rssBytes = '1000' }],
    ['missing RSS gap', (row: DarwinProcessEntry) => { row.gaps = [] }],
    ['extra gap', (row: DarwinProcessEntry) => { row.gaps.push('identity-before-unavailable') }],
    ['path denial', (row: DarwinProcessEntry) => { row.pathBefore.errno = 1 }],
    ['identity denial', (row: DarwinProcessEntry) => { row.before.errno = 1 }],
    ['UID drift', (row: DarwinProcessEntry) => { row.after.identity!.uid = 502 }],
    ['selected image', (row: DarwinProcessEntry) => { row.pathBefore.executable = row.pathAfter.executable = fixtureSelected }],
    ['selected ancestor', (row: DarwinProcessEntry) => { row.enumeratedIdentity.parentPid = row.before.identity!.parentPid = row.after.identity!.parentPid = 11 }],
    ['unknown ancestor', (row: DarwinProcessEntry) => { row.enumeratedIdentity.parentPid = row.before.identity!.parentPid = row.after.identity!.parentPid = 77 }],
  ] as const)('keeps RSS-denied preparation blocking for %s', async (_name, mutate) => {
    const live = entry(33, { rssBytes: null })
    live.gaps = ['rss-unavailable']
    mutate(live)
    await rejected([live], [exited(33, live.enumeratedIdentity.parentPid)], [], [])
  })

  it('accepts stable identity reads bracketed around a confirmed kernel exit', async () => {
    frames([entry(33)], [exitedWithReadableIdentity()], [], [])
    const report = await sample()
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      verifiedTerminalProcessCount: 1,
      unclassifiedProcessCount: 0,
      verifiedTerminalProcesses: [{ process: { pid: 33 }, proof: 'prepare-proven-foreign-then-anchor-exit' }],
    })
    expect(report.identityChangedProcessCount).toBe(0)
  })

  it.each([
    ['birth drift', (row: DarwinProcessEntry) => { row.absolute!.birthAfter.birthTicks = '501' }],
    ['exit drift', (row: DarwinProcessEntry) => { row.absolute!.birthAfter.exitTicks = '1051' }],
    ['live exit marker', (row: DarwinProcessEntry) => { row.absolute!.birthBefore.exitTicks = row.absolute!.birthAfter.exitTicks = '0' }],
    ['identity drift', (row: DarwinProcessEntry) => { row.after.identity!.startedMicroseconds = '123457' }],
    ['path permission failure', (row: DarwinProcessEntry) => { row.pathAfter.errno = 1 }],
    ['task permission failure', (row: DarwinProcessEntry) => { row.task.errno = 1 }],
  ] as const)('rejects readable-identity exit evidence with %s', async (_name, mutate) => {
    const gone = exitedWithReadableIdentity()
    mutate(gone)
    await rejected([entry(33)], [gone], [], [])
  })

  it.each(['before', 'after', 'pathBefore', 'pathAfter', 'task'] as const)('rejects an anchor %s permission failure', async (field) => {
    const gone = exited()
    gone[field].errno = 1
    await rejected([entry(33)], [gone], [], [])
  })

  it.each(['before', 'after', 'pathBefore', 'pathAfter', 'task'] as const)('rejects an anchor %s read that still succeeds', async (field) => {
    const gone = exited()
    Object.assign(gone[field], entry(33)[field])
    await rejected([entry(33)], [gone], [], [])
  })

  it.each(['before', 'after', 'pathBefore', 'pathAfter', 'task'] as const)('requires a successful prepare %s query', async (field) => {
    const live = entry(33)
    live[field].errno = 1
    await rejected([live], [exited()], [], [])
  })

  it.each(['before', 'after', 'task'] as const)('requires a complete prepare %s identity', async (field) => {
    const live = entry(33)
    Object.assign(live[field], exited()[field])
    await rejected([live], [exited()], [], [])
  })

  it.each(['uid', 'start', 'pid'] as const)('rejects a prepare task %s mismatch', async (kind) => {
    const live = entry(33)
    if (kind === 'uid') {
      live.task.identity!.uid = 502
    }
    else if (kind === 'start') {
      live.task.identity!.startedMicroseconds = '123457'
    }
    else {
      live.task.identity!.pid = 34
    }
    await rejected([live], [exited()], [], [])
  })

  it('rejects disagreeing prepare UID credentials', async () => {
    const live = entry(33)
    live.after.identity!.uid = 502
    await rejected([live], [exited()], [], [])
  })

  it.each(['selected', 'descendant', 'unknown', 'unknown-ancestor'] as const)('keeps %s prepare membership blocking', async (relation) => {
    const live = entry(33, { parentPid: relation === 'descendant' ? 11 : relation === 'unknown' ? 77 : 22, executable: relation === 'selected' ? fixtureSelected : undefined })
    const ancestor = relation === 'unknown-ancestor' ? [entry(22, { parentPid: 77 })] : []
    await rejected([live, ...ancestor], [exited(33, live.enumeratedIdentity.parentPid)], [], [])
  })

  it.each(['selected', 'partial', 'uid'] as const)('requires a complete foreign prepare ancestor with %s evidence', async (kind) => {
    const ancestor = entry(22, kind === 'selected' ? { executable: fixtureSelected } : {})
    if (kind === 'partial') {
      Object.assign(ancestor.task, exited(22).task)
    }
    else if (kind === 'uid') {
      ancestor.after.identity!.uid = 502
    }
    await rejected([entry(33, { parentPid: 22 }), ancestor], [exited(33, 22)], [], [])
  })

  it.each(['closure1', 'closure2'] as const)('rejects a PID reappearing in %s with a live or zombie identity', async (phase) => {
    for (const identity of [{}, { startedMicroseconds: '123457' }, { status: 5, zombie: true }]) {
      const returned = entry(33, { identity })
      await rejected([entry(33)], [exited()], phase === 'closure1' ? [returned] : [], phase === 'closure2' ? [returned] : [])
      mocks.read.mockClear()
    }
  })

  it('rejects a cycle in the prepared foreign ancestry', async () => {
    await rejected([entry(33, { parentPid: 22 }), entry(22, { parentPid: 33 })], [exited(33, 22)], [], [])
  })

  it.each([fixtureSelected, '/System/Library/OtherForeign'])('retains a later ancestor text-image conflict with %s', async (executable) => {
    const ancestor = entry(22, { executable: null })
    ancestor.gaps = ['image-before-unavailable', 'image-after-unavailable']
    mocks.images.mockResolvedValue([executable])
    await rejected([entry(33, { parentPid: 22 })], [exited(33, 22)], [ancestor], [])
  })

  it('verifies the prepared first row even when its PID is one', async () => {
    const live = entry(1)
    live.task.errno = 1
    await rejected([live], [exited(1)], [], [])
  })

  it.each(['permission', 'partial'] as const)('rejects later %s evidence after an anchor exit', async (kind) => {
    const later = exited()
    if (kind === 'permission') {
      later.pathAfter.errno = 1
    }
    else {
      Object.assign(later.task, entry(33).task)
    }
    await rejected([entry(33)], [exited()], [later], [])
  })

  it('does not infer a prepared identity for an exited PID first seen at the anchor', async () => {
    await rejected([], [exited()], [], [])
  })

  it('does not substitute text-image fallback for complete prepare kernel evidence', async () => {
    const live = entry(33)
    live.pathBefore = live.pathAfter = { count: 0, errno: 1, executable: null }
    live.gaps = ['image-before-unavailable', 'image-after-unavailable']
    await rejected([live], [exited()], [], [])
  })
})
