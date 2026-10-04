import type { CaptureExpressionTools, TransformScriptCaptureRecord } from './captureTypes'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { createCaptureBridgeMetrics, serializeCaptureValue } from './captureSerialize'

/** 捕获只属于一个顺序执行的诊断 owner；原始 options、回调和返回值均原样流转。 */
export class TransformScriptCaptureState {
  private readonly records: TransformScriptCaptureRecord[] = []
  private scenarioId?: string
  private active?: TransformScriptCaptureRecord
  private disposed = false

  constructor(private readonly transferKey: () => symbol | undefined) {}

  snapshot() {
    return structuredClone(this.records)
  }

  assertIdle() {
    if (this.scenarioId !== undefined || this.active) {
      throw new Error('Cannot dispose capture during a run or transform')
    }
  }

  dispose() {
    this.assertIdle()
    this.disposed = true
  }

  async run<T>(scenarioId: string, execute: () => Promise<T> | T): Promise<{ value: T, records: TransformScriptCaptureRecord[] }> {
    this.assertIdle()
    if (this.disposed || !scenarioId) {
      throw new Error('Capture run requires an active owner and nonempty scenario id')
    }
    this.scenarioId = scenarioId
    const start = this.records.length
    try {
      const value = await execute()
      const records = structuredClone(this.records.slice(start))
      const failures = records.flatMap(record => record.captureFailures)
      if (failures.length) {
        throw new AggregateError(failures, 'Capture failed inside the compiler; serialized compiler errors do not hide capture failures')
      }
      return { value, records }
    }
    finally {
      this.scenarioId = undefined
    }
  }

  private checked<T>(operation: () => T): T {
    try {
      return operation()
    }
    catch (error) {
      this.requireActive().captureFailures.push(serializeDiagnosticError(error))
      throw error
    }
  }

  private requireActive() {
    if (!this.active) {
      throw new Error('Capture hook called outside an active transformScript stage')
    }
    return this.active
  }

  fastSetup(hit: boolean) {
    this.checked(() => {
      const record = this.requireActive()
      if (record.fastSetup !== 'not-observed' || typeof hit !== 'boolean') {
        throw new Error('Expected exactly one actual fastSetup outcome')
      }
      record.fastSetup = hit ? 'hit' : 'miss'
    })
  }

  warningHandler<T extends (...args: never[]) => unknown>(handler: T): T {
    this.requireActive()
    const recordWarning = (args: unknown[]) => this.checked(() => this.requireActive().warnings.push({ channel: 'handler', arguments: serializeCaptureValue(args) }))
    return function (this: unknown, ...args: never[]) {
      recordWarning(args)
      return Reflect.apply(handler, this, args)
    } as T
  }

  invoke<T>(source: string, options: unknown, execute: () => T, expressions: CaptureExpressionTools): T {
    if (this.disposed || this.scenarioId === undefined || this.active) {
      throw new Error('transformScript capture requires an active sequential scenario')
    }
    const record: TransformScriptCaptureRecord = {
      schemaVersion: 1,
      scenarioId: this.scenarioId,
      callIndex: this.records.length,
      source: { code: source, sha256: createHash('sha256').update(source).digest('hex'), utf16Length: source.length, utf8Bytes: Buffer.byteLength(source) },
      fastSetup: 'not-observed',
      status: 'active',
      warnings: [],
      bridge: createCaptureBridgeMetrics(),
      captureFailures: [],
    }
    this.records.push(record)
    this.active = record
    const originalWarn = console.warn
    const recordWarning = (args: unknown[]) => this.checked(() => record.warnings.push({ channel: 'console', arguments: serializeCaptureValue(args) }))
    const captureWarn = function (this: unknown, ...args: unknown[]) {
      recordWarning(args)
      return Reflect.apply(originalWarn, this, args)
    }
    console.warn = captureWarn
    try {
      record.options = this.checked(() => serializeCaptureValue(options, { inputOptions: true, transferKey: this.transferKey(), expressions, metrics: record.bridge }))
      const result = execute()
      this.checked(() => {
        if (result && typeof result === 'object' && 'then' in result) {
          throw new TypeError('transformScript capture only supports the synchronous stage contract')
        }
        if (record.fastSetup === 'not-observed') {
          throw new Error('Successful transformScript omitted the actual fastSetup observation')
        }
        record.result = serializeCaptureValue(result)
      })
      record.status = 'returned'
      return result
    }
    catch (error) {
      record.status = record.captureFailures.length ? 'capture-failed' : 'threw'
      record.error = serializeDiagnosticError(error)
      throw error
    }
    finally {
      try {
        if (console.warn !== captureWarn) {
          record.status = 'capture-failed'
          this.checked(() => {
            throw new Error('console.warn ownership changed during synchronous transformScript capture')
          })
        }
        console.warn = originalWarn
      }
      finally {
        this.active = undefined
      }
    }
  }
}
