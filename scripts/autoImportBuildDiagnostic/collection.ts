import type { BuildDiagnosticTerminal, BuildHookEvent } from '../benchmarkTemplatesPerformance/autoImportBuildDiagnostics/hooks'
import type { OutputEvidence } from '../performanceGate/outputEvidence'
import { autoImportBuildDiagnosticOrder, autoImportBuildDiagnosticPlan } from './plan'

export type DiagnosticSide = 'baseline' | 'candidate'
export type DiagnosticPhase = typeof autoImportBuildDiagnosticPlan.phases[number]

export interface BuildSample {
  durationMs: number
  repeatDurationMs: number
  cliBuildMs: number | null
  repeatCliBuildMs: number | null
  output: OutputEvidence
  repeatOutput: OutputEvidence
}

export interface BuildDiagnosticEvidence {
  status: string
  durationMs: number
  timing: { cliBuildMs: number | null, matchedText: string | null }
  hooks: { errors: string[], events: BuildHookEvent[], terminal: BuildDiagnosticTerminal | null }
}

export interface DiagnosticCollection {
  finished: boolean
  samples: Array<{ round: number, side: DiagnosticSide, sample: BuildSample }>
  errors: Array<{ round: number, side: DiagnosticSide, phase: DiagnosticPhase, problems: string[] }>
}

interface CollectionOptions {
  collectSample: (round: number, side: DiagnosticSide) => Promise<BuildSample>
  readDiagnostic: (round: number, side: DiagnosticSide, phase: DiagnosticPhase) => Promise<BuildDiagnosticEvidence>
  checkpoint: () => Promise<unknown>
}

function diagnosticProblems(sample: BuildSample, phase: DiagnosticPhase, diagnostic: BuildDiagnosticEvidence) {
  const problems: string[] = []
  const durationMs = phase === 'first' ? sample.durationMs : sample.repeatDurationMs
  const cliBuildMs = phase === 'first' ? sample.cliBuildMs : sample.repeatCliBuildMs
  if (diagnostic.status !== 'completed') {
    problems.push('Diagnostic build status is not completed')
  }
  if (diagnostic.durationMs !== durationMs) {
    problems.push('Diagnostic measured duration differs from the original sample')
  }
  if (diagnostic.timing.cliBuildMs !== cliBuildMs || diagnostic.timing.matchedText === null) {
    problems.push('Diagnostic CLI timing differs or has no original matched text')
  }
  if (!diagnostic.hooks.events.length) {
    problems.push('Missing build hook events')
  }
  if (!diagnostic.hooks.terminal || !diagnostic.hooks.terminal.drained || !diagnostic.hooks.terminal.finalCloseHook || diagnostic.hooks.terminal.pendingIds.length) {
    problems.push('Missing or incomplete producer terminal')
  }
  problems.push(...diagnostic.hooks.errors)
  return problems
}

/** 诊断缺口逐阶段归档后继续原七对；构建失败与原产物不等价仍立即抛错。 */
export async function collectAutoImportBuildDiagnostics(state: DiagnosticCollection, options: CollectionOptions) {
  state.finished = false
  for (let round = 0; round < autoImportBuildDiagnosticPlan.pairCount; round++) {
    for (const side of autoImportBuildDiagnosticOrder(round)) {
      const sample = await options.collectSample(round, side)
      state.samples.push({ round, side, sample })
      for (const phase of autoImportBuildDiagnosticPlan.phases) {
        try {
          const diagnostic = await options.readDiagnostic(round, side, phase)
          const problems = diagnosticProblems(sample, phase, diagnostic)
          if (problems.length) {
            state.errors.push({ round, side, phase, problems })
          }
        }
        catch (error) {
          state.errors.push({ round, side, phase, problems: [`Unable to read or validate diagnostic: ${String(error)}`] })
        }
        await options.checkpoint()
      }
    }
    const pair = state.samples.filter(sample => sample.round === round)
    for (const field of ['output', 'repeatOutput'] as const) {
      if (JSON.stringify(pair[0]!.sample[field]) !== JSON.stringify(pair[1]!.sample[field])) {
        throw new Error('Original emitted page/template/config evidence differs between the paired checkouts')
      }
    }
  }
  state.finished = true
}

export function diagnosticCollectionStatus(state: DiagnosticCollection, fatalErrors: readonly string[]) {
  return state.errors.length || fatalErrors.length ? 'incomplete' : state.finished && state.samples.length === autoImportBuildDiagnosticPlan.pairCount * 2 ? 'diagnostic-complete' : 'collecting'
}
