import type { Fixture, Outcome, WorkerResult } from './types'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { deserialize, serialize } from 'node:v8'
import { serializeCaptureValue } from '../nativeScriptTransform/captureSerialize'

export { errorEvidence } from './errors'

export function hash(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

export function outcomeHash(outcome: Outcome) {
  // V8 字节不稳定；对实际跨 worker 数据快照编码，完整对象比较仍独立执行。
  return hash(JSON.stringify(serializeCaptureValue(deserialize(serialize(outcome)))))
}

/** 比较未经 JSON 简化的完整返回对象，避免遗漏 undefined、Map 或错误位置。 */
export function assertEquivalent(expected: Outcome, actual: Outcome, label: string) {
  if (!isDeepStrictEqual(expected, actual)) {
    throw new Error(`Complete compiler output/map/warning/error mismatch: ${label}`)
  }
}

export function validateWorker(result: WorkerResult, fixtures: Fixture[]) {
  if (result.failure || result.samples.length !== fixtures.length || new Set(result.samples.map(sample => sample.id)).size !== fixtures.length) {
    throw new Error(`Incomplete compiler worker: ${result.failure ?? result.mode}`)
  }
  for (const fixture of fixtures) {
    const sample = result.samples.find(sample => sample.id === fixture.id)
    if (!sample || !Number.isFinite(sample.wallMs) || sample.wallMs <= 0 || !Number.isFinite(sample.rssBytes) || sample.rssBytes <= 0
      || (sample.outcome.status === 'error') !== Boolean(fixture.expectError) || sample.outputSha256 !== outcomeHash(sample.outcome)) {
      throw new Error(`Invalid compiler result: ${fixture.id}`)
    }
    if (result.mode === 'timing') {
      if (sample.diagnostic) {
        throw new Error('Timing sample contains observer instrumentation')
      }
      continue
    }
    const diagnostic = sample.diagnostic
    if (!diagnostic) {
      throw new Error(`Missing compiler observation: ${fixture.id}`)
    }
    if (result.side === 'off') {
      if (Object.values(diagnostic.native).some(value => value !== 0) || diagnostic.compilerBatch.calls !== 0) {
        throw new Error('Disabled native path was exercised')
      }
    }
    else {
      if (diagnostic.compilerBatch.calls !== 1 || diagnostic.native.batchCalls !== 1 || diagnostic.native.loadFailures !== 0) {
        throw new Error(`Compiler batch entry was not exercised exactly once: ${fixture.id}`)
      }
      const expectedFallbacks = fixture.expectParseFallback || result.mode === 'fault' ? 1 : 0
      if (diagnostic.native.fallbacks !== expectedFallbacks) {
        throw new Error(`Unexpected compiler fallback count: ${fixture.id}`)
      }
    }
  }
}
