import type { Attribute, Element } from '../template/scan'
import {
  WEVU_SLOT_NAMES_ATTR,
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ATTR,
  WEVU_TEMPLATE_REF_CLASS_PREFIX,
} from '@weapp-core/constants'
import { getSupportedMiniProgramDirectivePrefixes } from '@weapp-core/shared'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { failAt } from '../template/lexical'

export const scriptTags = new Set(getScriptModuleTagNames())
export const structuralTags = new Set(['block', 'slot', 'template', 'import', 'include', ...scriptTags])
const directivePrefixes = new Set(getSupportedMiniProgramDirectivePrefixes())
const protectedNames: Record<string, true | undefined> = {
  [WEVU_SLOT_NAMES_ATTR]: true,
  [WEVU_SLOT_NAMES_PROP]: true,
  [WEVU_SLOT_OWNER_ATTR]: true,
  'slot-scope': true,
  'ref': true,
  'data-is': true,
  'data-keep-alive': true,
}
const broadMatchProtectedNames: Record<string, true | undefined> = {
  id: true,
  class: true,
  style: true,
  hidden: true,
  value: true,
  checked: true,
  slot: true,
  is: true,
}
const eventNameRE = /^(?:(?:capture-)?(?:bind|catch|mut-bind)[:\w]|on[A-Z]|capture(?:Catch)?[A-Z]|@)/
const generatedNameRE = /^(?:data-(?:wv|wi|wh|wd|v)-|__wv|__wevu|__weapp)/
const generatedValueRE = /\b(?:__wv|__wevu|__weapp)[\w-]*/
const instructionCommentRE = /^\s*(?:[!#@]|\[\s*(?:if|endif)\b|(?:eslint|stylelint|prettier|lint|istanbul|v8|weapp-vite|wevu|mpx|uni-app|swan|wx|wxml)(?:\b|:))/i
const conditionalNames = new Map<string, { prefix: string, branch: string }>()
for (const prefix of directivePrefixes) {
  for (const branch of ['if', 'elif', 'else']) {
    conditionalNames.set(`${prefix}:${branch}`, { prefix, branch })
    if (prefix === 's') {
      conditionalNames.set(`${prefix}-${branch}`, { prefix, branch })
    }
  }
}

export function isProtectedAttribute(code: string, node: Element, attr: Attribute, exact: boolean) {
  const { name } = attr
  // 最终产物无法区分普通宿主属性与 v-show/v-model 等生成属性，通配符采用保守边界。
  if (!exact && broadMatchProtectedNames[name] === true) {
    return true
  }
  const colon = name.indexOf(':')
  let hostName = name
  if (colon > 0) {
    const prefix = name.slice(0, colon)
    if (directivePrefixes.has(prefix) || prefix === 'generic' || prefix === 'model' || prefix === 'mark' || prefix === 'change' || prefix === 'worklet' || prefix === 'let' || prefix === 'slot') {
      return true
    }
    if (prefix === 'class' || prefix === 'style') {
      // glass-easel 前缀写法与普通 class/style 共用边界，生成类名也可出现在属性名中。
      if (!exact || (prefix === 'class' && (generatedValueRE.test(name) || name.includes(WEVU_TEMPLATE_REF_CLASS_PREFIX)))) {
        return true
      }
      hostName = prefix
    }
  }
  if (protectedNames[name] === true || eventNameRE.test(name) || generatedNameRE.test(name)
    || name.startsWith('s-') || name === 'wx-if' || name === 'wx-for') {
    return true
  }
  if (scriptTags.has(node.tag) && (name === 'src' || name === 'from' || name === 'module' || name === 'name' || name === 'lang')) {
    return true
  }
  if ((node.tag === 'import' || node.tag === 'include') && name === 'src') {
    return true
  }
  if ((node.tag === 'template' && (name === 'name' || name === 'is' || name === 'data')) || (node.tag === 'slot' && name === 'name')) {
    return true
  }
  if (hostName === 'class' || hostName === 'style' || hostName === 'hidden' || hostName === 'id') {
    const value = code.slice(attr.valueStart, attr.valueEnd)
    return generatedValueRE.test(value) || (hostName === 'class' && value.includes(WEVU_TEMPLATE_REF_CLASS_PREFIX))
  }
  return false
}

export function isInstructionComment(code: string, start: number, end: number) {
  return instructionCommentRE.test(code.slice(start + 4, end - 3))
}

function getConditional(node: Element) {
  for (const attr of node.attrs) {
    const conditional = conditionalNames.get(attr.name)
    if (conditional) {
      return { ...conditional, start: attr.start }
    }
  }
}

export function assertSafeConditionalRemoval(code: string, fileName: string, nodes: Element[]) {
  const chains = new Map<Element, { prefix: string, branch: string, removed?: Element }>()
  for (const node of nodes) {
    const conditional = getConditional(node)
    if (!conditional) {
      continue
    }
    const preceding = node.previous && chains.get(node.previous)
    const removed = conditional.branch !== 'if' && preceding?.prefix === conditional.prefix && preceding.branch !== 'else'
      ? preceding.removed
      : undefined
    if (!node.removed && removed) {
      failAt(code, fileName, conditional.start, `Removing <${removed.tag}> would invalidate or change this ${conditional.prefix}:${conditional.branch} chain. Use source conditional compilation (#ifdef/#endif) to remove the complete conditional chain instead.`)
    }
    chains.set(node, { prefix: conditional.prefix, branch: conditional.branch, removed: removed ?? (node.removed ? node : undefined) })
  }
}
