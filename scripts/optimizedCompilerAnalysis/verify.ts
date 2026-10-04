import type { OptimizedCompilerVariant } from './execution'
import type { OptimizedScenario } from './scenarios'
import { isDeepStrictEqual } from 'node:util'
import { scriptBaselineSources } from '../scriptAnalysisBaseline/installHelpers/source'
import { digest } from './identity'

export interface OptimizedCheck {
  scenario: string
  iteration: number
  inputSha256: string
  output: string
  failed: boolean
  warnings: string[]
  metrics: Record<string, number>
  bindingMetrics: Record<string, unknown>
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function object(value: unknown): Record<string, unknown> {
  ensure(value && typeof value === 'object' && !Array.isArray(value), 'Expected a diagnostic object')
  return value as Record<string, unknown>
}

function validateOutput(check: Record<string, unknown>, entry: OptimizedScenario, label: string) {
  const output = object(JSON.parse(check.output as string) as unknown)
  ensure(Array.isArray(output.warnings) && output.warnings.every(value => typeof value === 'string')
    && Array.isArray(output.consoleWarnings) && output.consoleWarnings.every(value => typeof value === 'string')
    && isDeepStrictEqual(check.warnings, [...output.warnings, ...output.consoleWarnings]), `${label}: serialized warning contract differs`)
  if (check.failed) {
    const error = object(output.error)
    ensure(typeof error.name === 'string' && error.name.length > 0 && typeof error.message === 'string' && error.message.length > 0
      && !Object.hasOwn(output, 'value'), `${label}: missing public failure diagnostics`)
    return
  }
  ensure(!Object.hasOwn(output, 'error'), `${label}: successful result contains an error`)
  if (entry.scenario.kind === 'reserved-props') {
    ensure(!Object.hasOwn(output, 'value'), `${label}: warning-only analysis returned unexpected data`)
    return
  }
  const result = object(output.value)
  ensure(entry.scenario.kind === 'script'
    ? typeof result.code === 'string' && typeof result.transformed === 'boolean'
    : ['script', 'template'].some(key => typeof result[key] === 'string' && result[key].length > 0), `${label}: compiler returned no generated output`)
}

/** 两套 hook 均需加载同一原始源码，不允许部分安装被当作组合优化。 */
export function expectedHookSources(variant: OptimizedCompilerVariant, identity: Record<string, string>) {
  const files = [
    ...scriptBaselineSources,
    'packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/bindingManifest.ts',
    'packages-runtime/wevu-compiler/src/plugins/vue/compiler/template.ts',
    'packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/elements/tag-slot.ts',
  ]
  ensure(files.every(file => /^[a-f\d]{64}$/.test(identity[file] ?? '')), 'Missing compiler hook identity')
  return variant === 'baseline' ? {} : Object.fromEntries(files.map(file => [file, identity[file]!]))
}

/** 完整输出在调用方与原始编译器逐字比较；这里拒绝无覆盖、残留状态和意外回退。 */
export function verifyOptimizedCheck(value: unknown, entry: OptimizedScenario, variant: OptimizedCompilerVariant, iteration: number): OptimizedCheck {
  const check = object(value)
  const { scenario } = entry
  const label = `${variant}/${scenario.id}/${iteration}`
  ensure(check.scenario === scenario.id && check.iteration === iteration && check.inputSha256 === digest(JSON.stringify(scenario)), `${label}: input identity mismatch`)
  ensure(typeof check.output === 'string' && check.output.length > 0 && check.failed === Boolean(scenario.expectError)
    && Array.isArray(check.warnings) && check.warnings.every(warning => typeof warning === 'string')
    && (scenario.expectWarning === undefined || Boolean(check.warnings.length) === scenario.expectWarning), `${label}: unexpected output or diagnostics`)
  validateOutput(check, entry, label)
  const metrics = object(check.metrics)
  ensure(Object.values(metrics).every(value => Number.isSafeInteger(value) && Number(value) >= 0), `${label}: invalid script metrics`)
  const idle = ['activeCompiles', 'pendingTransfers', 'astAlreadyConsumed']
  ensure(idle.every(key => variant === 'baseline' ? !metrics[key] : metrics[key] === 0), `${label}: unfinished script ownership`)
  if (variant === 'baseline' || variant === 'control') {
    ensure(Object.values(metrics).every(value => value === 0), `${label}: control performed script optimization`)
  }
  const binding = object(check.bindingMetrics)
  ensure(Object.entries(binding).every(([key, value]) => key === 'fallbackReasons'
    ? Array.isArray(value) && value.every(reason => typeof reason === 'string')
    : Number.isSafeInteger(value) && Number(value) >= 0), `${label}: invalid binding metrics`)
  ensure(['activeTemplates', 'pendingRecords', 'pendingInputs'].every(key => variant === 'baseline' ? !binding[key] : binding[key] === 0), `${label}: pending binding work`)
  if (variant !== 'baseline') {
    ensure(Array.isArray(binding.fallbackReasons) && binding.fallbackReasons.length === binding.fallbackCount, `${label}: incomplete fallback diagnostics`)
  }
  if (['baseline', 'control', 'optimized-js'].includes(variant)) {
    ensure(Object.entries(binding).every(([key, value]) => key === 'fallbackReasons' ? Array.isArray(value) && value.length === 0 : value === 0), `${label}: control performed binding optimization`)
  }
  if (variant !== 'optimized-native') {
    ensure(!binding.nativeCalls && !binding.fallbackCount, `${label}: JS variant invoked native or fallback`)
  }
  else {
    ensure(Number(binding.fallbackCount) === (entry.nativeFault ? 1 : 0), `${label}: unexpected native fallback`)
    if (entry.nativeFault) {
      const reason = entry.nativeFault === 'throw' ? 'Injected native execution failure' : 'Native batch result length differs from unique input count'
      ensure((binding.fallbackReasons as string[]).some(value => value.includes(reason)), `${label}: deliberate fault did not cause fallback`)
    }
  }
  if (['optimized-summary', 'optimized-native'].includes(variant) && !scenario.expectError && entry.bindingCoverage && entry.bindingCoverage !== 'none') {
    if (entry.bindingCoverage === 'eager') {
      ensure(Number(binding.unbatchedCalls) > 0, `${label}: missing eager JSX analysis`)
    }
    else {
      ensure(['inputCount', 'uniqueInputCount', 'consumedInputs', 'queuedRecords', 'flushCount'].every(key => Number(binding[key]) > 0), `${label}: binding batch was not consumed`)
      ensure(Number(binding[variant === 'optimized-native' ? 'nativeCalls' : 'baseJsCalls']) > 0, `${label}: ${variant} analyzer was not exercised`)
      if (entry.bindingCoverage === 'scoped-slots') {
        ensure(Number(binding.flushCount) >= 2 && Number(binding.directRecords) > 0, `${label}: missing separate slot consumption`)
      }
    }
  }
  return check as unknown as OptimizedCheck
}

export function verifyScriptCoverage(checks: OptimizedCheck[], variant: OptimizedCompilerVariant) {
  if (!variant.startsWith('optimized-')) {
    return
  }
  for (const key of ['astReuse', 'astSourceMismatch', 'astUnavailable', 'propsNoScopeVisits', 'pageMetaSkipped', 'pageMetaAnalyzed', 'reservedSkipped', 'reservedAnalyzed']) {
    ensure(checks.some(check => Number(check.metrics[key]) > 0), `${variant}: missing script branch ${key}`)
  }
}

export function verifyStartup(value: unknown, variant: OptimizedCompilerVariant, identity: Record<string, string>, bindingSha256: string) {
  const report = object(value)
  ensure(report.schemaVersion === 1 && report.variant === variant && report.passed === true && !report.failure
    && Array.isArray(report.cleanupErrors) && report.cleanupErrors.length === 0 && report.sourcesUnchanged === true
    && report.bindingUnchanged === true && report.bindingSha256 === bindingSha256
    && isDeepStrictEqual(report.sourceHashes, identity)
    && isDeepStrictEqual(report.hookSources, expectedHookSources(variant, identity)), `${variant}: worker identity, source or cleanup failure`)
  return report
}
