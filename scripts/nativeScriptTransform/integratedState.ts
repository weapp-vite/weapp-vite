import type { TransformResult } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils'
import type { CaptureExpressionTools } from './captureTypes'
import type { IntegratedBinding, IntegratedMode, IntegratedRecord } from './integratedTypes'
import { Buffer } from 'node:buffer'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { createCaptureBridgeMetrics, serializeCaptureValue } from './captureSerialize'
import { digest } from './identity'
import { serializeTransformScriptRequest } from './request'
import { validateNativeTransformOutcome, withTransformScriptFallback } from './transformNative'

/** 独占同步 stage；native 提交成功结果和告警，其他结果只执行一次原 JS 闭包。 */
export class IntegratedTransformState {
  private readonly records: IntegratedRecord[] = []
  private scenarioId?: string
  private active?: IntegratedRecord
  private disposed = false

  constructor(private readonly mode: IntegratedMode, private readonly binding: IntegratedBinding, private readonly transferKey: () => symbol | undefined) {}

  snapshot() {
    return structuredClone(this.records)
  }

  assertIdle() {
    if (this.scenarioId !== undefined || this.active) {
      throw new Error('Integrated transform requires an idle sequential owner')
    }
  }

  dispose() {
    this.assertIdle()
    this.disposed = true
  }

  async run<T>(scenarioId: string, execute: () => Promise<T> | T) {
    this.assertIdle()
    if (this.disposed || !scenarioId) {
      throw new Error('Integrated run requires an active owner and nonempty scenario id')
    }
    this.scenarioId = scenarioId
    const start = this.records.length
    try {
      const value = await execute()
      return { value, records: structuredClone(this.records.slice(start)) }
    }
    finally {
      this.scenarioId = undefined
    }
  }

  private observe(operation: () => void) {
    try {
      operation()
    }
    catch (error) {
      this.requireActive().evidenceErrors.push(serializeDiagnosticError(error))
    }
  }

  private requireActive() {
    if (!this.active) {
      throw new Error('Integrated hook called outside an active transformScript')
    }
    return this.active
  }

  warningHandler<T extends (...args: never[]) => unknown>(handler: T): T {
    const record = this.requireActive()
    const observe = (args: unknown[]) => this.observe(() => record.warnings.push({ channel: 'handler', arguments: serializeCaptureValue(args) }))
    return function (this: unknown, ...args: never[]) {
      observe(args)
      return Reflect.apply(handler, this, args)
    } as T
  }

  invoke(source: string, options: unknown, execute: () => TransformResult, expressions: CaptureExpressionTools, resolveWarn: () => (message: string) => void): TransformResult {
    if (this.disposed || this.scenarioId === undefined || this.active) {
      throw new Error('Integrated transformScript requires an active sequential scenario')
    }
    const record: IntegratedRecord = {
      schemaVersion: 1,
      scenarioId: this.scenarioId,
      callIndex: this.records.length,
      source: { code: source, sha256: digest(source), utf16Length: source.length, utf8Bytes: Buffer.byteLength(source) },
      nativeCalls: 0,
      fallbackCalls: 0,
      used: 'none',
      status: 'active',
      warnings: [],
      bridge: createCaptureBridgeMetrics(),
      evidenceErrors: [],
    }
    this.records.push(record)
    this.active = record
    const originalWarn = console.warn
    const observeConsole = (args: unknown[]) => this.observe(() => record.warnings.push({ channel: 'console', arguments: serializeCaptureValue(args) }))
    const captureWarn = function (this: unknown, ...args: unknown[]) {
      observeConsole(args)
      return Reflect.apply(originalWarn, this, args)
    }
    console.warn = captureWarn
    let rawNative: unknown
    let nativeWarn: ((message: string) => void) | undefined
    const fallback = () => {
      record.used = 'fallback'
      record.fallbackCalls++
      if (record.fallbackCalls !== 1) {
        throw new Error('Integrated stage attempted repeated JS fallback')
      }
      if (!record.fallbackReason) {
        try {
          const outcome = validateNativeTransformOutcome(rawNative, source, record.request!)
          record.nativeStatus = outcome.status
          record.fallbackReason = outcome.status === 'unsupported' ? outcome.unsupportedReason : outcome.status
        }
        catch (error) {
          record.nativeError = serializeDiagnosticError(error)
          record.fallbackReason = `invalid-native: ${record.nativeError.message}`
        }
      }
      return execute()
    }
    try {
      this.observe(() => {
        record.options = serializeCaptureValue(options, { inputOptions: true, transferKey: this.transferKey(), expressions, metrics: record.bridge })
      })
      let result: TransformResult
      if (this.mode === 'control-js') {
        record.used = 'control-js'
        result = execute()
      }
      else {
        try {
          if (!record.options) {
            throw new Error('Cannot build native request without complete captured options')
          }
          record.request = serializeTransformScriptRequest({ kind: 'captured', options: record.options })
        }
        catch (error) {
          record.requestError = serializeDiagnosticError(error)
          record.fallbackReason = `request-error: ${record.requestError.message}`
        }
        result = record.request === undefined
          ? fallback()
          : withTransformScriptFallback({
              source,
              request: record.request,
              invoke: (source, request) => {
                const invoke = this.binding.invoke
                if (!invoke) {
                  record.fallbackReason = `load-error: ${this.binding.loadError?.message ?? 'Missing experimental binding'}`
                  throw new Error(record.fallbackReason)
                }
                record.nativeCalls++
                try {
                  rawNative = invoke(source, request)
                }
                catch (error) {
                  record.nativeError = serializeDiagnosticError(error)
                  record.fallbackReason = `native-error: ${record.nativeError.message}`
                  throw error
                }
                this.observe(() => {
                  record.rawNative = serializeCaptureValue(rawNative)
                })
                return rawNative
              },
              fallback,
              warn: this.warningHandler((message: string) => {
                record.used = 'native'
                record.nativeStatus = 'ok'
                nativeWarn ??= resolveWarn()
                const warn = nativeWarn
                warn(message)
              }),
            })
        if (!record.fallbackCalls) {
          record.used = 'native'
          record.nativeStatus = 'ok'
        }
      }
      this.observe(() => {
        record.result = serializeCaptureValue(result)
      })
      record.status = 'returned'
      return result
    }
    catch (error) {
      record.status = 'threw'
      record.error = serializeDiagnosticError(error)
      throw error
    }
    finally {
      if (console.warn !== captureWarn) {
        record.evidenceErrors.push({ name: 'Error', message: 'console.warn ownership changed; foreign owner preserved' })
      }
      else {
        console.warn = originalWarn
      }
      this.active = undefined
    }
  }
}
