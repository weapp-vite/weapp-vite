import type { SemanticExecution, SemanticObservation, SemanticScenario, SemanticTools, SemanticWorkerRequest } from './types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import { createSemanticTools } from './async'
import { snapshotSemanticValue } from './value'

function validateObservation(scenario: SemanticScenario, observation: SemanticObservation) {
  if (scenario.coverage.requiredAssertions.length === 0 || observation.assertions.length === 0) {
    throw new Error('Semantic scenario requires positive assertions')
  }
  const assertions = new Set<string>()
  for (const assertion of observation.assertions) {
    if (!assertion.id || assertion.passed !== true || assertions.has(assertion.id)) {
      throw new Error(`Invalid or duplicate semantic assertion: ${assertion.id}`)
    }
    assertions.add(assertion.id)
  }
  for (const id of scenario.coverage.requiredAssertions) {
    if (!assertions.has(id)) {
      throw new Error(`Missing semantic assertion: ${id}`)
    }
  }
  for (const [kind, expected, invocations] of [
    ['inline', scenario.coverage.inlineIds, observation.inlineInvocations],
    ['computed', scenario.coverage.computedKeys, observation.computedInvocations],
    ['lifecycle', scenario.coverage.lifecycleNames, observation.lifecycleInvocations],
  ] as const) {
    const executed = new Set(invocations.map(item => item.id))
    for (const entry of invocations) {
      if (entry.executions !== 1 || !expected.includes(entry.id)) {
        throw new Error(`Invalid ${kind} invocation: ${entry.id}`)
      }
    }
    for (const id of expected) {
      if (!executed.has(id)) {
        throw new Error(`Unexecuted ${kind}: ${id}`)
      }
    }
  }
}

async function bounded<T>(label: string, timeoutMs: number, action: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      action(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Semantic ${label} timed out after ${timeoutMs} ms`)), timeoutMs)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

/** 完整 ESM 在新 context 中执行；进程级 watchdog 仍由父 runner 负责。 */
export async function executeSemanticModule(
  request: Omit<SemanticWorkerRequest, 'schemaVersion'>,
  createScenario: (id: string, tools: SemanticTools) => SemanticScenario,
): Promise<SemanticExecution> {
  const ledger = createSemanticTools()
  const timeoutMs = request.timeoutMs ?? 10000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('Semantic timeout must be a positive integer')
  }
  const result: SemanticExecution = {
    schemaVersion: 1,
    scenarioId: request.scenarioId,
    loadedCodeSha256: createHash('sha256').update(request.code).digest('hex'),
    loadedCodeUtf16Length: request.code.length,
    loadedCodeUtf8Bytes: Buffer.byteLength(request.code),
    passed: false,
    imports: [],
    exports: [],
    assertions: [],
    inlineInvocations: [],
    computedInvocations: [],
    lifecycleInvocations: [],
    trace: ledger.trace,
    async: ledger.state,
    pending: [],
    unhandledErrors: [],
    cleanup: { attempted: false, completed: false, errors: [] },
    dependencyFiles: [],
  }
  const onUnhandled = (error: unknown) => result.unhandledErrors.push(snapshotSemanticValue(error))
  process.on('unhandledRejection', onUnhandled)
  let scenario: SemanticScenario | undefined
  try {
    scenario = createScenario(request.scenarioId, ledger.tools)
    if (scenario.id !== request.scenarioId) {
      throw new Error('Semantic scenario identity mismatch')
    }
    result.coverage = scenario.coverage
    result.dependencyFiles = scenario.dependencyFiles ?? []
    const capturedConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map(level => [
      level,
      (...args: unknown[]) => ledger.tools.record(`console:${level}`, args),
    ]))
    const context = createContext({ console: capturedConsole, ...scenario.globals }, {
      name: `semantic:${scenario.id}`,
      codeGeneration: { strings: false, wasm: false },
    })
    const imports = scenario.imports
    const modules = new Map<string, SyntheticModule>()
    function resolve(specifier: string, dynamic: boolean) {
      if (!Object.hasOwn(imports, specifier)) {
        throw new Error(`Unknown semantic import: ${specifier}`)
      }
      const values = imports[specifier]
      const names = Object.keys(values).sort()
      result.imports.push({ specifier, exports: names, dynamic })
      ledger.tools.record('module:import', { specifier, exports: names, dynamic })
      let module = modules.get(specifier)
      if (!module) {
        module = new SyntheticModule(names, function () {
          for (const name of names) {
            this.setExport(name, values[name])
          }
        }, { context, identifier: specifier })
        modules.set(specifier, module)
      }
      return module
    }
    const module = new SourceTextModule(request.code, {
      context,
      identifier: request.filename,
      importModuleDynamically: async (specifier) => {
        throw new Error(`Dynamic semantic imports are unsupported: ${specifier}`)
      },
    })
    await bounded('module evaluation', timeoutMs, async () => {
      await module.link(specifier => resolve(specifier, false))
      await module.evaluate({ timeout: timeoutMs })
    })
    ledger.tools.record('module:evaluated')
    result.exports = Object.keys(module.namespace).sort()
    const observation = await bounded('observation', timeoutMs, () => scenario!.observe(module.namespace as Record<string, unknown>))
    validateObservation(scenario, observation)
    result.assertions = observation.assertions
    result.inlineInvocations = observation.inlineInvocations.map(item => item.id)
    result.computedInvocations = observation.computedInvocations.map(item => item.id)
    result.lifecycleInvocations = observation.lifecycleInvocations.map(item => item.id)
    result.observation = snapshotSemanticValue(observation)
    await ledger.tools.flush()
  }
  catch (error) {
    result.failure = snapshotSemanticValue(error)
  }
  finally {
    try {
      if (scenario?.dispose) {
        result.cleanup.attempted = true
        await bounded('cleanup', timeoutMs, async () => scenario!.dispose!())
      }
      result.cleanup.completed = true
    }
    catch (error) {
      result.cleanup.errors.push(snapshotSemanticValue(error))
    }
    await ledger.checkpoint()
    result.pending = ledger.state.filter(entry => entry.status === 'pending').map(entry => entry.label)
    process.removeListener('unhandledRejection', onUnhandled)
  }
  result.passed = !result.failure && result.pending.length === 0 && result.unhandledErrors.length === 0
    && result.cleanup.completed && result.cleanup.errors.length === 0
  return result
}
