import type { CollectionReport, CompactEntry, CompactEvidence, CompactReport, Entry, ManifestBase, OutputDelta, PortablePayload } from './schema.mts'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { isArtifactEvidence } from '../../../../scripts/benchmarkNativeAnalysis/artifacts.ts'

export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

/** 公开 JSON 摘要固定键序；数组与全部数值保持原样。 */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]))
  }
  return value
}
export const canonicalHash = (value: unknown) => sha256(JSON.stringify(canonical(value)))

/** 只将完整 output 换成按工程分组的字典引用，保留其他报告字段。 */
export function encodeEvidence(payload: PortablePayload): CompactEvidence {
  const bases: ManifestBase[] = []
  const outputs: OutputDelta[] = []
  const groups = new Map<string, number>()
  const known = new Map<string, number>()
  let runs = 0
  let samples = 0
  function compactReport(report: CollectionReport): CompactReport {
    const entries: CompactEntry[] = report.runs.map((entry) => {
      runs++
      const group = `${entry.run.kind}:${entry.run.input}`
      return { ...entry, run: { ...entry.run, samples: entry.run.samples.map((sample) => {
        samples++
        const { output, ...rest } = sample
        assert(isArtifactEvidence(output), `Invalid output evidence: ${sample.id}`)
        const key = JSON.stringify(output)
        let outputRef = known.get(key)
        if (outputRef === undefined) {
          let baseRef = groups.get(group)
          if (baseRef === undefined) {
            baseRef = bases.length
            groups.set(group, baseRef)
            bases.push({ group, files: output.files })
          }
          const base = bases[baseRef]!.files
          const removed = Object.keys(base).filter(file => !Object.hasOwn(output.files, file))
          const changed = Object.fromEntries(Object.entries(output.files).filter(([file, hash]) => base[file] !== hash))
          const keys = [...Object.keys(base).filter(file => !removed.includes(file)), ...Object.keys(changed).filter(file => !Object.hasOwn(base, file))]
          const indices = new Map(keys.map((file, index) => [file, index]))
          const order = Object.keys(output.files).map(file => indices.get(file)!)
          const ordered = order.some((value, index) => value !== index)
          const { files: _files, ...fields } = output
          outputRef = outputs.length
          outputs.push({ baseRef, fields, changed, removed, ...(ordered ? { order } : {}) })
          known.set(key, outputRef)
        }
        return { ...rest, outputRef }
      }) } }
    })
    return { ...report, runs: entries }
  }
  const compact = { ...payload, reports: { primary: compactReport(payload.reports.primary), confirmation: payload.reports.confirmation ? compactReport(payload.reports.confirmation) : null } }
  return { schema: 'architecture-portable-compact-v1', codec: 'output-base-delta-v1', decodedCanonicalSha256: canonicalHash(payload), counts: { runs, samples, outputs: outputs.length, bases: bases.length }, bases, outputs, payload: compact }
}

/** 严格展开索引并核验所有产物摘要，拒绝缺失、重复和超界引用。 */
export function decodeEvidence(compact: CompactEvidence): PortablePayload {
  assert.equal(compact.schema, 'architecture-portable-compact-v1')
  assert.equal(compact.codec, 'output-base-delta-v1')
  assert.equal(compact.counts.outputs, compact.outputs.length)
  assert.equal(compact.counts.bases, compact.bases.length)
  const usedBases = new Set<number>()
  const outputs = compact.outputs.map((delta) => {
    assert(Number.isSafeInteger(delta.baseRef) && delta.baseRef >= 0 && delta.baseRef < compact.bases.length)
    usedBases.add(delta.baseRef)
    const base = compact.bases[delta.baseRef]!.files
    const removed = new Set(delta.removed)
    assert.equal(removed.size, delta.removed.length)
    for (const file of removed) {
      assert(Object.hasOwn(base, file))
    }
    for (const [file, hash] of Object.entries(delta.changed)) {
      assert(!removed.has(file))
      assert.match(hash, /^[a-f\d]{64}$/)
    }
    const keys = [...Object.keys(base).filter(file => !removed.has(file)), ...Object.keys(delta.changed).filter(file => !Object.hasOwn(base, file))]
    let indices: number[] | undefined
    if (delta.order) {
      indices = []
      for (const token of delta.order) {
        if (typeof token === 'number') {
          indices.push(token)
        }
        else {
          assert.equal(token.length, 2)
          assert(Number.isSafeInteger(token[0]) && token[0] >= 0 && Number.isSafeInteger(token[1]) && token[1] > 0 && token[0] + token[1] <= keys.length)
          for (let offset = 0; offset < token[1]; offset++) {
            indices.push(token[0] + offset)
          }
        }
        assert(indices.length <= keys.length)
      }
      assert.equal(indices.length, keys.length)
      assert.equal(new Set(indices).size, keys.length)
      assert(indices.every(index => Number.isSafeInteger(index) && index >= 0 && index < keys.length))
    }
    const order = indices ? indices.map(index => keys[index]!) : keys
    const output = { ...delta.fields, files: Object.fromEntries(order.map(file => [file, Object.hasOwn(delta.changed, file) ? delta.changed[file]! : base[file]!])) }
    assert(isArtifactEvidence(output))
    return output
  })
  const usedOutputs = new Set<number>()
  let runs = 0
  let samples = 0
  function expand(report: CompactReport): CollectionReport {
    const entries: Entry[] = report.runs.map((entry) => {
      runs++
      return { ...entry, run: { ...entry.run, samples: entry.run.samples.map(({ outputRef, ...sample }) => {
        samples++
        assert(Number.isSafeInteger(outputRef) && outputRef >= 0 && outputRef < outputs.length)
        usedOutputs.add(outputRef)
        return { ...sample, output: outputs[outputRef]! }
      }) } }
    })
    return { ...report, runs: entries } as CollectionReport
  }
  const payload = { ...compact.payload, reports: { primary: expand(compact.payload.reports.primary), confirmation: compact.payload.reports.confirmation ? expand(compact.payload.reports.confirmation) : null } }
  assert.equal(runs, compact.counts.runs)
  assert.equal(samples, compact.counts.samples)
  assert.equal(usedOutputs.size, compact.outputs.length, 'Unreferenced output dictionary entry')
  assert.equal(usedBases.size, compact.bases.length, 'Unreferenced manifest dictionary entry')
  assert.equal(canonicalHash(payload), compact.decodedCanonicalSha256, 'Decoded public payload changed')
  return payload
}
