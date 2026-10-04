import type { DirectiveOwner, InlineOriginOccurrence, OriginAsset, OriginCheck, OriginContext, OriginDirective, OriginNode, OriginTemplate, TemplateOwner } from './types'
import { createHash } from 'node:crypto'

function identity(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function range(start: unknown, end: unknown, length: number): start is number {
  return Number.isSafeInteger(start) && Number.isSafeInteger(end)
    && (start as number) >= 0 && (end as number) >= (start as number) && (end as number) <= length
}

/** 仅接受能按完整原文切片证明的模板 owner；规范化后的近似位置不能充当原始位置。 */
export function templateOwner(template: OriginTemplate, filename: string, content: string, resolvedId: string | undefined): OriginCheck<TemplateOwner> {
  if (template.src || resolvedId) {
    return { reason: 'external-template-owner-unconfirmed' }
  }
  const start = template.loc?.start?.offset
  const end = template.loc?.end?.offset
  if (typeof filename !== 'string' || !filename || typeof content !== 'string' || typeof template.content !== 'string'
    || !range(start, end, content.length) || content.slice(start, end) !== template.content
    || (template.loc.source !== undefined && template.loc.source !== template.content)) {
    return { reason: 'template-owner-slice-mismatch' }
  }
  const normalizedFilename = filename.replace(/\\/g, '/')
  const source = Object.freeze({ id: `source:${identity([normalizedFilename, content])}`, filename: normalizedFilename, content })
  return { value: Object.freeze({ source, template: template.content, start, end }) }
}

/** 指令位置来自当前 Vue 节点；trim 的偏移用长度差计算，实体解码差异直接拒绝。 */
export function directiveOwner(template: TemplateOwner, directive: OriginDirective, context: OriginContext, inlineSource: string): OriginCheck<DirectiveOwner> {
  if (context.source !== template.template || context.filename.replace(/\\/g, '/') !== template.source.filename) {
    return { reason: 'directive-context-owner-mismatch' }
  }
  const raw = directive.exp?.content
  const loc = directive.exp?.loc
  if (typeof raw !== 'string' || !loc || !range(loc.start?.offset, loc.end?.offset, template.template.length)
    || template.template.slice(loc.start.offset, loc.end.offset) !== raw
    || (loc.source !== undefined && loc.source !== raw)) {
    return { reason: 'directive-expression-slice-mismatch' }
  }
  const text = raw.trim()
  if (!text || (inlineSource !== text && inlineSource !== `${text}($event)`)) {
    return { reason: 'inline-input-not-direct-or-handler-bridge' }
  }
  const start = template.start + loc.start.offset + raw.length - raw.trimStart().length
  const end = start + text.length
  if (template.source.content.slice(start, end) !== text) {
    return { reason: 'directive-original-owner-slice-mismatch' }
  }
  return { value: Object.freeze({ template, inlineSource, expression: Object.freeze({ start, end, text }) }) }
}

/** 从已存在的括号包装 AST 读取直接 callee，立即复制位置，避免后续原地改写污染证据。 */
export function parsedCallee(owner: DirectiveOwner, source: string, expression: OriginNode | undefined): OriginCheck<InlineOriginOccurrence['callee']> {
  if (source !== owner.inlineSource || !expression) {
    return { reason: 'inline-parse-owner-mismatch' }
  }
  const direct = expression.type === 'Identifier'
    ? expression
    : expression.type === 'CallExpression' && expression.optional !== true && expression.callee?.type === 'Identifier'
      ? expression.callee
      : undefined
  if (!direct || typeof direct.name !== 'string' || !direct.name
    || expression.start !== 1 || expression.end !== source.length + 1
    || !range(direct.start, direct.end, source.length + 1) || direct.start < 1) {
    return { reason: 'unsupported-original-direct-callee' }
  }
  const localStart = direct.start - 1
  const localEnd = direct.end! - 1
  const bridged = source !== owner.expression.text
  if (localEnd > owner.expression.text.length || source.slice(localStart, localEnd) !== direct.name
    || (bridged && (localStart !== 0 || localEnd !== owner.expression.text.length || owner.expression.text !== direct.name))) {
    return { reason: 'callee-spelling-or-bridge-mismatch' }
  }
  const start = owner.expression.start + localStart
  const end = owner.expression.start + localEnd
  if (owner.template.source.content.slice(start, end) !== direct.name) {
    return { reason: 'callee-original-owner-slice-mismatch' }
  }
  return { value: Object.freeze({ start, end, name: direct.name }) }
}

/** 新增上下文参数不映射；仅允许实际输出根调用的成员名继承原 handler 的来源。 */
export function generatedCallee(asset: OriginAsset, expression: OriginNode | null | undefined, name: string) {
  const callee = expression?.type === 'CallExpression' && expression.optional !== true ? expression.callee : undefined
  return callee?.type === 'MemberExpression' && callee.computed === false && callee.optional !== true
    && callee.object?.type === 'Identifier' && callee.object.name === asset.parameterNames.context
    && callee.property?.type === 'Identifier' && callee.property.name === name
}

export function occurrence(owner: DirectiveOwner, callee: InlineOriginOccurrence['callee'], inlineId: string): InlineOriginOccurrence {
  const sourceId = owner.template.source.id
  const expression = owner.expression
  return Object.freeze({
    id: `occurrence:${identity([sourceId, inlineId, expression.start, expression.end, callee.start, callee.end, callee.name])}`,
    kind: 'inline-handler-callee',
    sourceId,
    inlineId,
    expression,
    callee,
  })
}

export function assetIdentity(asset: OriginAsset) {
  if (typeof asset.id !== 'string' || !asset.id || typeof asset.expression !== 'string' || !asset.parameterNames
    || ![asset.parameterNames.context, asset.parameterNames.scope, asset.parameterNames.event].every(name => typeof name === 'string' && name.length > 0)) {
    return undefined
  }
  return JSON.stringify([asset.id, asset.expression, asset.parameterNames.context, asset.parameterNames.scope, asset.parameterNames.event])
}
