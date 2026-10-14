import type { BuildDiagnosticEvidence, BuildSample, DiagnosticCollection, DiagnosticPhase, DiagnosticSide } from './collection'
import { expect, it, vi } from 'vitest'
import { collectAutoImportBuildDiagnostics, diagnosticCollectionStatus } from './collection'

const output = { pageCount: 69, templateDigest: 'a'.repeat(64), configDigest: 'b'.repeat(64) }
const sample: BuildSample = { durationMs: 100, repeatDurationMs: 80, cliBuildMs: 40, repeatCliBuildMs: 30, output, repeatOutput: { ...output } }

function completeDiagnostic(phase: DiagnosticPhase): BuildDiagnosticEvidence {
  const started = { id: 1, pluginIndex: 0, pluginName: 'publication', hookName: 'generateBundle' as const, status: 'started' as const, timeOrigin: 1_000, startedAtMs: 10 }
  return {
    status: 'completed',
    durationMs: phase === 'first' ? sample.durationMs : sample.repeatDurationMs,
    timing: { cliBuildMs: phase === 'first' ? sample.cliBuildMs : sample.repeatCliBuildMs, matchedText: 'built in 30ms' },
    hooks: {
      events: [started, { ...started, status: 'completed', endedAtMs: 30, elapsedMs: 20 }],
      errors: [],
      terminal: { kind: 'producer-end', schemaVersion: 2, lastAssignedId: 1, pendingIds: [], timeOrigin: 1_000, endedAtMs: 30, drained: true, finalCloseHook: true },
    },
  }
}

function setup() {
  const state: DiagnosticCollection = { finished: false, samples: [], errors: [] }
  const snapshots: DiagnosticCollection[] = []
  const collectSample = vi.fn(async (_round: number, _side: DiagnosticSide) => structuredClone(sample))
  const readDiagnostic = vi.fn(async (_round: number, _side: DiagnosticSide, phase: DiagnosticPhase) => completeDiagnostic(phase))
  const checkpoint = vi.fn(async () => {
    snapshots.push(structuredClone(state))
  })
  return { state, snapshots, collectSample, readDiagnostic, checkpoint }
}

it('collects the original seven alternating pairs and both phases before declaring diagnostic completion', async () => {
  const options = setup()
  expect(diagnosticCollectionStatus(options.state, [])).toBe('collecting')
  await collectAutoImportBuildDiagnostics(options.state, options)
  expect(options.collectSample.mock.calls).toEqual([
    [0, 'baseline'],
    [0, 'candidate'],
    [1, 'candidate'],
    [1, 'baseline'],
    [2, 'baseline'],
    [2, 'candidate'],
    [3, 'candidate'],
    [3, 'baseline'],
    [4, 'baseline'],
    [4, 'candidate'],
    [5, 'candidate'],
    [5, 'baseline'],
    [6, 'baseline'],
    [6, 'candidate'],
  ])
  expect(options.readDiagnostic).toHaveBeenCalledTimes(28)
  expect(options.checkpoint).toHaveBeenCalledTimes(28)
  expect(options.state.samples).toHaveLength(14)
  expect(options.state.errors).toEqual([])
  expect(diagnosticCollectionStatus(options.snapshots[26]!, [])).toBe('collecting')
  expect(diagnosticCollectionStatus(options.snapshots[27]!, [])).toBe('collecting')
  expect(diagnosticCollectionStatus(options.state, [])).toBe('diagnostic-complete')
})

it('archives missing, incomplete and mismatching diagnostics per phase and still collects all original pairs', async () => {
  const options = setup()
  options.readDiagnostic.mockImplementation(async (round, side, phase) => {
    if (round === 0 && side === 'baseline' && phase === 'first') {
      throw new Error('missing diagnostic file')
    }
    const diagnostic = completeDiagnostic(phase)
    if (round === 0 && side === 'baseline' && phase === 'repeat') {
      diagnostic.hooks.errors.push('Missing hook invocation IDs: 2-3')
      diagnostic.hooks.terminal = null
    }
    if (round === 1 && side === 'candidate' && phase === 'first') {
      diagnostic.durationMs++
    }
    if (round === 1 && side === 'candidate' && phase === 'repeat') {
      diagnostic.timing.cliBuildMs = 999
      diagnostic.timing.matchedText = null
    }
    return diagnostic
  })
  await collectAutoImportBuildDiagnostics(options.state, options)
  expect(options.state.errors).toEqual([
    { round: 0, side: 'baseline', phase: 'first', problems: ['Unable to read or validate diagnostic: Error: missing diagnostic file'] },
    { round: 0, side: 'baseline', phase: 'repeat', problems: ['Missing or incomplete producer terminal', 'Missing hook invocation IDs: 2-3'] },
    { round: 1, side: 'candidate', phase: 'first', problems: ['Diagnostic measured duration differs from the original sample'] },
    { round: 1, side: 'candidate', phase: 'repeat', problems: ['Diagnostic CLI timing differs or has no original matched text'] },
  ])
  expect(options.snapshots[0]!.samples).toHaveLength(1)
  expect(options.snapshots[0]!.errors[0]).toMatchObject({ round: 0, side: 'baseline', phase: 'first' })
  expect(options.state.samples).toHaveLength(14)
  expect(options.readDiagnostic).toHaveBeenCalledTimes(28)
  expect(diagnosticCollectionStatus(options.state, [])).toBe('incomplete')
})

it.each(['build failure', 'configuration identity drift'] as const)('stops immediately and preserves the original %s', async (reason) => {
  const options = setup()
  const original = new Error(reason)
  options.collectSample.mockRejectedValueOnce(original)
  await expect(collectAutoImportBuildDiagnostics(options.state, options)).rejects.toBe(original)
  expect(options.collectSample).toHaveBeenCalledOnce()
  expect(options.readDiagnostic).not.toHaveBeenCalled()
  expect(options.state.samples).toEqual([])
  expect(diagnosticCollectionStatus(options.state, [String(original)])).toBe('incomplete')
})

it.each(['output', 'repeatOutput'] as const)('stops before the next pair when original %s evidence differs', async (field) => {
  const options = setup()
  options.collectSample.mockImplementation(async (_round, side) => {
    const result = structuredClone(sample)
    if (side === 'candidate') {
      result[field].configDigest = 'c'.repeat(64)
    }
    return result
  })
  await expect(collectAutoImportBuildDiagnostics(options.state, options)).rejects.toThrow('Original emitted page/template/config evidence differs')
  expect(options.collectSample).toHaveBeenCalledTimes(2)
  expect(options.state.samples).toHaveLength(2)
  expect(options.readDiagnostic).toHaveBeenCalledTimes(4)
  expect(options.state.errors).toEqual([])
})

it('preserves completed sample evidence when the next build fails', async () => {
  const options = setup()
  const original = new Error('second build failed')
  options.collectSample.mockResolvedValueOnce(structuredClone(sample)).mockRejectedValueOnce(original)
  await expect(collectAutoImportBuildDiagnostics(options.state, options)).rejects.toBe(original)
  expect(options.state.samples).toHaveLength(1)
  expect(options.readDiagnostic).toHaveBeenCalledTimes(2)
  expect(options.snapshots.at(-1)!.samples).toEqual(options.state.samples)
})

it('keeps the final repeat collecting until its diagnostic and the final pair have completed', async () => {
  const options = setup()
  let reachedFinalRepeat: () => void = () => {}
  const reached = new Promise<void>((resolve) => {
    reachedFinalRepeat = resolve
  })
  let finishFinalRepeat: (diagnostic: BuildDiagnosticEvidence) => void = () => {}
  const pending = new Promise<BuildDiagnosticEvidence>((resolve) => {
    finishFinalRepeat = resolve
  })
  options.readDiagnostic.mockImplementation(async (round, side, phase) => {
    if (round === 6 && side === 'candidate' && phase === 'repeat') {
      reachedFinalRepeat()
      return pending
    }
    return completeDiagnostic(phase)
  })
  const collecting = collectAutoImportBuildDiagnostics(options.state, options)
  await reached
  expect(options.state.samples).toHaveLength(14)
  expect(options.snapshots).toHaveLength(27)
  expect(options.state.finished).toBe(false)
  expect(diagnosticCollectionStatus(options.state, [])).toBe('collecting')
  finishFinalRepeat(completeDiagnostic('repeat'))
  await collecting
  expect(diagnosticCollectionStatus(options.snapshots[27]!, [])).toBe('collecting')
  expect(diagnosticCollectionStatus(options.state, [])).toBe('diagnostic-complete')
})

it('keeps the final checkpoint collecting until final original output equivalence succeeds', async () => {
  const options = setup()
  options.collectSample.mockImplementation(async (round, side) => {
    const result = structuredClone(sample)
    if (round === 6 && side === 'candidate') {
      result.repeatOutput.configDigest = 'c'.repeat(64)
    }
    return result
  })
  await expect(collectAutoImportBuildDiagnostics(options.state, options)).rejects.toThrow('Original emitted page/template/config evidence differs')
  expect(options.state.samples).toHaveLength(14)
  expect(options.snapshots).toHaveLength(28)
  expect(options.state.finished).toBe(false)
  expect(diagnosticCollectionStatus(options.snapshots[26]!, [])).toBe('collecting')
  expect(diagnosticCollectionStatus(options.snapshots[27]!, [])).toBe('collecting')
  expect(diagnosticCollectionStatus(options.state, ['output equivalence failed'])).toBe('incomplete')
})

it('cannot declare completion when the final repeat diagnostic fails', async () => {
  const options = setup()
  options.readDiagnostic.mockImplementation(async (round, side, phase) => {
    if (round === 6 && side === 'candidate' && phase === 'repeat') {
      throw new Error('final repeat diagnostic missing')
    }
    return completeDiagnostic(phase)
  })
  await collectAutoImportBuildDiagnostics(options.state, options)
  expect(options.state.samples).toHaveLength(14)
  expect(options.state.errors).toHaveLength(1)
  expect(diagnosticCollectionStatus(options.snapshots[26]!, [])).toBe('collecting')
  expect(diagnosticCollectionStatus(options.snapshots[27]!, [])).toBe('incomplete')
  expect(diagnosticCollectionStatus(options.state, [])).toBe('incomplete')
})
