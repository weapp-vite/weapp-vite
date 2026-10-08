import type { SemanticCoverage, SemanticExecution, SemanticValue, SemanticWorkerRequest } from './types'
import { Buffer } from 'node:buffer'
import { isDeepStrictEqual } from 'node:util'
import { object } from '../../optimizedCompilerAnalysis/verify'
import { digest } from '../identity'
import { ensure } from './artifacts'
import { snapshotSemanticValue } from './value'

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(value => typeof value === 'string')
}

/** 校验快照图并重编号投影，允许其他字段先拥有被引用对象，不能把缺失引用当作空值。 */
function observationSnapshot(raw: unknown) {
  const root = object(raw)
  ensure(root.type === 'object', 'Semantic observation must be an object snapshot')
  const nodes = new Map<number, Record<string, unknown>>()
  const references: number[] = []
  function properties(node: Record<string, unknown>) {
    ensure(Array.isArray(node.properties), 'Semantic snapshot properties are missing')
    const keys = new Set<string>()
    return node.properties.map((entry) => {
      ensure(Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && !keys.has(entry[0]), 'Invalid or duplicate semantic snapshot property')
      keys.add(entry[0])
      return [entry[0], entry[1]] as const
    })
  }
  function collect(raw: unknown) {
    const node = object(raw)
    if (['object', 'array', 'error', 'reference'].includes(String(node.type))) {
      ensure(Number.isSafeInteger(node.id) && (node.id as number) >= 0, 'Invalid semantic snapshot identity')
      if (node.type === 'reference') {
        references.push(node.id as number)
        return
      }
      ensure(!nodes.has(node.id as number), 'Duplicate semantic snapshot identity')
      nodes.set(node.id as number, node)
      for (const [, value] of properties(node)) {
        collect(value)
      }
      if (node.type === 'array') {
        ensure(Array.isArray(node.values), 'Semantic snapshot array values are missing')
        node.values.forEach(collect)
      }
      if (node.type === 'error') {
        ensure(typeof node.name === 'string' && typeof node.message === 'string', 'Invalid semantic error snapshot')
        if (Object.hasOwn(node, 'cause')) {
          collect(node.cause)
        }
      }
      return
    }
    ensure(['undefined', 'null', 'hole', 'boolean', 'string', 'number', 'bigint', 'symbol', 'function'].includes(String(node.type)), 'Invalid semantic snapshot kind')
    if (node.type === 'boolean') {
      ensure(typeof node.value === 'boolean', 'Invalid semantic boolean snapshot')
    }
    if (['string', 'number', 'bigint'].includes(String(node.type))) {
      ensure(typeof node.value === 'string', 'Invalid semantic scalar snapshot')
    }
    if (node.type === 'number') {
      ensure(node.value === '-0' || node.value === String(Number(node.value)), 'Invalid semantic number snapshot')
    }
    if (node.type === 'bigint') {
      ensure(typeof node.value === 'string' && /^(?:0|-?[1-9]\d*)$/.test(node.value), 'Invalid semantic bigint snapshot')
    }
    if (node.type === 'symbol') {
      ensure(node.description === null || typeof node.description === 'string', 'Invalid semantic symbol snapshot')
    }
  }
  collect(root)
  ensure(references.every(id => nodes.has(id)), 'Semantic snapshot contains an unresolved reference')
  function resolve(raw: unknown) {
    const node = object(raw)
    return node.type === 'reference' ? nodes.get(node.id as number)! : node
  }
  function property(node: Record<string, unknown>, key: string) {
    ensure(node.type === 'object', 'Semantic ledger entry must be an object snapshot')
    const found = properties(node).find(([name]) => name === key)
    ensure(found, `Semantic observation omitted ${key}`)
    return resolve(found[1])
  }
  function canonical(raw: unknown): SemanticValue {
    const seen = new Map<number, number>()
    function visit(raw: unknown): SemanticValue {
      const node = resolve(raw)
      if (!['object', 'array', 'error'].includes(String(node.type))) {
        return node as unknown as SemanticValue
      }
      const previous = seen.get(node.id as number)
      if (previous !== undefined) {
        return { type: 'reference', id: previous }
      }
      const id = seen.size
      seen.set(node.id as number, id)
      if (node.type === 'array') {
        const values = (node.values as unknown[]).map(visit)
        return { type: 'array', id, values, properties: properties(node).map(([key, value]) => [key, visit(value)]) }
      }
      if (node.type === 'error') {
        return { type: 'error', id, name: node.name as string, message: node.message as string, ...(Object.hasOwn(node, 'cause') ? { cause: visit(node.cause) } : {}), properties: properties(node).map(([key, value]) => [key, visit(value)]) }
      }
      return { type: 'object', id, properties: properties(node).map(([key, value]) => [key, visit(value)]) }
    }
    return visit(raw)
  }
  return {
    assertions: () => canonical(property(root, 'assertions')),
    invocations(key: string) {
      const array = property(root, key)
      ensure(array.type === 'array', 'Semantic invocation ledger must be an array snapshot')
      return (array.values as unknown[]).map((value) => {
        const entry = resolve(value)
        const id = property(entry, 'id')
        const executions = property(entry, 'executions')
        ensure(id.type === 'string' && typeof id.value === 'string' && executions.type === 'number' && executions.value === '1', 'Semantic invocation did not execute exactly once')
        return id.value
      })
    },
  }
}

/** 父进程独立检查 worker 身份、实际覆盖与退出状态；不只信任 passed 字段。 */
export function verifySemanticExecution(raw: unknown, request: SemanticWorkerRequest, coverage: SemanticCoverage, dependencies: string[], exitCode: number) {
  const result = object(raw)
  ensure(result.schemaVersion === 1 && result.scenarioId === request.scenarioId
    && result.loadedCodeSha256 === digest(request.code) && result.loadedCodeUtf16Length === request.code.length
    && result.loadedCodeUtf8Bytes === Buffer.byteLength(request.code) && typeof result.passed === 'boolean', 'Semantic worker loaded a different module or returned an invalid identity')
  ensure(exitCode === (result.passed ? 0 : 1), 'Semantic worker exit status differs from its report')
  ensure(isDeepStrictEqual(result.coverage, coverage) && strings(result.dependencyFiles)
    && isDeepStrictEqual([...result.dependencyFiles].sort(), [...dependencies].sort()), 'Semantic worker changed its required coverage or dependency entries')
  ensure(Array.isArray(result.imports) && Array.isArray(result.trace) && Array.isArray(result.async)
    && strings(result.exports) && strings(result.inlineInvocations) && strings(result.computedInvocations)
    && strings(result.lifecycleInvocations) && strings(result.pending)
    && Array.isArray(result.unhandledErrors) && Array.isArray(result.assertions), 'Semantic worker omitted its execution ledger')
  for (const rawImport of result.imports) {
    const imported = object(rawImport)
    ensure(typeof imported.specifier === 'string' && imported.dynamic === false && strings(imported.exports), 'Semantic worker accepted a dynamic or invalid import')
  }
  const pending: string[] = []
  const ids = new Set<number>()
  for (const rawEntry of result.async) {
    const entry = object(rawEntry)
    ensure(Number.isSafeInteger(entry.id) && !ids.has(entry.id as number) && typeof entry.label === 'string'
      && ['pending', 'fulfilled', 'rejected'].includes(String(entry.status)), 'Semantic async ledger is incomplete')
    ids.add(entry.id as number)
    if (entry.status === 'pending') {
      pending.push(entry.label)
    }
  }
  ensure(isDeepStrictEqual(result.pending, pending), 'Semantic pending count differs from the async ledger')
  const cleanup = object(result.cleanup)
  ensure(typeof cleanup.attempted === 'boolean' && typeof cleanup.completed === 'boolean' && Array.isArray(cleanup.errors), 'Semantic cleanup evidence is missing')
  ensure(result.failure === undefined || typeof object(result.failure).type === 'string', 'Semantic failure snapshot is invalid')
  const expectedPass = result.failure === undefined && result.pending.length === 0 && result.unhandledErrors.length === 0
    && cleanup.completed && cleanup.errors.length === 0
  ensure(result.passed === expectedPass, 'Semantic success hides an error, pending task or failed cleanup')
  if (result.passed) {
    ensure(result.observation && result.exports.includes('default') && result.imports.length > 0, 'Semantic execution did not observe a complete registered module')
    const observation = observationSnapshot(result.observation)
    ensure(isDeepStrictEqual(observation.assertions(), snapshotSemanticValue(result.assertions)), 'Semantic observation assertions differ from the actual ledger')
    for (const key of ['inlineInvocations', 'computedInvocations', 'lifecycleInvocations'] as const) {
      ensure(isDeepStrictEqual(observation.invocations(key), result[key]), `Semantic observation ${key} differs from the actual ledger`)
    }
    const labels = result.trace.map(entry => object(entry).label)
    ensure(labels.every(label => typeof label === 'string' && label.length > 0)
      && labels.filter(label => label === 'module:evaluated').length === 1, 'Semantic execution omitted or duplicated module evaluation evidence')
    const assertions = result.assertions.map((raw) => {
      const assertion = object(raw)
      ensure(typeof assertion.id === 'string' && assertion.id.length > 0 && assertion.passed === true, 'Invalid semantic assertion')
      return assertion.id
    })
    ensure(new Set(assertions).size === assertions.length && coverage.requiredAssertions.length > 0
      && coverage.requiredAssertions.every(id => assertions.includes(id)), 'Semantic execution omitted independent assertions')
    const actualIds = [...new Set(result.inlineInvocations)].sort()
    ensure(coverage.inlineIds.length > 0 && isDeepStrictEqual(actualIds, [...coverage.inlineIds].sort()), 'Semantic execution omitted or added inline handler calls')
    ensure(isDeepStrictEqual([...new Set(result.computedInvocations)].sort(), [...coverage.computedKeys].sort())
      && isDeepStrictEqual([...new Set(result.lifecycleInvocations)].sort(), [...coverage.lifecycleNames].sort()), 'Semantic execution omitted computed or lifecycle calls')
  }
  return result as unknown as SemanticExecution
}

/** 代码文本及证据路径单独保留，观察值、调用顺序和资源清理均逐项比较。 */
export function compareSemanticExecutions(expected: SemanticExecution, actual: SemanticExecution) {
  const fields = ['imports', 'exports', 'coverage', 'assertions', 'inlineInvocations', 'computedInvocations', 'lifecycleInvocations', 'observation', 'trace', 'async', 'pending', 'unhandledErrors', 'cleanup', 'failure', 'dependencyFiles'] as const
  const differentFields = fields.filter(field => !isDeepStrictEqual(expected[field], actual[field]))
  return { comparisonPassed: expected.passed && actual.passed && differentFields.length === 0, differentFields }
}
