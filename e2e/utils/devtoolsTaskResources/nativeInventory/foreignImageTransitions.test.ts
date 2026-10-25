import type { DarwinProcessEntry } from '../processInventory/darwinInspector/types'
import type { InstallationProcessSample } from '../types'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNativeInventory } from './closure'
import { entry, fixtureForeign, fixtureInstallation, fixtureSelected, frame } from './fixture'
import { sampleNativeInstallationProcesses } from './index'
import { normalizeNativeFrame } from './model'
import { summarizeNativeInventory } from './summary'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), inspect: vi.fn(), read: vi.fn(), images: vi.fn(), realpath: vi.fn(), execute: vi.fn() }))
vi.mock('../processInventory/darwinInspector', () => ({ prepareDarwinInspector: mocks.prepare, withDarwinInspector: mocks.inspect }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => fixtureInstallation }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('execa', () => ({ execa: mocks.execute }))

const phases = ['prepare', 'anchor', 'closure1', 'closure2'] as const
const target = {} as Parameters<typeof sampleNativeInstallationProcesses>[0]
const otherForeign = '/System/Library/OtherForeign'
const thirdForeign = '/System/Library/ThirdForeign'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function rows(images = [fixtureForeign, otherForeign, otherForeign, otherForeign]) {
  return images.map(executable => [entry(11), entry(22, { executable })])
}

async function sample(values: DarwinProcessEntry[][]): Promise<InstallationProcessSample> {
  mocks.read.mockImplementation(async (phase: typeof phases[number]) => frame(phase, structuredClone(values[phases.indexOf(phase)]!)))
  const result = await sampleNativeInstallationProcesses(target)
  expect(result.status, JSON.stringify(result)).toBe('observed')
  if (result.status !== 'observed') {
    throw new Error(result.reason)
  }
  expect(mocks.execute).not.toHaveBeenCalled()
  return result.value
}

async function blocked(values: DarwinProcessEntry[][]) {
  const report = await sample(values)
  expect(report.installationRssBytes.status).toBe('unavailable')
  expect(report.verifiedForeignImageTransitions ?? []).toEqual([])
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

describe('four-frame foreign image transitions are diagnostics outside selected RSS ownership', () => {
  it.each([1, 2, 3])('records an external image transition at boundary %s without counting its RSS', async (boundary) => {
    const images = phases.map((_, index) => index < boundary ? fixtureForeign : otherForeign)
    const report = await sample(rows(images))
    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, unclassifiedProcessCount: 0, identityChangedProcessCount: 0, verifiedForeignImageTransitionCount: 1 })
    expect(report.verifiedForeignImageTransitions).toEqual([
      expect.objectContaining({
        process: expect.objectContaining({ pid: 22, started: '1792800000.123456', causes: [{ reason: 'image-changed', firstObserved: expect.any(Object) }] }),
        from: { phase: phases[boundary - 1], image: { scope: 'outside-installation', sha256: hash(fixtureForeign) } },
        to: { phase: phases[boundary], image: { scope: 'outside-installation', sha256: hash(otherForeign) } },
        ancestry: [],
        proof: 'four-complete-native-foreign-frames',
      }),
    ])
    expect(report.nativeFrames?.map(value => value.rows.find(row => row.pid === 22)?.pathBefore.image?.sha256)).toEqual(images.map(hash))
    expect(JSON.stringify(report.verifiedForeignImageTransitions)).not.toContain(otherForeign)
    expect(JSON.stringify(report.verifiedForeignImageTransitions)).not.toContain('uid')
  })

  it('preserves both observed transitions when the original external path returns', async () => {
    const report = await sample(rows([fixtureForeign, otherForeign, fixtureForeign, fixtureForeign]))
    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedForeignImageTransitionCount: 2 })
    expect(report.verifiedForeignImageTransitions?.map(value => [value.from.phase, value.to.phase])).toEqual([['prepare', 'anchor'], ['anchor', 'closure1']])
  })

  it('keeps foreign task EPERM separate from complete image and sysctl identity proofs', async () => {
    const values = rows()
    values[0]![1] = entry(22, { rssBytes: null })
    expect(await sample(values)).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedForeignImageTransitionCount: 1 })
  })

  it.each(['process', 'ancestor'] as const)('keeps a verified foreign exec outside selected ownership when the %s changes credentials between complete frames', async (subject) => {
    const values = rows().map((value, index) => {
      const foreign = entry(22, { executable: value[1]!.pathBefore.executable, parentPid: subject === 'ancestor' ? 33 : 1 })
      const changed = subject === 'process' ? foreign : entry(33)
      for (const identity of [changed.before.identity, changed.after.identity, changed.task.identity]) {
        identity!.uid = index === 0 ? 0 : 501
      }
      if (index === 0) {
        changed.task = { count: 0, errno: 1, identity: null, rssBytes: null }
        changed.gaps = ['rss-unavailable']
      }
      return subject === 'process' ? [entry(11), foreign] : [entry(11), foreign, changed]
    })
    const report = await sample(values)
    expect(report).toMatchObject({
      installationRssBytes: { status: 'observed', value: 1000 },
      unclassifiedProcessCount: 0,
      identityChangedProcessCount: 0,
      verifiedForeignImageTransitionCount: 1,
    })
    expect(report.processes.map(process => process.pid)).toEqual([11])
    expect(report.verifiedForeignImageTransitions?.[0]?.process.causes).toContainEqual({ reason: 'image-changed', firstObserved: { round: 1, phase: 'anchor' } })
    expect(report.nativeFrames?.[0]?.rows.find(row => row.pid === (subject === 'process' ? 22 : 33))?.gaps).toEqual(['rss-unavailable'])
    expect(JSON.stringify(report)).not.toContain('"uid"')
  })

  it('verifies every foreign ancestor independently across all four frames', async () => {
    const values = rows().map(value => [value[0]!, { ...value[1]!, before: { ...value[1]!.before, identity: { ...value[1]!.before.identity!, parentPid: 33 } }, after: { ...value[1]!.after, identity: { ...value[1]!.after.identity!, parentPid: 33 } }, task: { ...value[1]!.task, identity: { ...value[1]!.task.identity!, parentPid: 33 } } }, entry(33)])
    const report = await sample(values)
    expect(report).toMatchObject({ installationRssBytes: { status: 'observed', value: 1000 }, verifiedForeignImageTransitionCount: 1 })
    expect(report.verifiedForeignImageTransitions?.[0]?.ancestry).toEqual([expect.objectContaining({ pid: 33, parentPid: 1, started: '1792800000.123456' })])
  })

  it.each(['selected', 'descendant', 'unknown', 'missing', 'identity', 'before-after-uid', 'task-uid', 'before-identity', 'after-identity', 'same-frame', 'partial', 'fallback'] as const)('rejects a %s proof ancestor', async (kind) => {
    const values = rows().map(value => [entry(11), entry(22, { executable: value[1]!.pathBefore.executable, parentPid: 33 }), entry(33)])
    if (kind === 'missing') {
      values[2]!.pop()
    }
    else {
      const ancestor = values[2]![2]!
      if (kind === 'selected') {
        ancestor.pathBefore.executable = ancestor.pathAfter.executable = fixtureSelected
      }
      else if (kind === 'descendant' || kind === 'unknown') {
        for (const identity of [ancestor.before.identity, ancestor.after.identity, ancestor.task.identity]) {
          identity!.parentPid = kind === 'descendant' ? 11 : 77
        }
      }
      else if (kind === 'identity') {
        for (const identity of [ancestor.before.identity, ancestor.after.identity, ancestor.task.identity]) {
          identity!.startedMicroseconds = '123457'
        }
      }
      else if (kind === 'before-after-uid') {
        ancestor.after.identity!.uid = 502
      }
      else if (kind === 'task-uid') {
        ancestor.task.identity!.uid = 502
      }
      else if (kind === 'before-identity' || kind === 'after-identity') {
        ancestor[kind === 'before-identity' ? 'before' : 'after'] = { result: 0, length: 0, errno: 0, identity: null }
      }
      else if (kind === 'same-frame') {
        ancestor.pathAfter.executable = otherForeign
      }
      else {
        ancestor.pathBefore = { count: 0, errno: 1, executable: null }
        if (kind === 'fallback') {
          ancestor.pathAfter = { ...ancestor.pathBefore }
        }
      }
    }
    await blocked(values)
  })

  it.each(['start', 'parent', 'zombie', 'task', 'before-after-uid', 'task-uid', 'before-identity', 'after-identity', 'absent-return', 'same-frame', 'partial', 'unknown', 'selected', 'descendant', 'fallback'] as const)('keeps a %s process gap blocking', async (kind) => {
    const values = rows()
    const changed = values[2]![1]!
    if (kind === 'absent-return') {
      values[2]!.pop()
    }
    else if (kind === 'same-frame') {
      changed.pathAfter.executable = thirdForeign
    }
    else if (kind === 'partial' || kind === 'unknown' || kind === 'fallback') {
      changed.pathBefore = { count: 0, errno: 1, executable: null }
      if (kind !== 'partial') {
        changed.pathAfter = { ...changed.pathBefore }
      }
      if (kind === 'unknown') {
        mocks.images.mockRejectedValue(new Error('Fixture image query failed'))
      }
    }
    else if (kind === 'selected') {
      changed.pathBefore.executable = changed.pathAfter.executable = fixtureSelected
    }
    else if (kind === 'task') {
      changed.task.identity!.startedMicroseconds = '123457'
    }
    else if (kind === 'before-identity' || kind === 'after-identity') {
      changed[kind === 'before-identity' ? 'before' : 'after'] = { result: 0, length: 0, errno: 0, identity: null }
    }
    else if (kind === 'before-after-uid') {
      changed.after.identity!.uid = 502
    }
    else if (kind === 'task-uid') {
      changed.task.identity!.uid = 502
    }
    else {
      for (const identity of [changed.before.identity, changed.after.identity, changed.task.identity]) {
        if (kind === 'start') {
          identity!.startedMicroseconds = '123457'
        }
        else if (kind === 'zombie') {
          identity!.zombie = true
          identity!.status = 5
        }
        else {
          identity!.parentPid = kind === 'descendant' ? 11 : 77
        }
      }
    }
    await blocked(values)
  })

  it('keeps selected ancestry observed before an otherwise foreign transition sticky', async () => {
    const values = rows()
    values[0]![1] = entry(22, { executable: fixtureSelected })
    await blocked(values)
  })

  it('retains a conflicting text observation even when every native frame has complete foreign paths', () => {
    const inventory = createNativeInventory(fixtureInstallation)
    rows().forEach((value, index) => inventory.observe(normalizeNativeFrame(frame(phases[index]!, value))))
    inventory.observeTextImages(22, [thirdForeign], 'closure1')
    const report = summarizeNativeInventory({ inventory, installationRoot: fixtureInstallation, samplingStartedAt: 'fixture', deadline: 10_000, textProofs: [], textObservations: [] })
    expect(report.installationRssBytes.status).toBe('unavailable')
    expect(report.verifiedForeignImageTransitions ?? []).toEqual([])
  })
})
