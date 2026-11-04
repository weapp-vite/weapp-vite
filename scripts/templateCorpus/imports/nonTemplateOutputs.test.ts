import type { GenerationEvidence } from '../generate/types'
import { expect, it } from 'vitest'
import { corpusHash } from '../integrity'
import { validateNonTemplateOutputs } from './nonTemplateOutputs'
import { readGenerationReport } from './report'

function fixture(source = '<script>export default { onCreate() {} }</script><style>div { color: red }</style>') {
  const bytes = new TextEncoder().encode(source)
  const original = { file: 'out/production/app.ux', sha256: corpusHash(bytes), bytes: bytes.length }
  const report: GenerationEvidence = {
    schemaVersion: 1,
    id: 'taro-2.2.22-quickapp-production',
    framework: 'taro',
    version: '2.2.22',
    target: 'quickapp',
    mode: 'production',
    status: 'built',
    source: { repository: 'example/templates', commit: 'a'.repeat(40), licenseId: 'example-mit' },
    inputDependencies: {},
    runtime: { node: 'v22.18.0', packageManager: 'pnpm@10.0.0' },
    input: [{ ...original, file: 'Page.vue' }],
    configuration: [{ ...original, file: 'package.json' }],
    dependencies: [{ ...original, file: 'pnpm-lock.yaml' }],
    outputs: [original],
    nonTemplateOutputs: [{ original, reason: 'no-explicit-template' }],
    logs: [{ ...original, file: 'evidence/production.log' }],
    commands: [['pnpm', 'exec', 'compiler']],
  }
  return { report, original, bytes, outputs: new Map([[original.file, bytes]]) }
}

it('independently verifies script/style-only containers from their complete original bytes', () => {
  const { report, outputs } = fixture()
  expect(readGenerationReport(report)).toBe(report)
  expect(() => validateNonTemplateOutputs(report, outputs, [])).not.toThrow()
})

it('rejects exclusions with explicit templates, malformed containers or duplicate template membership', () => {
  const explicit = fixture('<template><div/></template>')
  expect(() => validateNonTemplateOutputs(explicit.report, explicit.outputs, [])).toThrow('contains an explicit template region')
  const malformed = fixture('<script>const value = "unterminated</script>')
  expect(() => validateNonTemplateOutputs(malformed.report, malformed.outputs, [])).toThrow('Unterminated container string')
  const ordinary = fixture()
  expect(() => validateNonTemplateOutputs(ordinary.report, ordinary.outputs, [ordinary.original.file])).toThrow('cannot also be a corpus template')
})

it('refuses missing, replaced or undecodable exclusion originals', () => {
  const { report, original, bytes, outputs } = fixture()
  expect(() => validateNonTemplateOutputs(report, new Map(), [])).toThrow('no frozen original bytes')
  expect(() => validateNonTemplateOutputs(report, new Map([[original.file, new Uint8Array()]]), [])).toThrow('size changed')
  const replaced = new Uint8Array(bytes)
  replaced[0] = 65
  expect(() => validateNonTemplateOutputs(report, new Map([[original.file, replaced]]), [])).toThrow('hash changed')
  const undecodable = new Uint8Array([255])
  const invalid = { ...original, sha256: corpusHash(undecodable), bytes: 1 }
  const invalidReport = { ...report, outputs: [invalid], nonTemplateOutputs: [{ original: invalid, reason: 'no-explicit-template' as const }] }
  expect(() => validateNonTemplateOutputs(invalidReport, new Map([[original.file, undecodable]]), [])).toThrow()
  expect(() => validateNonTemplateOutputs({ ...report, nonTemplateOutputs: undefined }, outputs, [])).not.toThrow()
  expect(() => validateNonTemplateOutputs({ ...report, nonTemplateOutputs: undefined }, outputs, [original.file])).not.toThrow()
  expect(() => validateNonTemplateOutputs({ ...report, status: 'failed', nonTemplateOutputs: undefined }, outputs, [])).not.toThrow()
})

it('validates exclusion shape, output identity, reason, extension and uniqueness at the JSON boundary', () => {
  const { report, original } = fixture()
  expect(() => readGenerationReport({ ...report, nonTemplateOutputs: null })).toThrow('Invalid non-template output inventory')
  expect(() => readGenerationReport({ ...report, nonTemplateOutputs: [null] })).toThrow('Invalid non-template output reason')
  expect(() => readGenerationReport({ ...report, nonTemplateOutputs: [{ original, reason: 'parser-rejected' }] })).toThrow('Invalid non-template output reason')
  expect(() => readGenerationReport({ ...report, nonTemplateOutputs: [{ original: { ...original, file: 'out/development/app.ux' }, reason: 'no-explicit-template' }] })).toThrow('Unsafe imported output path')
  expect(() => readGenerationReport({ ...report, nonTemplateOutputs: [{ original: { ...original, file: 'out/production/app.js' }, reason: 'no-explicit-template' }] })).toThrow('emitted UX container')
  expect(() => readGenerationReport({ ...report, nonTemplateOutputs: [...report.nonTemplateOutputs!, ...report.nonTemplateOutputs!] })).toThrow('Duplicate non-template output exclusion')
  expect(() => readGenerationReport({ ...report, nonTemplateOutputs: [{ original: { ...original, sha256: 'f'.repeat(64) }, reason: 'no-explicit-template' }] })).toThrow('absent from the original output inventory')
})
