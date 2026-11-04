import type { GenerationEvidence } from '../generate/types'
import assert from 'node:assert/strict'
import { findContainerTemplate } from '../collect/container'
import { corpusHash } from '../integrity'

/** 排除项仍冻结完整产物，并从原字节独立验证缺少模板区域的结论。 */
export function validateNonTemplateOutputs(report: GenerationEvidence, outputs: ReadonlyMap<string, Uint8Array>, templatePaths: readonly string[]): void {
  for (const { original, reason } of report.nonTemplateOutputs ?? []) {
    assert.equal(reason, 'no-explicit-template', 'Unknown non-template output classification')
    assert.ok(!templatePaths.includes(original.file), 'Non-template output cannot also be a corpus template')
    const bytes = outputs.get(original.file)
    assert.ok(bytes, 'Non-template output has no frozen original bytes')
    assert.equal(bytes.length, original.bytes, 'Non-template output size changed')
    assert.equal(corpusHash(bytes), original.sha256, 'Non-template output hash changed')
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    assert.equal(findContainerTemplate(source), undefined, 'Non-template output contains an explicit template region')
  }
}
