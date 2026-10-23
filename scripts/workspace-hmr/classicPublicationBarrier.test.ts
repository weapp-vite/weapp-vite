import type { NativePublicationProfileCursor, NativePublicationSourceEvidence } from '../../e2e/utils/nativePublication/files'
import type { ClassicPublicationBarrierOptions } from './classicPublicationBarrier'
import type { WorkspaceHmrStageReport } from './stageRecorder'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inspectSettledClassicPublication } from './classicPublicationBarrier'
import { createWorkspaceHmrStageRecorder } from './stageRecorder'

const profileCursor: NativePublicationProfileCursor = { offset: 12, prefixHash: 'a'.repeat(64) }

function fixture(mode: ClassicPublicationBarrierOptions<unknown>['mode'] = 'stateful-experimental') {
  const native = Promise.withResolvers<{ outputOffset: number, profileCursor?: NativePublicationProfileCursor, sourcePublications?: NativePublicationSourceEvidence[] }>()
  const ready = Promise.withResolvers<number>()
  const complete = Promise.withResolvers<void>()
  const stable = Promise.withResolvers<void>()
  const options: ClassicPublicationBarrierOptions<{ checkedFileCount: number }> = {
    mode,
    native: { wait: vi.fn(() => native.promise) },
    completion: { wait: vi.fn(() => complete.promise) },
    ready: vi.fn(() => ready.promise),
    stable: vi.fn(() => stable.promise),
    inspect: vi.fn(async () => ({ checkedFileCount: 3 })),
  }
  return { options, native, ready, complete, stable }
}

afterEach(() => vi.restoreAllMocks())

describe('workspace classic publication inspection barrier', () => {
  it('does not inspect the acknowledged fallback while its final native write still lacks END', async () => {
    const run = fixture()
    run.ready.resolve(10)
    run.native.resolve({ outputOffset: 20, profileCursor })
    const inspection = inspectSettledClassicPublication(run.options, { deadline: Date.now() + 1_000 })
    await vi.waitFor(() => expect(run.options.completion.wait).toHaveBeenCalledOnce())
    expect(run.options.inspect).not.toHaveBeenCalled()
    expect(run.options.stable).not.toHaveBeenCalled()
    run.complete.resolve()
    await vi.waitFor(() => expect(run.options.stable).toHaveBeenCalledOnce())
    expect(run.options.inspect).not.toHaveBeenCalled()
    run.stable.resolve()
    await expect(inspection).resolves.toEqual({ checkedFileCount: 3 })
    expect(run.options.completion.wait).toHaveBeenCalledWith(expect.any(Number), profileCursor)
    expect(run.options.inspect).toHaveBeenCalledOnce()
  })

  it('waits for cold classic readiness after the native receipt without demanding a nonexistent source END', async () => {
    const run = fixture()
    run.native.resolve({ outputOffset: 10 })
    const inspection = inspectSettledClassicPublication(run.options, { deadline: Date.now() + 1_000 })
    await vi.waitFor(() => expect(run.options.ready).toHaveBeenCalledOnce())
    expect(run.options.inspect).not.toHaveBeenCalled()
    expect(run.options.completion.wait).not.toHaveBeenCalled()
    run.ready.resolve(20)
    run.stable.resolve()
    await expect(inspection).resolves.toEqual({ checkedFileCount: 3 })
    expect(run.options.inspect).toHaveBeenCalledOnce()
  })

  it.each(['classic', 'stateful-experimental'] as const)('preserves all source identities inside the same %s inspection budget', async (mode) => {
    const run = fixture(mode)
    const sourcePublications = ['src/page.js', 'src/page.css'].map((file, index) => ({
      cursor: { ...profileCursor, identity: { buildId: `source-build-${index}`, batchId: `source-batch-${index}`, sourceEvents: [{ eventId: `source-event-${index}`, file }] } },
      files: [file],
    }))
    run.native.resolve({ outputOffset: 20, profileCursor, sourcePublications })
    run.ready.resolve(10)
    const inspection = inspectSettledClassicPublication(run.options, { deadline: Date.now() + 1_000 })
    await vi.waitFor(() => expect(run.options.completion.wait).toHaveBeenCalledOnce())
    expect(run.options.completion.wait).toHaveBeenCalledWith(expect.any(Number), sourcePublications)
    expect(run.options.stable).not.toHaveBeenCalled()
    expect(run.options.inspect).not.toHaveBeenCalled()
    run.complete.resolve()
    await vi.waitFor(() => expect(run.options.stable).toHaveBeenCalledOnce())
    run.stable.resolve()
    await expect(inspection).resolves.toEqual({ checkedFileCount: 3 })
    expect(run.options.inspect).toHaveBeenCalledOnce()
  })

  it.each(['restore', 'repeat'] as const)('uses the same current-source native write and completion contract for %s', async () => {
    const run = fixture('classic')
    run.native.resolve({ outputOffset: 20, profileCursor })
    run.ready.resolve(10)
    run.stable.resolve()
    const inspection = inspectSettledClassicPublication(run.options, { deadline: Date.now() + 1_000 })
    await vi.waitFor(() => expect(run.options.completion.wait).toHaveBeenCalledOnce())
    expect(run.options.inspect).not.toHaveBeenCalled()
    run.complete.resolve()
    await expect(inspection).resolves.toEqual({ checkedFileCount: 3 })
    expect(run.options.inspect).toHaveBeenCalledOnce()
  })

  it('retains post-write completion errors and never starts complete output inspection', async () => {
    const run = fixture('classic')
    const error = new Error('native style finalization failed')
    run.native.resolve({ outputOffset: 20, profileCursor })
    run.ready.resolve(10)
    run.options.completion.wait = vi.fn(async () => {
      throw error
    })
    await expect(inspectSettledClassicPublication(run.options, { deadline: Date.now() + 1_000 })).rejects.toBe(error)
    expect(run.options.inspect).not.toHaveBeenCalled()
  })

  it.each(['restore', 'repeat'] as const)('records the failed %s END separately from a successful cleanup publication', async (phase) => {
    const report: WorkspaceHmrStageReport = {}
    const stages = createWorkspaceHmrStageRecorder(report)
    const budget = Object.freeze({ deadline: Date.now() + 1_000 })
    const observe = stages.phase(phase, budget)
    const run = fixture('classic')
    run.options.observe = observe
    run.native.resolve({ outputOffset: 20, profileCursor })
    const error = Object.assign(new Error('formal END failed'), { code: 'ERR_FORMAL_END' })
    const inspection = observe('publication', () => inspectSettledClassicPublication(run.options, budget))
    const rejected = expect(inspection).rejects.toBe(error)
    await vi.waitFor(() => expect(run.options.completion.wait).toHaveBeenCalledOnce())
    run.complete.reject(error)
    await rejected

    expect(report.failedStage).toEqual({ phase, step: 'publication.formal-end' })
    expect(run.options.stable).not.toHaveBeenCalled()
    expect(run.options.inspect).not.toHaveBeenCalled()
    expect(report.stageTimings).toEqual([
      expect.objectContaining({ phase, step: 'publication', status: 'failed' }),
      expect.objectContaining({ phase, step: 'publication.native-receipt', status: 'complete' }),
      expect.objectContaining({ phase, step: 'publication.formal-end', status: 'failed', errorName: 'Error', errorCode: 'ERR_FORMAL_END' }),
    ])
    for (const timing of report.stageTimings ?? []) {
      expect(timing.elapsedMs).toBeGreaterThanOrEqual(0)
      expect(timing.remainingBeforeMs).toEqual(expect.any(Number))
      expect(timing.remainingAfterMs).toEqual(expect.any(Number))
    }

    const cleanup = fixture('classic')
    cleanup.options.observe = stages.phase('cleanup')
    cleanup.native.resolve({ outputOffset: 30, profileCursor })
    cleanup.complete.resolve()
    cleanup.stable.resolve()
    await expect(inspectSettledClassicPublication(cleanup.options, { deadline: Date.now() + 1_000 })).resolves.toEqual({ checkedFileCount: 3 })
    expect(cleanup.options.inspect).toHaveBeenCalledOnce()
    expect(report.failedStage).toEqual({ phase, step: 'publication.formal-end' })
    expect(report.cleanupFailedStage).toBeUndefined()
    expect(report.stageTimings?.filter(timing => timing.phase === 'cleanup')).toEqual([
      expect.objectContaining({ step: 'publication.native-receipt', status: 'complete' }),
      expect.objectContaining({ step: 'publication.formal-end', status: 'complete' }),
      expect.objectContaining({ step: 'publication.stable-output', status: 'complete' }),
      expect.objectContaining({ step: 'publication.inspect-output', status: 'complete' }),
    ])
  })

  it('does not accept a formal completion that arrives after the shared deadline', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)
    const run = fixture('classic')
    run.native.resolve({ outputOffset: 20, profileCursor })
    run.ready.resolve(10)
    const inspection = inspectSettledClassicPublication(run.options, { deadline: 200 })
    await vi.waitFor(() => expect(run.options.completion.wait).toHaveBeenCalledOnce())
    vi.spyOn(Date, 'now').mockReturnValue(201)
    run.complete.resolve()
    await expect(inspection).rejects.toThrow(/deadline|timed out/i)
    expect(run.options.stable).not.toHaveBeenCalled()
    expect(run.options.inspect).not.toHaveBeenCalled()
  })

  it('rejects a source write without its frozen profile cursor', async () => {
    const run = fixture('classic')
    run.native.resolve({ outputOffset: 20 })
    run.ready.resolve(10)
    run.complete.resolve()
    run.stable.resolve()
    await expect(inspectSettledClassicPublication(run.options, { deadline: Date.now() + 1_000 })).rejects.toThrow(/profile cursor/i)
    expect(run.options.inspect).not.toHaveBeenCalled()
  })

  it('preserves a complete inspection failure instead of retrying until outputs pass', async () => {
    const run = fixture('classic')
    const report: WorkspaceHmrStageReport = { failedStage: { phase: 'restore', step: 'publication.formal-end' } }
    run.options.observe = createWorkspaceHmrStageRecorder(report).phase('cleanup')
    run.native.resolve({ outputOffset: 20, profileCursor })
    run.ready.resolve(10)
    run.complete.resolve()
    run.stable.resolve()
    const error = new Error('Classic publication is missing shared.js')
    run.options.inspect = vi.fn(async () => {
      throw error
    })
    await expect(inspectSettledClassicPublication(run.options, { deadline: Date.now() + 1_000 })).rejects.toBe(error)
    expect(run.options.inspect).toHaveBeenCalledOnce()
    expect(report.failedStage).toEqual({ phase: 'restore', step: 'publication.formal-end' })
    expect(report.cleanupFailedStage).toEqual({ phase: 'cleanup', step: 'publication.inspect-output' })
  })
})
