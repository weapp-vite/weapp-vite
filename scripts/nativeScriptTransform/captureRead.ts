import type { CapturedStageResult, CapturedValue, TransformScriptCaptureRecord } from './captureTypes'

/** 只恢复无函数、symbol 或 AST 的输出树；不把捕获的输入描述符伪装成可重放 options。 */
export function decodeCapturedData(value: CapturedValue): unknown {
  if (!value || typeof value !== 'object') {
    throw new TypeError('Invalid captured data tree')
  }
  switch (value.kind) {
    case 'undefined': return undefined
    case 'null': return null
    case 'boolean':
    case 'string': {
      if ((value.kind === 'boolean' && typeof value.value !== 'boolean') || (value.kind === 'string' && typeof value.value !== 'string')) {
        throw new TypeError('Invalid captured primitive')
      }
      return value.value
    }
    case 'number': {
      const number = Number(value.value)
      if (typeof value.value !== 'string' || (Object.is(number, -0) ? '-0' : String(number)) !== value.value) {
        throw new TypeError('Invalid captured number')
      }
      return number
    }
    case 'object': {
      if (!['Object', 'null', 'Array'].includes(value.prototype) || !Array.isArray(value.properties)) {
        throw new TypeError('Invalid captured object')
      }
      const output: object = value.prototype === 'Array' ? [] : value.prototype === 'null' ? Object.create(null) : {}
      const seen = new Set<string>()
      for (const property of value.properties) {
        if (typeof property.key !== 'string' || seen.has(property.key)) {
          throw new TypeError('Cannot decode symbol or duplicate captured property')
        }
        if ([property.configurable, property.enumerable, property.writable].some(flag => typeof flag !== 'boolean')) {
          throw new TypeError('Invalid captured property flags')
        }
        seen.add(property.key)
        Object.defineProperty(output, property.key, {
          value: decodeCapturedData(property.value),
          configurable: property.configurable,
          enumerable: property.enumerable,
          writable: property.writable,
        })
      }
      return output
    }
    default: throw new TypeError(`Cannot decode captured ${value.kind} as plain output data`)
  }
}

/** 校验成功 stage 的完整结果，再提供 code/map 供下游独立 codegen oracle 使用。 */
export function readCapturedStageResult(record: TransformScriptCaptureRecord): CapturedStageResult {
  if (record.status !== 'returned' || record.captureFailures.length || !record.result) {
    throw new Error('Captured transformScript has no verified successful result')
  }
  const result = decodeCapturedData(record.result)
  if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string'
    || !('transformed' in result) || typeof result.transformed !== 'boolean') {
    throw new TypeError('Invalid captured transformScript result')
  }
  return result as CapturedStageResult
}
