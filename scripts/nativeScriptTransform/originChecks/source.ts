import type { ElementNode, TemplateChildNode } from '@vue/compiler-dom'
import type { InlineOriginOccurrence, InlineProvenance } from '../origins/types'
import { createHash } from 'node:crypto'
import { NodeTypes, parse as parseTemplate } from '@vue/compiler-dom'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { assets, directCallee, ensure, expression, object } from './shared'

interface ScenarioSource { kind: string, filename: string, source: string }
type Candidate = Pick<InlineOriginOccurrence, 'expression' | 'callee'>

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function candidate(node: ElementNode, base: number, content: string): Candidate[] {
  return node.props.flatMap((prop) => {
    if (prop.type !== NodeTypes.DIRECTIVE || prop.name !== 'on'
      || prop.arg?.type !== NodeTypes.SIMPLE_EXPRESSION || !prop.arg.isStatic
      || prop.exp?.type !== NodeTypes.SIMPLE_EXPRESSION) {
      return []
    }
    const raw = prop.exp.content
    const text = raw.trim()
    if (!text || prop.exp.loc.source !== raw) {
      return []
    }
    const start = base + prop.exp.loc.start.offset + raw.length - raw.trimStart().length
    const end = start + text.length
    if (content.slice(start, end) !== text) {
      return []
    }
    let parsed
    try {
      parsed = expression(text)
    }
    catch {
      return []
    }
    const callee = directCallee(parsed)
    if (!callee || parsed.start !== 0 || parsed.end !== text.length
      || typeof callee.start !== 'number' || typeof callee.end !== 'number'
      || text.slice(callee.start, callee.end) !== callee.name) {
      return []
    }
    return [{ expression: { start, end, text }, callee: { start: start + callee.start, end: start + callee.end, name: callee.name } }]
  })
}

function candidates(scenario: ScenarioSource) {
  const parsed = parseSfc(scenario.source, { filename: scenario.filename })
  const template = parsed.descriptor.template
  ensure(!parsed.errors.length && template && !template.src && (!template.lang || template.lang === 'html'), 'unsupported or invalid SFC template owner')
  ensure(scenario.source.slice(template.loc.start.offset, template.loc.end.offset) === template.content, 'SFC template coordinates differ')
  const root = parseTemplate(template.content)
  const result: Candidate[] = []
  const visit = (node: TemplateChildNode, inSlot = false) => {
    if (node.type !== NodeTypes.ELEMENT) {
      return
    }
    const slot = inSlot || node.tag === 'slot'
      || node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'slot')
    const owned = candidate(node, template.loc.start.offset, scenario.source)
    ensure(!slot || !owned.length, 'slot handler traversal ownership is unsupported')
    result.push(...owned)
    node.children.forEach(child => visit(child, slot))
  }
  root.children.forEach(child => visit(child))
  return result
}

function span(raw: unknown, content: string, field: 'text' | 'name') {
  const value = object(raw)
  ensure(Number.isSafeInteger(value.start) && Number.isSafeInteger(value.end)
    && (value.start as number) >= 0 && (value.end as number) > (value.start as number)
    && (value.end as number) <= content.length && typeof value[field] === 'string'
    && content.slice(value.start as number, value.end as number) === value[field], 'invalid source span or spelling')
  return value
}

/** 从完整 SFC 独立解析真实指令；按同名直接调用的完整相对次序核验资产归属，歧义拒绝。 */
export function validateInlineProvenance(raw: unknown, scenario: ScenarioSource, actualOptionsDecoded: unknown): InlineProvenance | undefined {
  if (raw === undefined) {
    return undefined
  }
  ensure(scenario.kind === 'sfc', 'only an exact SFC source can own template occurrences')
  const data = object(raw)
  ensure(data.schemaVersion === 1 && data.coordinateEncoding === 'utf16'
    && Array.isArray(data.sources) && data.sources.length === 1
    && Array.isArray(data.occurrences) && data.occurrences.length > 0, 'invalid provenance schema or empty evidence')
  const source = object(data.sources[0])
  const filename = scenario.filename.replace(/\\/g, '/')
  ensure(source.filename === filename && source.content === scenario.source
    && source.id === `source:${digest([filename, scenario.source])}`, 'source owner differs from exact scenario')
  const sourceCandidates = candidates(scenario)
  const actualAssets = assets(actualOptionsDecoded)
  const ids = new Set<string>()
  const inlineIds = new Set<string>()
  const positions = new Set<number>()
  const occurrences = data.occurrences.map((rawOccurrence) => {
    const item = object(rawOccurrence)
    ensure(item.kind === 'inline-handler-callee' && item.sourceId === source.id
      && typeof item.inlineId === 'string' && typeof item.id === 'string', 'invalid occurrence identity')
    const exp = span(item.expression, scenario.source, 'text')
    const callee = span(item.callee, scenario.source, 'name')
    ensure(item.id === `occurrence:${digest([source.id, item.inlineId, exp.start, exp.end, callee.start, callee.end, callee.name])}`
      && !ids.has(item.id) && !inlineIds.has(item.inlineId) && !positions.has(exp.start as number), 'duplicate or invalid occurrence identity')
    ids.add(item.id)
    inlineIds.add(item.inlineId)
    positions.add(exp.start as number)
    const found = sourceCandidates.find(value => value.expression.start === exp.start && value.expression.end === exp.end)
    ensure(found && found.expression.text === exp.text && found.callee.start === callee.start
      && found.callee.end === callee.end && found.callee.name === callee.name, 'occurrence is not the exact template directive callee')
    const sameName = sourceCandidates.filter(value => value.callee.name === callee.name)
    const sameAssets = actualAssets.filter(value => value.callee?.name === callee.name)
    ensure(sameName.length === sameAssets.length, 'directive/asset ownership count is ambiguous')
    const ordinal = sameName.indexOf(found)
    ensure(sameAssets[ordinal]?.id === item.inlineId, 'directive/asset registration order differs')
    return item as unknown as InlineOriginOccurrence
  })
  for (const name of new Set(occurrences.map(item => item.callee.name))) {
    ensure(occurrences.filter(item => item.callee.name === name).length
      === sourceCandidates.filter(item => item.callee.name === name).length, 'same-name occurrence coverage is incomplete')
  }
  ensure(occurrences.every((item, index) => index === 0
    || actualAssets.findIndex(asset => asset.id === occurrences[index - 1]!.inlineId)
    < actualAssets.findIndex(asset => asset.id === item.inlineId)), 'occurrence records are reordered')
  return data as unknown as InlineProvenance
}
