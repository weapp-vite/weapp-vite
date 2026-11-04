import type { ParseOptions } from '../../../packages/wxml/src/types'
import type { TemplateApi } from '../assertions'
import type { XmlDifferentialSummary, XmlParserConstructor } from '../assertions/xml'
import type { CorpusProfile } from '../types'
import { assertTemplate, CorpusAssertionError, semanticShape } from '../assertions'
import { equal } from '../assertions/types'
import { assertXmlDifferential, xmlDifferentialSummary } from '../assertions/xml'
import { runEditSequence } from './edits'
import { defaultFuzzSeed, formalFuzzBudget, generateInvalidCase, generateValidCase } from './generator'
import { minimizeFailure } from './shrink'

export { defaultFuzzSeed, formalFuzzBudget, generateInvalidCase, generateValidCase, runEditSequence }
export { minimizeFailure } from './shrink'

export interface FuzzFailure {
  seed: number
  index: number
  kind: 'valid' | 'invalid' | 'edit'
  profileId: string
  stage: string
  message: string
  source: string
  minimized: { source: string, checks: number }
  steps?: Array<{ step: number, source: string }>
}

export interface FuzzOptions {
  seed?: number
  valid?: number
  invalid?: number
  editSequences?: number
  onFailure?: (failure: FuzzFailure) => void
}

export interface FuzzReport {
  seed: number
  budget: { valid: number, invalid: number, editSequences: number, editSteps: number }
  formal: boolean
  accepted: boolean
  completed: { valid: number, invalid: number, editSequences: number, editSteps: number }
  scenarios: Record<string, Record<string, number>>
  differential: XmlDifferentialSummary
  failures: FuzzFailure[]
}

function failureStage(error: unknown) {
  return error instanceof CorpusAssertionError ? error.stage : 'exception'
}

/** 默认正式预算不可被较小调试运行误报为验收通过。 */
export function runFuzz(api: TemplateApi, profiles: readonly CorpusProfile[], options: FuzzOptions = {}, baseline?: XmlParserConstructor): FuzzReport {
  if (!profiles.length) {
    throw new TypeError('Fuzz requires at least one frozen profile.')
  }
  const budget = { valid: options.valid ?? formalFuzzBudget.valid, invalid: options.invalid ?? formalFuzzBudget.invalid, editSequences: options.editSequences ?? formalFuzzBudget.editSequences, editSteps: formalFuzzBudget.editSteps }
  for (const count of Object.values(budget)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new TypeError('Fuzz budgets must be nonnegative safe integers.')
    }
  }
  const seed = options.seed ?? defaultFuzzSeed
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
    throw new TypeError('Fuzz seed must be an unsigned 32-bit integer.')
  }
  const formal = budget.valid >= formalFuzzBudget.valid && budget.invalid >= formalFuzzBudget.invalid && budget.editSequences >= formalFuzzBudget.editSequences
  const report: FuzzReport = { seed, budget, formal, accepted: false, completed: { valid: 0, invalid: 0, editSequences: 0, editSteps: 0 }, scenarios: {}, differential: xmlDifferentialSummary(), failures: [] }
  const countScenario = (profile: CorpusProfile, scenario: string) => {
    const scenarios = report.scenarios[profile.id] ??= {}
    scenarios[scenario] = (scenarios[scenario] ?? 0) + 1
  }
  const record = (failure: FuzzFailure) => {
    report.failures.push(failure)
    options.onFailure?.(failure)
  }
  for (let index = 0; index < Math.max(budget.valid, budget.invalid, budget.editSequences); index++) {
    const profile = profiles[index % profiles.length]!
    const parseOptions: ParseOptions = { platform: profile.parserPlatform, syntax: profile.syntax, rawTags: profile.rawTags }
    if (index < budget.valid) {
      const publicXml = Math.floor(index / profiles.length) % 5 === 0
      const generated = generateValidCase(seed, index, profile, 0, publicXml)
      for (const scenario of generated.scenarios) {
        countScenario(profile, scenario)
      }
      const check = (source: string, shape: unknown[], differential = report.differential) => {
        assertTemplate(api, source, parseOptions)
        equal(semanticShape(api, api.parse(source, parseOptions)), shape, 'generated-structure', 'generated AST differs from grammar model')
        assertXmlDifferential(api, baseline, source, parseOptions, differential)
      }
      try {
        check(generated.source, generated.shape)
      }
      catch (error) {
        const stage = failureStage(error)
        let minimized = { source: generated.source, checks: 0 }
        for (let reduction = 1; reduction <= 3; reduction++) {
          const candidate = generateValidCase(seed, index, profile, reduction, publicXml)
          minimized.checks++
          try {
            check(candidate.source, candidate.shape, xmlDifferentialSummary())
          }
          catch (candidateError) {
            if (failureStage(candidateError) === stage && candidate.source.length < minimized.source.length) {
              minimized = { source: candidate.source, checks: minimized.checks }
            }
          }
        }
        record({ seed, index, kind: 'valid', profileId: profile.id, stage, message: String(error), source: generated.source, minimized })
      }
      report.completed.valid++
    }
    if (index < budget.invalid) {
      const generated = generateInvalidCase(seed, Math.floor(index / profiles.length), profile)
      countScenario(profile, generated.scenario)
      try {
        assertTemplate(api, generated.source, parseOptions, 'invalid', [generated.code])
      }
      catch (error) {
        const stage = failureStage(error)
        const minimized = minimizeFailure(generated.source, (candidate) => {
          if (!candidate.includes(generated.witness)) {
            return false
          }
          try {
            assertTemplate(api, candidate, parseOptions, 'invalid', [generated.code])
            return false
          }
          catch (candidateError) {
            return failureStage(candidateError) === stage
          }
        })
        record({ seed, index, kind: 'invalid', profileId: profile.id, stage, message: String(error), source: generated.source, minimized })
      }
      report.completed.invalid++
    }
    if (index < budget.editSequences) {
      const steps: Array<{ step: number, source: string }> = []
      try {
        runEditSequence(api, parseOptions, `case_${seed}_${index}`, (step, source) => {
          steps.push({ step, source })
        })
        countScenario(profile, 'eight-step-edit')
      }
      catch (error) {
        const source = steps.at(-1)?.source ?? '<corpus-root data-v="old" data-v="duplicate"><child/>seed</corpus-root>'
        let minimized = { source, checks: 1 }
        const reduced: Array<{ step: number, source: string }> = []
        try {
          runEditSequence(api, parseOptions, 'x', (step, source) => {
            reduced.push({ step, source })
          })
        }
        catch (candidateError) {
          const candidate = reduced.at(-1)?.source
          if (failureStage(candidateError) === failureStage(error) && candidate && candidate.length < source.length) {
            minimized = { source: candidate, checks: 1 }
          }
        }
        record({ seed, index, kind: 'edit', profileId: profile.id, stage: failureStage(error), message: String(error), source, minimized, steps })
      }
      report.completed.editSequences++
      report.completed.editSteps += steps.length
    }
  }
  report.accepted = formal && report.failures.length === 0 && report.completed.editSteps === budget.editSequences * 8 && profiles.every(profile => report.scenarios[profile.id]?.['eight-step-edit']) && Boolean(baseline && report.differential.executed > 0 && report.differential.failed === 0)
  return report
}
