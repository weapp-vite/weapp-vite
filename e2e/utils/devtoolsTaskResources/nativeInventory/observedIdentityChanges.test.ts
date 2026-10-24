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
const otherForeign = '/System/Library/OtherForeign'

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

describe('observed native identity and image changes remain blocking', () => {
  it.each(['start', 'parent', 'zombie'] as const)('retains a successful task-record %s mismatch even for a foreign process', async (difference) => {
    const changed = entry(22)
    const taskIdentity = changed.task.identity!
    if (difference === 'start') {
      taskIdentity.startedMicroseconds = '123457'
    }
    else if (difference === 'parent') {
      taskIdentity.parentPid = 2
    }
    else {
      taskIdentity.status = 5
      taskIdentity.zombie = true
    }
    const baseline = [entry(11), entry(22)]
    frames(baseline, [entry(11), changed], baseline, baseline)
    expect(await sample()).toMatchObject({
      installationRssBytes: { status: 'unavailable' },
      unclassifiedProcesses: [{ pid: 22, causes: expect.arrayContaining([{ reason: 'identity-changed', firstObserved: { round: 1, phase: 'anchor' } }]) }],
      identityChangedProcesses: [{ pid: 22, reasons: [difference === 'start' ? 'started-changed' : difference === 'parent' ? 'parent-changed' : 'zombie-changed'], changedTo: { parentPid: taskIdentity.parentPid, startedMicroseconds: taskIdentity.startedMicroseconds, zombie: taskIdentity.zombie }, firstObserved: { round: 1, phase: 'anchor' } }],
    })
  })

  it('keeps denied task reads distinct from observed identity changes on verified foreign processes', async () => {
    frames(...phases.map(() => [entry(11), entry(22, { rssBytes: null })]))
    expect(await sample()).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, identityChangedProcessCount: 0 })
  })

  it('cannot overwrite a conflicting direct anchor image with equal fallback observations', async () => {
    frames(
      [entry(11), entry(22, { executable: null })],
      [entry(11), entry(22, { executable: otherForeign })],
      [entry(11), entry(22, { executable: null })],
      [entry(11), entry(22, { executable: null })],
    )
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.unclassifiedProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 22, causes: expect.arrayContaining([expect.objectContaining({ reason: 'image-changed' })]) }),
    ]))
  })

  it('checks a backfilled closure proof against the already observed next direct image', async () => {
    const baseline = [entry(11), entry(22)]
    frames(
      baseline,
      baseline,
      [...baseline, entry(33, { executable: null })],
      [...baseline, entry(33, { executable: otherForeign })],
    )
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.newProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 33, causes: expect.arrayContaining([expect.objectContaining({ reason: 'image-changed' })]) }),
    ]))
  })
  it('retains one successful conflicting direct path when its paired read fails', async () => {
    const baseline = [entry(11), entry(22)]
    const partial = entry(22, { executable: otherForeign })
    partial.pathAfter = { count: 0, errno: 2, executable: null }
    frames(baseline, baseline, [entry(11), partial], baseline)
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.unclassifiedProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 22, causes: expect.arrayContaining([expect.objectContaining({ reason: 'image-changed' })]) }),
    ]))
  })

  it('retains selected text images first observed after the anchor on an existing foreign identity', async () => {
    mocks.images.mockResolvedValue([fixtureForeign, fixtureSelected])
    const baseline = [entry(11), entry(22)]
    frames(baseline, baseline, [entry(11), entry(22, { executable: null })], baseline)
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.missingIdentities).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 22 }),
    ]))
  })
  it.each(['before', 'after'] as const)('retains a successful fallback image conflict when the %s query fails', async (failedQuery) => {
    if (failedQuery === 'before') {
      mocks.images.mockRejectedValueOnce(new Error('Fixture before query failed')).mockResolvedValueOnce([fixtureForeign])
    }
    else {
      mocks.images.mockResolvedValueOnce([fixtureForeign]).mockRejectedValueOnce(new Error('Fixture after query failed'))
    }
    const stableDirect = [entry(11), entry(22, { executable: otherForeign })]
    frames([entry(11), entry(22, { executable: null })], stableDirect, stableDirect, stableDirect)
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.unclassifiedProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 22, causes: expect.arrayContaining([expect.objectContaining({ reason: 'image-changed' })]) }),
    ]))
  })

  it('compares a successful task identity with sysctl-after when sysctl-before is unavailable', async () => {
    const baseline = [entry(11), entry(22)]
    const partial = entry(22)
    partial.before = { result: 0, length: 0, errno: 0, identity: null }
    partial.task.identity!.startedMicroseconds = '123457'
    frames(baseline, baseline, [entry(11), partial], baseline)
    const report = await sample()
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.identityChangedProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 22, reasons: ['started-changed'], changedTo: expect.objectContaining({ startedMicroseconds: '123457' }), firstObserved: { round: 2, phase: 'closure1' } }),
    ]))
  })
  it('retains a changed text-image observation across windows when its later pair fails', async () => {
    mocks.images.mockResolvedValueOnce([fixtureForeign]).mockResolvedValueOnce([fixtureForeign]).mockResolvedValueOnce([otherForeign]).mockRejectedValueOnce(new Error('Fixture later query failed'))
    const baseline = [entry(11), entry(22, { executable: null })]
    frames(baseline, baseline, baseline, baseline)
    const report = await sample()
    expect(mocks.images).toHaveBeenCalledTimes(4)
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.unclassifiedProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ pid: 22, causes: expect.arrayContaining([expect.objectContaining({ reason: 'image-changed' })]) }),
    ]))
  })
})
