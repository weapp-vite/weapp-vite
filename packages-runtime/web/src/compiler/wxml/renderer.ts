import type { RenderElementNode, RenderNode } from './types'
import { normalizeTagName, SELF_CLOSING_TAGS } from '../../shared/wxml'
import {
  extractFor,
  isConditionalElement,
  renderAttributes,
  resolveComponentTagName,
  stripControlAttributes,
} from './attributes'
import { buildExpression, buildTemplateDataExpression, parseInterpolations } from './interpolation'

interface RenderElementOptions {
  skipFor?: boolean
  overrideAttribs?: Record<string, string>
}

export class Renderer {
  renderNodes(
    nodes: RenderNode[],
    scopeVar: string,
    wxsVar: string,
    componentTags?: Record<string, string>,
  ): string {
    const parts: string[] = []
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (isConditionalElement(node)) {
        const { rendered, endIndex } = this.renderConditionalSequence(
          nodes,
          index,
          scopeVar,
          wxsVar,
          componentTags,
        )
        parts.push(rendered)
        index = endIndex
        continue
      }
      parts.push(this.renderNode(node, scopeVar, wxsVar, componentTags))
    }
    if (parts.length === 0) {
      return '""'
    }
    if (parts.length === 1) {
      return parts[0]!
    }
    return `[${parts.join(', ')}]`
  }

  private renderConditionalSequence(
    nodes: RenderNode[],
    startIndex: number,
    scopeVar: string,
    wxsVar: string,
    componentTags?: Record<string, string>,
  ): { rendered: string, endIndex: number } {
    const branches: Array<{ node: RenderElementNode, attribs: Record<string, string> }> = []
    let cursor = startIndex
    while (cursor < nodes.length) {
      const candidate = nodes[cursor]
      if (!isConditionalElement(candidate)) {
        break
      }
      const attribs = candidate.attribs ?? {}
      if (branches.length === 0 && !('wx:if' in attribs)) {
        break
      }
      if (branches.length > 0 && !('wx:elif' in attribs) && !('wx:else' in attribs)) {
        break
      }
      branches.push({ node: candidate, attribs })
      cursor += 1
      if ('wx:else' in attribs) {
        break
      }
    }
    if (!branches.length) {
      const node = nodes[startIndex]
      if (!node) {
        return { rendered: '""', endIndex: startIndex }
      }
      return { rendered: this.renderNode(node, scopeVar, wxsVar, componentTags), endIndex: startIndex }
    }
    let expr = '""'
    for (let index = branches.length - 1; index >= 0; index -= 1) {
      const { node, attribs } = branches[index]!
      const cleanedAttribs = stripControlAttributes(attribs)
      if ('wx:else' in attribs) {
        expr = this.renderElement(node, scopeVar, wxsVar, componentTags, { overrideAttribs: cleanedAttribs })
        continue
      }
      const conditionExpr = attribs['wx:if'] ?? attribs['wx:elif'] ?? ''
      const rendered = this.renderElement(node, scopeVar, wxsVar, componentTags, { overrideAttribs: cleanedAttribs })
      const condition = buildExpression(parseInterpolations(conditionExpr), scopeVar, wxsVar)
      expr = `(${condition} ? ${rendered} : ${expr})`
    }
    return { rendered: expr, endIndex: startIndex + branches.length - 1 }
  }

  private renderNode(
    node: RenderNode,
    scopeVar: string,
    wxsVar: string,
    componentTags?: Record<string, string>,
  ): string {
    if (node.type === 'text') {
      const parts = parseInterpolations(node.data ?? '')
      return buildExpression(parts, scopeVar, wxsVar)
    }
    if (node.type === 'element') {
      if (node.name === 'template' && node.attribs?.is) {
        return this.renderTemplateInvoke(node, scopeVar, wxsVar)
      }
      return this.renderElement(node, scopeVar, wxsVar, componentTags)
    }
    return '""'
  }

  private renderTemplateInvoke(
    node: RenderElementNode,
    scopeVar: string,
    wxsVar: string,
  ): string {
    const attribs = node.attribs ?? {}
    const isExpr = buildExpression(parseInterpolations(attribs.is ?? ''), scopeVar, wxsVar)
    const dataExpr = attribs.data
      ? buildTemplateDataExpression(attribs.data, scopeVar, wxsVar)
      : undefined
    const scopeExpr = dataExpr
      ? `ctx.mergeScope(${scopeVar}, ${dataExpr})`
      : scopeVar
    return `ctx.renderTemplate(__templates, ${isExpr}, ${scopeExpr}, ctx)`
  }

  private renderElement(
    node: RenderElementNode,
    scopeVar: string,
    wxsVar: string,
    componentTags?: Record<string, string>,
    options: RenderElementOptions = {},
  ): string {
    const attribs = options.overrideAttribs ?? node.attribs ?? {}
    if (!options.skipFor) {
      const forInfo = extractFor(node.attribs ?? {})
      if (forInfo.expr) {
        const listExpression = buildExpression(parseInterpolations(forInfo.expr), scopeVar, wxsVar)
        const listExpr = `ctx.normalizeList(${listExpression})`
        const itemVar = forInfo.itemName
        const indexVar = forInfo.indexName
        const scopeExpr = `ctx.createScope(${scopeVar}, { ${itemVar}: ${itemVar}, ${indexVar}: ${indexVar} })`
        const itemRender = this.renderElement(
          node,
          '__scope',
          wxsVar,
          componentTags,
          { skipFor: true, overrideAttribs: forInfo.restAttribs },
        )
        const keyExpr = `ctx.key(${JSON.stringify(forInfo.key ?? '')}, ${itemVar}, ${indexVar}, ${scopeExpr}, ${wxsVar})`
        return `repeat(${listExpr}, (${itemVar}, ${indexVar}) => ${keyExpr}, (${itemVar}, ${indexVar}) => { const __scope = ${scopeExpr}; return ${itemRender}; })`
      }
    }

    const customTag = resolveComponentTagName(node.name ?? '', componentTags)
    const tagName = customTag ?? normalizeTagName(node.name ?? '')
    if (tagName === '#fragment') {
      return this.renderNodes(node.children ?? [], scopeVar, wxsVar, componentTags)
    }

    const attrs = renderAttributes(attribs, scopeVar, wxsVar, {
      skipControl: true,
      preferProperty: Boolean(customTag),
    })
    const childNodes = node.children ?? []
    const children = childNodes
      .map(child => `\${${this.renderNode(child, scopeVar, wxsVar, componentTags)}}`)
      .join('')
    if (SELF_CLOSING_TAGS.has(tagName) && childNodes.length === 0) {
      return `html\`<${tagName}${attrs} />\``
    }
    return `html\`<${tagName}${attrs}>${children}</${tagName}>\``
  }
}

export const renderer = new Renderer()
