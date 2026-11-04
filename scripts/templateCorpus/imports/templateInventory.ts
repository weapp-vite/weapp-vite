import type { GenerationEvidence } from '../generate/types'
import type { FrozenTemplateReference } from './types'
import assert from 'node:assert/strict'
import path from 'node:path'
import catalog from '../frameworks.json' with { type: 'json' }
import { corpusJson } from '../integrity'

interface RegisteredTemplateTarget {
  extensions: ReadonlySet<string>
  container: boolean
  support: string
}

const targets = new Map<string, RegisteredTemplateTarget>()
for (const release of catalog) {
  for (const target of release.targets) {
    const key = `${release.framework}@${release.version}/${target.target}`
    const container = 'container' in target ? target.container : undefined
    assert.ok(!targets.has(key), 'Duplicate registered template target')
    assert.ok(target.extensions.every(extension => /^\.[a-z\d]+$/.test(extension)), 'Invalid registered template extension')
    assert.ok(container === undefined || container === 'template', 'Unknown registered template container')
    targets.set(key, { extensions: new Set(target.extensions), container: container === 'template', support: target.support })
  }
}

/** 固定目录定义完整模板分母；报告不能通过少报 case 缩小待验收产物范围。 */
export function validateGenerationTemplateInventory(report: GenerationEvidence, templates: readonly FrozenTemplateReference[]): void {
  if (report.status !== 'built') {
    return
  }
  const target = targets.get(`${report.framework}@${report.version}/${report.target}`)
  assert.ok(target, 'Built generation has no registered template target')
  assert.equal(target.support, 'candidate', 'Built generation contradicts an unsupported registered target')
  const expected = report.outputs.filter(output => target.extensions.has(path.posix.extname(output.file))).map(output => output.file).sort()
  const actual: string[] = []
  for (const template of templates) {
    assert.ok(target.extensions.has(path.posix.extname(template.original.file)), 'Frozen template is outside the registered target extensions')
    assert.equal(Boolean(template.container), target.container, 'Frozen template container projection does not match its registered target')
    actual.push(template.original.file)
  }
  for (const excluded of report.nonTemplateOutputs ?? []) {
    assert.ok(target.container && target.extensions.has(path.posix.extname(excluded.original.file)), 'Non-template exclusion is outside the registered container target')
    actual.push(excluded.original.file)
  }
  assert.equal(new Set(actual).size, actual.length, 'Registered template output has duplicate or overlapping classifications')
  assert.equal(corpusJson(actual.sort()), corpusJson(expected), 'Registered template output inventory is incomplete')
}
