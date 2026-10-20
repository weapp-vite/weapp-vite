import type { ResolvedWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { ProcessRow } from './index'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleInstallationProcesses } from '../processes'
import { processGapObservation } from './evidence'
import { inspectResourceRows } from './index'

const mocks = vi.hoisted(() => ({ ps: vi.fn(), paths: vi.fn(), images: vi.fn(), realpath: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.ps }))
vi.mock('node:fs/promises', () => ({ default: { realpath: mocks.realpath } }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwinKernelPaths', () => ({ readDarwinKernelPaths: mocks.paths }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => '/Applications/Selected.app' }))

const executable = '/Applications/Selected.app/Contents/MacOS/Electron'
const foreignImage = '/System/Library/Foreign'
const started = 'Mon Oct 19 10:00:00 2026'
const changedStarted = 'Mon Oct 19 10:00:01 2026'
const target = { installationId: 'selected' } as ResolvedWechatDevtoolsTarget
const row = (pid: number, parentPid = 1, birth = started, state = 'S') => `${pid} ${parentPid} 10 ${state} ${birth}`
const initial = [row(11), row(22, 11), row(33)].join('\n')
const identity = (pid: number, parentPid = 1, birth = started, zombie = false) => ({ pid, parentPid, started: birth, zombie })

function inventories(...values: string[]) {
  for (const stdout of values) {
    mocks.ps.mockImplementationOnce(() => Object.assign(Promise.resolve({ stdout, stderr: '', exitCode: 0 }), { pid: 99 }))
  }
}

async function sample() {
  const result = await sampleInstallationProcesses(target, 'darwin')
  expect(result.status).toBe('observed')
  if (result.status !== 'observed') {
    throw new Error(result.reason)
  }
  expect(result.value.unclassifiedProcesses).toHaveLength(result.value.unclassifiedProcessCount)
  expect(result.value.missingIdentities).toHaveLength(result.value.missingIdentityCount)
  expect(result.value.identityChangedProcesses).toHaveLength(result.value.identityChangedProcessCount)
  return result.value
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(0)
  mocks.realpath.mockResolvedValue('/Applications/Selected.app')
  mocks.paths.mockImplementation(async (pids: number[]) => new Map(pids.map(pid => [pid, pid === 11 || pid === 22 ? executable : foreignImage])))
})
afterEach(() => vi.restoreAllMocks())

describe('installation process sampling failure evidence', () => {
  it('keeps complete samples empty without adding inventory or image queries', async () => {
    inventories(initial, initial, initial)
    expect(await sample()).toMatchObject({ unclassifiedProcesses: [], missingIdentities: [], identityChangedProcesses: [], verifiedMemberRssBytes: 20 * 1024 })
    expect(mocks.ps).toHaveBeenCalledTimes(3)
    expect(mocks.paths).toHaveBeenCalledExactlyOnceWith([11, 22, 33], 10_000)
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it.each([
    ['text-images-query-failed', new Error(foreignImage)],
    ['text-images-empty', []],
    ['text-images-invalid', ['relative-unverifiable']],
  ])('records a stable fallback gap without exposing queried images or errors (%s)', async (reason, images) => {
    inventories(initial, initial, initial)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, executable], [33, null]]))
    if (images instanceof Error) {
      mocks.images.mockRejectedValue(images)
    }
    else {
      mocks.images.mockResolvedValue(images)
    }
    const result = await sample()
    expect(result).toMatchObject({ unclassifiedProcesses: [{ ...identity(33), final: identity(33), causes: [{ reason, firstObserved: { round: 1, phase: 'fallback' } }] }], missingIdentities: [], identityChangedProcesses: [] })
    expect(result.installationRssBytes.status).toBe('unavailable')
    expect(JSON.stringify(result)).not.toContain(foreignImage)
    expect(JSON.stringify(result)).not.toContain('relative-unverifiable')
    expect(mocks.images).toHaveBeenCalledExactlyOnceWith(33, 10_000)
    expect(mocks.ps).toHaveBeenCalledTimes(3)
  })

  it.each([undefined, 'relative-unverifiable'])('records an unverified kernel image without creating a fallback (%s)', async (image) => {
    inventories(initial, initial, initial)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, executable], [33, image]]))
    expect(await sample()).toMatchObject({ unclassifiedProcesses: [{ ...identity(33), causes: [{ reason: 'kernel-path-unverifiable', firstObserved: { round: 1, phase: 'after-kernel' } }] }] })
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it('records undispatched fallback identities at the existing budget boundary', async () => {
    inventories(initial, initial)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, executable], [33, null]]))
    vi.mocked(Date.now).mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(10_000)
    const rows: ProcessRow[] = [11, 22, 33].map(pid => ({ ...identity(pid, pid === 22 ? 11 : 1), rssBytes: 10 * 1024 }))
    const result = await inspectResourceRows(rows, 10_000)
    expect(result.fallbackBudgetExhausted).toBe(true)
    expect(result.imageGaps.get(33)).toEqual({ reason: 'fallback-budget-exhausted', firstObserved: { round: 1, phase: 'fallback' } })
    expect(mocks.images).not.toHaveBeenCalled()
    expect(mocks.ps).toHaveBeenCalledTimes(2)
    expect(Date.now).toHaveBeenCalledTimes(4)
  })

  it('retains the first absence when the same seconds-resolution identity returns', async () => {
    inventories(initial, [row(11), row(22, 11)].join('\n'), initial)
    const result = await sample()
    expect(result).toMatchObject({
      unclassifiedProcesses: [{ ...identity(33), final: identity(33), causes: [
        { reason: 'process-absent', firstObserved: { round: 1, phase: 'after-kernel' } },
        { reason: 'identity-changed', firstObserved: { round: 1, phase: 'after-fallback' } },
      ] }],
      identityChangedProcesses: [{ ...identity(33), changedTo: identity(33), reasons: ['returned-after-absence'], firstObserved: { round: 1, phase: 'after-fallback' } }],
    })
    expect(result.installationRssBytes.status).toBe('unavailable')
  })

  it('records a selected identity that remains absent without inventing a change', async () => {
    const absent = [row(22, 11), row(33)].join('\n')
    inventories(initial, absent, absent)
    expect(await sample()).toMatchObject({ missingIdentities: [{ ...identity(11), final: null, causes: [{ reason: 'process-absent', firstObserved: { round: 1, phase: 'after-kernel' } }] }], identityChangedProcesses: [] })
  })

  it.each([
    [row(11, 33), identity(11, 33), 'parent-changed'],
    [row(11, 1, changedStarted), identity(11, 1, changedStarted), 'started-changed'],
    [row(11, 1, started, 'Z'), identity(11, 1, started, true), 'zombie-changed'],
  ])('keeps the first changed identity after the process restores its original fields (%s)', async (replacement, changedTo, reason) => {
    inventories(initial, [replacement, row(22, 11), row(33)].join('\n'), initial)
    expect(await sample()).toMatchObject({
      missingIdentities: [{ ...identity(11), final: identity(11), causes: [{ reason: 'identity-changed', firstObserved: { round: 1, phase: 'after-kernel' } }] }],
      identityChangedProcesses: [{ ...identity(11), changedTo, reasons: [reason], firstObserved: { round: 1, phase: 'after-kernel' } }],
    })
  })

  it('preserves every simultaneous change when an absent PID returns and then changes again', async () => {
    const newProcess = row(44)
    const absent = [row(11), row(22, 11), newProcess].join('\n')
    const changed = [row(11), row(22, 11), row(33, 22, changedStarted, 'Z'), newProcess].join('\n')
    inventories(initial, absent, changed, `${initial}\n${newProcess}`, `${initial}\n${newProcess}`)
    const result = await sample()
    expect(result.identityChangedProcesses).toEqual([{ ...identity(33), changedTo: identity(33, 22, changedStarted, true), reasons: ['returned-after-absence', 'started-changed', 'parent-changed', 'zombie-changed'], firstObserved: { round: 2, phase: 'after-kernel' } }])
    expect(result.unclassifiedProcesses[0]!.causes).toEqual([
      { reason: 'process-absent', firstObserved: { round: 1, phase: 'after-kernel' } },
      { reason: 'identity-changed', firstObserved: { round: 2, phase: 'after-kernel' } },
    ])
    expect(result.unclassifiedProcesses[0]!.final).toEqual(identity(33))
  })

  it('labels the outer fallback observation as round one after an eager second round', async () => {
    const later = `${initial}\n${row(44)}`
    const changed = [row(11, 33), row(22, 11), row(33), row(44)].join('\n')
    inventories(initial, later, later, later, changed)
    expect(await sample()).toMatchObject({ identityChangedProcesses: [{ ...identity(11), changedTo: identity(11, 33), reasons: ['parent-changed'], firstObserved: { round: 1, phase: 'after-fallback' } }] })
  })

  it('retains an image-query gap alongside a later identity absence', async () => {
    inventories(initial, initial, [row(11), row(22, 11)].join('\n'))
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, executable], [33, null]]))
    mocks.images.mockRejectedValue(new Error('fixture inspection failed'))
    expect(await sample()).toMatchObject({ unclassifiedProcesses: [{ ...identity(33), final: null, causes: [
      { reason: 'text-images-query-failed', firstObserved: { round: 1, phase: 'fallback' } },
      { reason: 'process-absent', firstObserved: { round: 1, phase: 'after-fallback' } },
    ] }], identityChangedProcesses: [] })
  })

  it('records the original zombie state for a selected identity without counting it as unclassified', async () => {
    const zombie = [row(11, 1, started, 'Z'), row(22, 11), row(33)].join('\n')
    inventories(zombie, zombie, zombie)
    expect(await sample()).toMatchObject({ unclassifiedProcesses: [], missingIdentities: [{ ...identity(11, 1, started, true), final: identity(11, 1, started, true), causes: [{ reason: 'zombie', firstObserved: { round: 1, phase: 'initial' } }] }], identityChangedProcesses: [] })
  })

  it('gives an unverifiable selected descendant its own image gap', async () => {
    inventories(initial, initial, initial)
    mocks.paths.mockResolvedValue(new Map([[11, executable], [22, 'relative-unverifiable'], [33, foreignImage]]))
    const result = await sample()
    expect(result.unclassifiedProcesses).toEqual([{ ...identity(22, 11), final: identity(22, 11), causes: [{ reason: 'kernel-path-unverifiable', firstObserved: { round: 1, phase: 'after-kernel' } }] }])
    expect(result.missingIdentities).toEqual(result.unclassifiedProcesses)
  })

  it('does not copy argv, environment, command, RSS or future row fields into evidence', () => {
    const source = { ...identity(33), rssBytes: 100, argv: ['private'], environment: { secret: true }, command: 'private' }
    expect(processGapObservation(source, source, undefined, undefined)).toEqual({ ...identity(33), final: identity(33), causes: [] })
  })
})
