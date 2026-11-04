import type { GenerationEvidence } from '../generate/types'
import assert from 'node:assert/strict'
import { corpusJson } from '../integrity'
import { assertIdentity, assertOutputIdentity } from './files'

/** 每个字段来自原始 JSON 边界，缺数组与遗漏关键凭据均显式失败。 */
export function readGenerationReport(value: unknown): GenerationEvidence {
  assert.ok(value && typeof value === 'object', 'Invalid generation report')
  const report = value as GenerationEvidence
  assert.ok(report.schemaVersion === 1 && typeof report.id === 'string' && /^[\w.@+-]+$/.test(report.id), 'Invalid generation report identity')
  assert.ok(typeof report.framework === 'string' && typeof report.version === 'string' && typeof report.target === 'string', 'Incomplete generation report coordinates')
  assert.ok(['development', 'production'].includes(report.mode) && ['built', 'unsupported', 'pending', 'failed'].includes(report.status), 'Invalid generation report state')
  assert.ok(report.source && typeof report.source.repository === 'string' && /^[\w.-]+\/[\w.-]+$/.test(report.source.repository) && /^[\da-f]{40}$/.test(report.source.commit) && typeof report.source.licenseId === 'string' && report.source.licenseId, 'Invalid generation source identity')
  assert.ok(report.runtime && typeof report.runtime.node === 'string' && report.runtime.node && typeof report.runtime.packageManager === 'string' && report.runtime.packageManager, 'Missing generation runtime evidence')
  for (const role of ['input', 'configuration', 'dependencies', 'outputs', 'logs'] as const) {
    assert.ok(Array.isArray(report[role]), `Missing generation ${role} inventory`)
    const files = new Set<string>()
    for (const identity of report[role]) {
      if (role === 'outputs') {
        assertOutputIdentity(identity, report.mode)
      }
      else {
        assertIdentity(identity)
      }
      assert.ok(!files.has(identity.file.toLowerCase()), 'Duplicate generation file identity')
      files.add(identity.file.toLowerCase())
    }
  }
  if (report.nonTemplateOutputs !== undefined) {
    assert.ok(Array.isArray(report.nonTemplateOutputs), 'Invalid non-template output inventory')
    const excluded = new Set<string>()
    for (const entry of report.nonTemplateOutputs) {
      assert.ok(entry && typeof entry === 'object' && entry.reason === 'no-explicit-template', 'Invalid non-template output reason')
      assertOutputIdentity(entry.original, report.mode)
      assert.ok(entry.original.file.endsWith('.ux'), 'Non-template exclusion must reference an emitted UX container')
      assert.ok(!excluded.has(entry.original.file.toLowerCase()), 'Duplicate non-template output exclusion')
      excluded.add(entry.original.file.toLowerCase())
      assert.ok(report.outputs.some(output => corpusJson(output) === corpusJson(entry.original)), 'Non-template output is absent from the original output inventory')
    }
  }
  assert.ok(Array.isArray(report.commands) && report.commands.length && report.commands.every(command => Array.isArray(command) && command.length && command.every(part => typeof part === 'string' && part)), 'Missing generation command evidence')
  if (report.status === 'built') {
    assert.ok(report.input.length && report.configuration.length && report.outputs.length && report.logs.length, 'Built generation has incomplete artifact inventories')
    assert.ok(report.dependencies.some(identity => identity.file === 'pnpm-lock.yaml'), 'Built generation has no frozen dependency lock')
  }
  return report
}
