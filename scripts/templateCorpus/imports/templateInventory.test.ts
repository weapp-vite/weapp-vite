import type { GenerationEvidence } from '../generate/types'
import type { FrozenTemplateReference } from './types'
import { expect, it } from 'vitest'
import { corpusHash } from '../integrity'
import { validateGenerationTemplateInventory } from './templateInventory'

function fixture(container = false) {
  const source = '<view/>'
  const original = { file: `out/production/pages/index/index.${container ? 'ux' : 'wxml'}`, sha256: corpusHash(source), bytes: source.length }
  const report: GenerationEvidence = {
    schemaVersion: 1,
    id: 'template-inventory-production',
    framework: container ? 'taro' : 'mpx',
    version: container ? '2.2.22' : '2.11.2',
    target: container ? 'quickapp' : 'wx',
    mode: 'production',
    status: 'built',
    source: { repository: 'example/templates', commit: 'a'.repeat(40), licenseId: 'example-mit' },
    inputDependencies: {},
    runtime: { node: 'v22.18.0', packageManager: 'pnpm@10.0.0' },
    input: [],
    configuration: [],
    dependencies: [],
    outputs: [original],
    logs: [],
    commands: [['compiler']],
  }
  const template: FrozenTemplateReference = { original, documentSha256: original.sha256, ...(container ? { container: { start: 10, end: 17, object: { ...original, file: `objects/${original.sha256}` } } } : {}) }
  return { report, template }
}

it('requires every registered markup output while leaving scripts and styles in the full evidence inventory', () => {
  const { report, template } = fixture()
  report.outputs.push({ ...template.original, file: 'out/production/runtime.js' }, { ...template.original, file: 'out/production/index.wxss' })
  expect(() => validateGenerationTemplateInventory(report, [template])).not.toThrow()
  report.outputs.push({ ...template.original, file: 'out/production/subpackage/detail/index.wxml' })
  expect(() => validateGenerationTemplateInventory(report, [template])).toThrow('Registered template output inventory is incomplete')
  expect(() => validateGenerationTemplateInventory(report, [template, { ...template, original: report.outputs[3]! }])).not.toThrow()
})

it('uses each pinned compiler target instead of a report-supplied extension list or platform alias', () => {
  const { report, template } = fixture()
  expect(() => validateGenerationTemplateInventory({ ...report, target: 'unknown' }, [template])).toThrow('no registered template target')
  expect(() => validateGenerationTemplateInventory({ ...report, target: 'ali' }, [template])).toThrow('outside the registered target extensions')
  const alipay = { ...template, original: { ...template.original, file: 'out/production/components/button.axml' } }
  expect(() => validateGenerationTemplateInventory({ ...report, target: 'ali', outputs: [alipay.original] }, [alipay])).not.toThrow()
  const unsupported = { ...report, framework: 'uni-vue2' as const, version: '2.0.2-5030320261023001', target: 'mp-360' }
  expect(() => validateGenerationTemplateInventory(unsupported, [])).toThrow('contradicts an unsupported registered target')
  expect(() => validateGenerationTemplateInventory({ ...report, status: 'failed', target: 'unknown' }, [])).not.toThrow()
})

it('accepts only explicit container projections or independently verified non-template exclusions for UX', () => {
  const { report, template } = fixture(true)
  const application = { ...template.original, file: 'out/production/src/app.ux' }
  report.outputs.push(application)
  expect(() => validateGenerationTemplateInventory(report, [template])).toThrow('Registered template output inventory is incomplete')
  report.nonTemplateOutputs = [{ original: application, reason: 'no-explicit-template' }]
  expect(() => validateGenerationTemplateInventory(report, [template])).not.toThrow()
  expect(() => validateGenerationTemplateInventory(report, [{ ...template, container: undefined }])).toThrow('container projection does not match')
  const emitted = { ...template, original: { ...template.original, file: 'out/production/src/npm/.pnpm/components@1/node_modules/components/button.ux' } }
  expect(() => validateGenerationTemplateInventory({ ...report, outputs: [emitted.original], nonTemplateOutputs: undefined }, [emitted])).not.toThrow()
})

it('rejects duplicate classifications, extra templates and exclusions on ordinary markup targets', () => {
  const { report, template } = fixture()
  expect(() => validateGenerationTemplateInventory(report, [template, template])).toThrow('duplicate or overlapping classifications')
  expect(() => validateGenerationTemplateInventory(report, [template, { ...template, original: { ...template.original, file: 'out/production/undeclared.wxml' } }])).toThrow('Registered template output inventory is incomplete')
  expect(() => validateGenerationTemplateInventory({ ...report, nonTemplateOutputs: [{ original: template.original, reason: 'no-explicit-template' }] }, [template])).toThrow('outside the registered container target')
  const container = fixture(true)
  expect(() => validateGenerationTemplateInventory({ ...container.report, nonTemplateOutputs: [{ original: container.template.original, reason: 'no-explicit-template' }] }, [container.template])).toThrow('duplicate or overlapping classifications')
})
