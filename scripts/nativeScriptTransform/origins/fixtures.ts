import type { InlineOriginState } from './state'
import type { OriginAsset, OriginContext, OriginDirective, OriginNode, OriginTemplate } from './types'

/** 只供单测构造已知位置的模板片段；不查找或反推表达式出现位置。 */
export function originFixture(expressions: string[], filename = 'pages/origins.vue', prefix = '<script>/* 中文🙂 */</script>\n<template>') {
  const directives: OriginDirective[] = []
  let content = ''
  for (const expression of expressions) {
    content += '<button @tap="'
    const start = content.length
    content += expression
    directives.push({ exp: { content: expression, loc: { start: { offset: start }, end: { offset: content.length }, source: expression } } })
    content += '"/>\n'
  }
  const source = `${prefix}${content}</template>`
  const template: OriginTemplate = { content, loc: { start: { offset: prefix.length }, end: { offset: prefix.length + content.length }, source: content } }
  const context: OriginContext = { filename, source: content }
  return { filename, source, template, context, directives }
}

export function originAsset(id: string, name: string): OriginAsset {
  return Object.freeze({ id, expression: `_ctx.${name}($event)`, parameterNames: Object.freeze({ context: '_ctx', scope: '_scope', event: '_event' }) })
}

export function generatedCall(name: string, context = '_ctx'): OriginNode {
  return { type: 'CallExpression', callee: { type: 'MemberExpression', computed: false, object: { type: 'Identifier', name: context }, property: { type: 'Identifier', name } } }
}

export function withFixture<T>(state: InlineOriginState, fixture: ReturnType<typeof originFixture>, execute: () => T) {
  return state.template(fixture.template, fixture.filename, fixture.source, undefined, execute)
}
