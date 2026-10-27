import type { DarwinProcessEntry } from '../processInventory/darwinInspector/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entry, fixtureForeign, fixtureInstallation, fixtureSelected, frame } from './fixture'
import { sampleNativeInstallationProcesses } from './index'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
const otherForeign = '/System/Library/OtherForeign'
const target = {} as Parameters<typeof sampleNativeInstallationProcesses>[0]

function newProcessRows(firstIndex = 2, parentIndex = -1): DarwinProcessEntry[][] {
  return phases.map((_, index) => [
    entry(11),
    ...(index >= firstIndex ? [entry(22, { executable: index === firstIndex ? fixtureForeign : otherForeign, parentPid: parentIndex < 0 ? 1 : 33 })] : []),
    ...(parentIndex >= 0 && index >= parentIndex ? [entry(33)] : []),
  ])
}

async function sample(values: DarwinProcessEntry[][]) {
  mocks.read.mockImplementation(async (phase: typeof phases[number]) => frame(phase, structuredClone(values[phases.indexOf(phase)]!)))
  const result = await sampleNativeInstallationProcesses(target)
  expect(result.status, JSON.stringify(result)).toBe('observed')
  if (result.status !== 'observed') {
    throw new Error(result.reason)
  }
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

describe('new foreign execs retain complete evidence since their first observation', () => {
  it.each([1, 2])('excludes a foreign process first observed at index %s while preserving its exec evidence', async (firstIndex) => {
    const values = newProcessRows(firstIndex)
    const first = values[firstIndex]!.find(row => row.pid === 22)!
    first.task = { count: 0, errno: 1, identity: null, rssBytes: null }
    first.gaps = ['rss-unavailable']
    const report = await sample(values)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      verifiedMemberRssBytes: 1000,
      identityChangedProcessCount: 0,
      verifiedNewForeignProcessCount: 1,
      verifiedForeignImageTransitionCount: 1,
      newProcesses: [{ pid: 22, firstSeenRound: firstIndex, classification: 'verified-foreign', causes: [{ reason: 'image-changed' }] }],
      verifiedForeignImageTransitions: [{
        process: { pid: 22, causes: [{ reason: 'image-changed' }] },
        from: { phase: phases[firstIndex] },
        to: { phase: phases[firstIndex + 1] },
        ancestry: [],
        proof: 'complete-native-foreign-frames-since-first-observation',
        phases: phases.slice(firstIndex),
      }],
    })
    expect(report.processes.map(process => process.pid)).toEqual([11])
    expect(report.nativeFrames?.map(value => value.rows.some(row => row.pid === 22))).toEqual(phases.map((_, index) => index >= firstIndex))
    expect(JSON.stringify(report)).not.toContain('"uid"')
  })

  it.each([0, 1, 2])('verifies an ancestor first observed at index %s across its entire observed lifetime', async (parentIndex) => {
    const report = await sample(newProcessRows(2, parentIndex))
    expect(report.installationRssBytes).toEqual({ status: 'observed', value: 1000 })
    expect(report.verifiedForeignImageTransitions).toMatchObject([{ ancestry: [{ pid: 33, parentPid: 1 }], phases: ['closure1', 'closure2'] }])
  })

  it('counts one new foreign identity once when it executes twice', async () => {
    const values = newProcessRows(1)
    const last = values[3]!.find(row => row.pid === 22)!
    last.pathBefore.executable = last.pathAfter.executable = fixtureForeign
    const report = await sample(values)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      verifiedNewForeignProcessCount: 1,
      verifiedForeignImageTransitionCount: 2,
    })
    expect(report.verifiedForeignImageTransitions.map(value => [value.from.phase, value.to.phase])).toEqual([['anchor', 'closure1'], ['closure1', 'closure2']])
  })

  it('rejects an ancestor that first appears at anchor after a prepare-frame child in the same round', async () => {
    const report = await sample(newProcessRows(0, 1))
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedForeignImageTransitions).toEqual([])
  })

  it.each(['selected', 'descendant', 'unknown-parent'] as const)('retains %s ownership from the first complete new-process frame', async (kind) => {
    const values = newProcessRows()
    for (const value of values.slice(2)) {
      const row = value.find(row => row.pid === 22)!
      if (kind !== 'selected') {
        for (const identity of [row.before.identity, row.after.identity, row.task.identity]) {
          identity!.parentPid = kind === 'descendant' ? 11 : 77
        }
      }
    }
    if (kind === 'selected') {
      const first = values[2]!.find(row => row.pid === 22)!
      first.pathBefore.executable = first.pathAfter.executable = fixtureSelected
    }
    const report = await sample(values)
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedForeignImageTransitions).toEqual([])
  })

  it.each(['start', 'parent', 'zombie', 'task', 'uid', 'identity-read', 'same-frame', 'path-read', 'task-error', 'gap', 'selected', 'descendant', 'disappear'] as const)('keeps a new %s process blocking', async (kind) => {
    const values = newProcessRows(kind === 'disappear' ? 1 : 2)
    const changed = values[3]!.find(row => row.pid === 22)!
    if (kind === 'disappear') {
      values[3] = [entry(11)]
    }
    else if (kind === 'same-frame' || kind === 'selected') {
      changed.pathAfter.executable = kind === 'selected' ? fixtureSelected : fixtureForeign
    }
    else if (kind === 'path-read') {
      changed.pathBefore = { count: 0, errno: 1, executable: null }
    }
    else if (kind === 'identity-read') {
      changed.before.length = 0
    }
    else if (kind === 'task') {
      changed.task.identity!.startedMicroseconds = '654321'
    }
    else if (kind === 'uid') {
      changed.after.identity!.uid++
    }
    else if (kind === 'task-error') {
      changed.task = { count: 0, errno: 3, identity: null, rssBytes: null }
    }
    else if (kind === 'gap') {
      changed.gaps = ['rss-identity-mismatch']
    }
    else {
      for (const identity of [changed.before.identity, changed.after.identity, changed.task.identity]) {
        if (kind === 'start') {
          identity!.startedMicroseconds = '654321'
        }
        else if (kind === 'zombie') {
          identity!.zombie = true
        }
        else {
          identity!.parentPid = kind === 'descendant' ? 11 : 77
        }
      }
    }
    const report = await sample(values)
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedForeignImageTransitions).toEqual([])
  })

  it.each(['late', 'earlier-identity-change', 'earlier-selected', 'earlier-gap', 'cycle'] as const)('rejects a %s ancestor without borrowing later evidence', async (kind) => {
    const values = newProcessRows(2, kind === 'late' ? 3 : 0)
    const ancestor = values[0]!.find(row => row.pid === 33)
    if (kind === 'earlier-selected') {
      ancestor!.pathBefore.executable = ancestor!.pathAfter.executable = fixtureSelected
    }
    else if (kind === 'earlier-gap') {
      ancestor!.after.length = 0
    }
    else if (kind === 'earlier-identity-change') {
      for (const identity of [ancestor!.before.identity, ancestor!.after.identity, ancestor!.task.identity]) {
        identity!.startedMicroseconds = '654321'
      }
    }
    else if (kind === 'cycle') {
      for (const value of values) {
        const parent = value.find(row => row.pid === 33)!
        for (const identity of [parent.before.identity, parent.after.identity, parent.task.identity]) {
          identity!.parentPid = 22
        }
      }
    }
    const report = await sample(values)
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedForeignImageTransitions).toEqual([])
  })
})
