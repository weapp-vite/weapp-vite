import type { DiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'

export interface CaptureProperty {
  key: string | { symbol: 'script baseline AST transfer' }
  enumerable: boolean
  configurable: boolean
  writable: boolean
  value: CapturedValue
}

export type CapturedValue
  = | { kind: 'undefined' | 'null' }
    | { kind: 'boolean', value: boolean }
    | { kind: 'string', value: string }
    | { kind: 'number', value: string }
    | { kind: 'object', prototype: 'Object' | 'null' | 'Array', properties: CaptureProperty[] }
    | { kind: 'callback', role: 'options.warn', ownership: 'caller; never transferred' }
    | { kind: 'opaque', role: 'script baseline AST transfer', ownership: 'existing baseline loader; never consumed', valueKind: string }
    | { kind: 'ast-expression', id: number, nodeType: string, generatedSource: string, originalSpan: CapturedValue }

export interface CaptureBridgeMetrics {
  expressionCount: number
  generatedUtf16Chars: number
  spanCoordinates: 'original expression parser input; not assumed to index script or SFC'
  cost: 'diagnostic JS generation; not a zero-cost native transfer'
}

export interface CapturedWarning {
  channel: 'handler' | 'console'
  arguments: CapturedValue
}

export interface TransformScriptCaptureRecord {
  schemaVersion: 1
  scenarioId: string
  callIndex: number
  source: { code: string, sha256: string, utf16Length: number, utf8Bytes: number }
  options?: CapturedValue
  fastSetup: 'not-observed' | 'hit' | 'miss'
  status: 'active' | 'returned' | 'threw' | 'capture-failed'
  result?: CapturedValue
  error?: DiagnosticError
  warnings: CapturedWarning[]
  bridge: CaptureBridgeMetrics
  captureFailures: DiagnosticError[]
}

export interface CaptureExpressionTools {
  generate: (node: never) => { code: string }
  isExpression: (node: unknown) => boolean
}

export interface CapturedStageResult {
  code: string
  transformed: boolean
  map?: unknown
  [key: string]: unknown
}
