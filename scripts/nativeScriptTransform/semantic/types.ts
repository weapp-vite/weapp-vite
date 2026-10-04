export type SemanticValue
  = | { type: 'undefined' | 'null' | 'hole' }
    | { type: 'boolean', value: boolean }
    | { type: 'string' | 'number' | 'bigint', value: string }
    | { type: 'symbol', description: string | null }
    | { type: 'function' }
    | { type: 'reference', id: number }
    | { type: 'array', id: number, values: SemanticValue[], properties: [string, SemanticValue][] }
    | { type: 'object', id: number, properties: [string, SemanticValue][] }
    | { type: 'error', id: number, name: string, message: string, cause?: SemanticValue, properties: [string, SemanticValue][] }

export interface SemanticTools {
  snapshot: (value: unknown) => SemanticValue
  record: (label: string, payload?: unknown) => void
  step: <T>(label: string, action: () => T | PromiseLike<T>) => Promise<T>
  track: <T>(label: string, promise: PromiseLike<T>) => Promise<T>
  flush: () => Promise<void>
}

export interface SemanticCoverage {
  inlineIds: string[]
  computedKeys: string[]
  lifecycleNames: string[]
  requiredAssertions: string[]
}

export interface SemanticAssertion {
  id: string
  passed: true
}

export interface SemanticObservation {
  assertions: SemanticAssertion[]
  inlineInvocations: { id: string, executions: number, [key: string]: unknown }[]
  computedInvocations: { id: string, executions: number }[]
  lifecycleInvocations: { id: string, executions: number }[]
  [key: string]: unknown
}

export interface SemanticScenario {
  id: string
  imports: Record<string, Record<string, unknown>>
  globals: Record<string, unknown>
  coverage: SemanticCoverage
  dependencyFiles?: string[]
  observe: (namespace: Record<string, unknown>) => Promise<SemanticObservation>
  dispose?: () => void | Promise<void>
}

export interface SemanticTrace {
  label: string
  payload: SemanticValue
}

export interface SemanticAsyncState {
  id: number
  label: string
  status: 'pending' | 'fulfilled' | 'rejected'
  error?: SemanticValue
}

export interface SemanticExecution {
  schemaVersion: 1
  scenarioId: string
  loadedCodeSha256: string
  loadedCodeUtf16Length: number
  loadedCodeUtf8Bytes: number
  passed: boolean
  imports: { specifier: string, exports: string[], dynamic: boolean }[]
  exports: string[]
  coverage?: SemanticCoverage
  assertions: SemanticAssertion[]
  inlineInvocations: string[]
  computedInvocations: string[]
  lifecycleInvocations: string[]
  observation?: SemanticValue
  trace: SemanticTrace[]
  async: SemanticAsyncState[]
  pending: string[]
  unhandledErrors: SemanticValue[]
  cleanup: { attempted: boolean, completed: boolean, errors: SemanticValue[] }
  failure?: SemanticValue
  dependencyFiles: string[]
}

export interface SemanticWorkerRequest {
  schemaVersion: 1
  scenarioId: string
  filename: string
  code: string
  timeoutMs?: number
}
