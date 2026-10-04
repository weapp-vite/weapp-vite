import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import type { CapturedStageResult } from './captureTypes'
import { inspectCompilerMaps } from './compilerMaps'
import { differences, inspectScriptStructure, inspectTransform } from './transformOracle'

type Finding = Record<string, unknown>
type Structure = Omit<ReturnType<typeof inspectScriptStructure>, 'before' | 'after'>
interface Output { value?: unknown, warnings: string[], consoleWarnings: string[], error?: unknown, [key: string]: unknown }

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readOutput(raw: string, side: string, issues: Finding[]): Output | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    if (!object(value) || !Array.isArray(value.warnings) || value.warnings.some(item => typeof item !== 'string')
      || !Array.isArray(value.consoleWarnings) || value.consoleWarnings.some(item => typeof item !== 'string')) {
      issues.push({ side, reason: 'Invalid full compiler output or warning contract', output: value })
      return undefined
    }
    return value as Output
  }
  catch (error) {
    issues.push({ side, reason: 'Invalid full compiler output JSON', error: String(error) })
    return undefined
  }
}

function omit(object: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)))
}

/** 保留完整编译结果差异；只在 script/map 字段内部使用独立的严格结构及真实来源检查。 */
export function inspectCompilerOutputs(expectedOutput: string, actualOutput: string, scenario: ScriptScenario) {
  const issues: Finding[] = []
  const expected = readOutput(expectedOutput, 'expected', issues)
  const actual = readOutput(actualOutput, 'actual', issues)
  const outputDifferences = differences(expected ?? expectedOutput, actual ?? actualOutput)
  const warningDifferences = differences(
    { warnings: expected?.warnings, consoleWarnings: expected?.consoleWarnings },
    { warnings: actual?.warnings, consoleWarnings: actual?.consoleWarnings },
  )
  const errorDifferences = differences(expected?.error, actual?.error, '$.error', Boolean(expected && Object.hasOwn(expected, 'error')), Boolean(actual && Object.hasOwn(actual, 'error')))
  const exactOnly = scenario.kind === 'reserved-props' || scenario.expectError === true
  const fields = scenario.kind === 'sfc' ? ['script', 'scriptMap'] : ['code', 'map']
  const metadata = (output: Output | undefined) => output && {
    ...omit(output, ['value', 'warnings', 'consoleWarnings', 'error']),
    ...(Object.hasOwn(output, 'value') ? { value: !exactOnly && object(output.value) ? omit(output.value, fields) : output.value } : {}),
  }
  const metadataDifferences = differences(metadata(expected), metadata(actual))
  let script: Structure | ReturnType<typeof inspectTransform> | undefined
  let maps: ReturnType<typeof inspectCompilerMaps> | undefined
  if (expected && actual) {
    if (scenario.expectError) {
      for (const [side, output] of [['expected', expected], ['actual', actual]] as const) {
        if (!object(output.error)) {
          issues.push({ side, reason: 'Expected-error scenario did not return an error object' })
        }
      }
    }
    else if (Object.hasOwn(expected, 'error') || Object.hasOwn(actual, 'error')) {
      issues.push({ reason: 'Successful scenario returned an unexpected error' })
    }
    if (!exactOnly && !Object.hasOwn(expected, 'error') && !Object.hasOwn(actual, 'error')) {
      const before = expected.value
      const after = actual.value
      if (!object(before) || !object(after) || typeof before[fields[0]!] !== 'string' || typeof after[fields[0]!] !== 'string') {
        issues.push({ reason: 'Successful compiler output is missing its script string' })
      }
      else {
        try {
          if (scenario.kind === 'script') {
            if (typeof before.transformed !== 'boolean' || typeof after.transformed !== 'boolean') {
              issues.push({ reason: 'Raw script output is missing its transformed contract' })
            }
            // 完整输出已独立检查分渠道告警，此处复用阶段结构、返回元数据及 map 门禁。
            script = inspectTransform(before as CapturedStageResult, after as CapturedStageResult, scenario.source, [], [])
          }
          else {
            const { before: expectedAst, after: actualAst, ...structure } = inspectScriptStructure(before.script as string, after.script as string)
            script = structure
            maps = inspectCompilerMaps(
              { code: before.script as string, map: before.scriptMap, hasMap: Object.hasOwn(before, 'scriptMap'), ast: expectedAst },
              { code: after.script as string, map: after.scriptMap, hasMap: Object.hasOwn(after, 'scriptMap'), ast: actualAst },
              scenario,
            )
          }
        }
        catch (error) {
          issues.push({ reason: 'Cannot inspect complete compiler script', error: String(error) })
        }
      }
    }
  }
  const exactOutput = expectedOutput === actualOutput
  const scriptPassed = script && script.astEqual && script.commentsEqual && script.annotationsEqual
    && (!('comparisonPassed' in script) || script.comparisonPassed)
  const mapsPassed = !maps || maps.anchorsEqual
  return {
    exactOutput,
    comparisonPassed: issues.length === 0 && metadataDifferences.length === 0 && warningDifferences.length === 0 && errorDifferences.length === 0
      && (exactOnly ? exactOutput : Boolean(scriptPassed && mapsPassed)),
    script,
    maps,
    metadataEqual: metadataDifferences.length === 0,
    metadataDifferences,
    warningsEqual: warningDifferences.length === 0,
    warningDifferences,
    errorEqual: errorDifferences.length === 0,
    errorDifferences,
    outputDifferences,
    issues,
    limitations: [
      'Full serialized output differences, including the two original script maps, remain in the private record; no map is synthesized or substituted.',
      'Only script AST printing/location fields are omitted from structural comparison; comments and annotation attachments remain exact.',
      'Final maps are traced independently to the exact scenario filename and source content. Multi-source maps remain explicitly unverified.',
      'Matching source origins are pairwise evidence, not proof that either compiler is correct. All both-unmapped anchors retain unverified ownership; structural similarity is not provenance.',
      'Checks cover AST token and statement/declaration starts plus every encoded segment, not every generated byte. Disabled maps provide no source evidence.',
      'No real mini-program runtime is executed; this does not establish runtime semantics or performance.',
    ],
  }
}
