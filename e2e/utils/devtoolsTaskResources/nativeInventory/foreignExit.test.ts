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

function exited(pid: number): DarwinProcessEntry {
  return {
    ...entry(pid),
    before: { result: 0, length: 0, errno: 0, identity: null },
    pathBefore: { count: 0, errno: 3, executable: null },
    task: { count: 0, errno: 3, identity: null, rssBytes: null },
    pathAfter: { count: 0, errno: 3, executable: null },
    after: { result: 0, length: 0, errno: 0, identity: null },
    gaps: ['identity-before-unavailable', 'identity-after-unavailable', 'image-before-unavailable', 'image-after-unavailable', 'rss-unavailable'],
  }
}

function frames(...rows: DarwinProcessEntry[][]) {
  mocks.read.mockImplementation(async (phase: typeof phases[number]) => frame(phase, structuredClone(rows[phases.indexOf(phase)]!)))
}

async function sample(): Promise<InstallationProcessSample> {
  const result = await sampleNativeInstallationProcesses(target)
  expect(result.status, JSON.stringify(result)).toBe('observed')
  if (result.status !== 'observed') {
    throw new Error(result.reason)
  }
  expect(mocks.execute).not.toHaveBeenCalled()
  expect(mocks.read.mock.calls.map(([phase]) => phase)).toEqual(phases)
  return result.value
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

describe('anchor-proven foreign process exits during closure enumeration', () => {
  it.each(['closure1', 'closure2'] as const)('retains its anchor proof and original %s ESRCH row', async (phase) => {
    const baseline = [entry(11), entry(22)]
    const gone = [entry(11), exited(22)]
    frames(baseline, baseline, phase === 'closure1' ? gone : baseline, phase === 'closure1' ? [entry(11)] : gone)
    const report = await sample()
    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, identityChangedProcessCount: 0, unclassifiedProcessCount: 0 })
    expect(report.nativeFrames?.find(value => value.phase === phase)?.rows.find(row => row.pid === 22)).toMatchObject({
      before: null,
      after: null,
      pathBefore: { count: 0, errno: 3, image: null },
      pathAfter: { count: 0, errno: 3, image: null },
      rss: { count: 0, errno: 3, identity: null, bytes: null },
      gaps: exited(22).gaps,
    })
  })

  it('accepts explicit ESRCH identity reads and repeated exit rows without replacing RSS', async () => {
    const baseline = [entry(11), entry(22)]
    const gone = exited(22)
    gone.before = gone.after = { result: -1, length: 648, errno: 3, identity: null }
    frames(baseline, baseline, [entry(11), gone], [entry(11), gone])
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, identityChangedProcessCount: 0 })
  })

  it.each(['installation-image', 'descendant', 'unknown'] as const)('keeps an exiting %s blocking', async (relation) => {
    const pid = relation === 'installation-image' ? 11 : 22
    const observed = relation === 'descendant' ? entry(22, { parentPid: 11 }) : relation === 'unknown' ? entry(22, { parentPid: 77 }) : entry(22)
    const baseline = [entry(11), observed]
    frames(baseline, baseline, [...baseline.filter(row => row.pid !== pid), exited(pid)], baseline.filter(row => row.pid !== pid))
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    if (relation === 'unknown') {
      expect(report.unclassifiedProcesses).toEqual(expect.arrayContaining([expect.objectContaining({ pid })]))
    }
    else {
      expect(report.missingIdentities).toEqual(expect.arrayContaining([expect.objectContaining({ pid })]))
    }
  })

  it('does not infer foreign membership for a newly enumerated exited PID', async () => {
    const baseline = [entry(11), entry(22)]
    frames(baseline, baseline, [...baseline, exited(33)], baseline)
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'unavailable' }, uninspectedNewProcessCount: 1 })
  })

  it('records a complete anchor exit separately from a foreign live anchor proof', async () => {
    const baseline = [entry(11), entry(22)]
    frames(baseline, [entry(11), exited(22)], [entry(11)], [entry(11)])
    const report = await sample()
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      identityChangedProcessCount: 1,
      unclassifiedProcessCount: 0,
      verifiedTerminalProcessCount: 1,
      verifiedTerminalProcesses: [{ process: { pid: 22 }, firstTerminalPhase: 'anchor', proof: 'prepare-proven-foreign-then-anchor-exit' }],
    })
    expect(report.identityChangedProcesses).toEqual([expect.objectContaining({ pid: 22 })])
    expect(report.nativeFrames?.[1]?.rows.find(row => row.pid === 22)).toMatchObject({ before: null, after: null, rss: { bytes: null }, gaps: exited(22).gaps })
  })

  it.each(['before', 'after', 'pathBefore', 'pathAfter', 'task'] as const)('keeps a %s permission failure blocking', async (field) => {
    const baseline = [entry(11), entry(22)]
    const denied = exited(22)
    denied[field].errno = 1
    frames(baseline, baseline, [entry(11), denied], [entry(11)])
    expect((await sample()).installationRssBytes.status).toBe('unavailable')
  })

  it.each(['before', 'after', 'task'] as const)('keeps a partially successful %s identity read blocking', async (field) => {
    const baseline = [entry(11), entry(22)]
    const partial = exited(22)
    Object.assign(partial[field], entry(22)[field])
    frames(baseline, baseline, [entry(11), partial], [entry(11)])
    expect((await sample()).installationRssBytes.status).toBe('unavailable')
  })

  it.each([false, true])('keeps returned-after-absence evidence with changed identity=%s', async (reused) => {
    const baseline = [entry(11), entry(22)]
    const returned = entry(22, reused ? { identity: { startedMicroseconds: '123457' } } : {})
    frames(baseline, baseline, [entry(11), exited(22)], [entry(11), returned])
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.identityChangedProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 22, reasons: expect.arrayContaining(['returned-after-absence']) }),
    ]))
  })

  it.each([fixtureSelected, '/System/Library/OtherForeign'])('retains an observed image change to %s before the exit', async (executable) => {
    frames([entry(11), entry(22)], [entry(11), entry(22, { executable })], [entry(11), exited(22)], [entry(11)])
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.unclassifiedProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 22, causes: expect.arrayContaining([expect.objectContaining({ reason: 'image-changed' })]) }),
    ]))
  })
})
