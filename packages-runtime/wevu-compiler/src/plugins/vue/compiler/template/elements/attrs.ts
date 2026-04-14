import type { ElementNode } from '@vue/compiler-core'
import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { ForParseResult, TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import {
  WEVU_LAYOUT_HOST_ID_PREFIX,
  WEVU_LAYOUT_HOST_REF_PREFIX,
} from '@weapp-core/constants'
import { components as builtinComponents } from '../../../../../auto-import-components/builtin.auto'
import { renderClassAttribute, renderStyleAttribute, transformAttribute } from '../attributes'
import { transformDirective } from '../directives'
import { normalizeJsExpressionWithContext, normalizeWxmlExpressionWithContext } from '../expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from '../expression/runtimeBinding'
import { resolveMappedHtmlTagClassName, resolveTemplateTagName } from '../htmlTagMapping'
import { getBindDirectiveExpression } from './helpers'

const builtinTagSet = new Set(builtinComponents.map(tag => tag.toLowerCase()))

function isBuiltinTag(tag: string) {
  return builtinTagSet.has(tag.toLowerCase())
}

function prependStaticClass(staticClass: string | undefined, className: string) {
  const tokens = staticClass?.split(/\s+/).filter(Boolean) ?? []
  if (!tokens.includes(className)) {
    tokens.unshift(className)
  }
  return tokens.join(' ')
}

export function collectElementAttributes(
  node: ElementNode,
  context: TransformContext,
  options?: {
    forInfo?: ForParseResult
    skipSlotDirective?: boolean
    extraAttrs?: string[]
    isComponent?: boolean
    resolvedTag?: string
  },
) {
  const { props } = node
  const resolvedTag = options?.resolvedTag ?? resolveTemplateTagName(node.tag, context)
  const isComponentElement = options?.isComponent ?? !isBuiltinTag(resolvedTag)
  const attrs: string[] = options?.extraAttrs ? [...options.extraAttrs] : []
  const mappedTagClass = resolveMappedHtmlTagClassName(node.tag, context, resolvedTag)
  let staticClass: string | undefined
  let staticId: string | undefined
  let dynamicClassExp: string | undefined
  let staticStyle: string | undefined
  let dynamicStyleExp: string | undefined
  let vShowExp: string | undefined
  let vTextExp: string | undefined
  let templateRef: { name?: string, expAst?: Expression } | undefined
  let layoutHostKey: string | undefined
  let hasDynamicIdBinding = false
  const inFor = Boolean(options?.forInfo || context.forStack.length)

  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      if (prop.name === 'layout-host') {
        const rawKey = prop.value?.type === NodeTypes.TEXT ? prop.value.content.trim() : ''
        if (!isComponentElement) {
          context.warnings.push('layout-host 仅支持声明在组件节点上，当前节点已忽略。')
        }
        else if (!rawKey) {
          context.warnings.push('layout-host 需要提供非空字符串 key。')
        }
        else {
          layoutHostKey = rawKey
        }
        continue
      }
      if (prop.name === 'ref') {
        if (prop.value?.type === NodeTypes.TEXT) {
          const name = prop.value.content.trim()
          if (name) {
            templateRef = { name }
          }
        }
        continue
      }
      if (prop.name === 'class' && prop.value?.type === NodeTypes.TEXT) {
        staticClass = prop.value.content
        continue
      }
      if (prop.name === 'id' && prop.value?.type === NodeTypes.TEXT) {
        staticId = prop.value.content.trim()
        continue
      }
      if (prop.name === 'style' && prop.value?.type === NodeTypes.TEXT) {
        staticStyle = prop.value.content
        continue
      }
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
      continue
    }
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (options?.skipSlotDirective && prop.name === 'slot') {
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'ref'
      ) {
        const rawExp = getBindDirectiveExpression(prop)
        if (rawExp) {
          const expAst = normalizeJsExpressionWithContext(rawExp, context, { hint: 'ref 绑定' })
          if (expAst) {
            templateRef = { expAst }
          }
        }
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'id'
      ) {
        hasDynamicIdBinding = true
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'layout-host'
      ) {
        context.warnings.push('暂不支持动态 layout-host，已忽略该绑定。')
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'class'
      ) {
        dynamicClassExp = getBindDirectiveExpression(prop) || undefined
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'style'
      ) {
        dynamicStyleExp = getBindDirectiveExpression(prop) || undefined
        continue
      }
      if (prop.name === 'show' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        vShowExp = prop.exp.content
        continue
      }
      if (prop.name === 'text' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        const rawExp = prop.exp.content
        const runtimeExp = shouldFallbackToRuntimeBinding(rawExp)
          ? registerRuntimeBindingExpression(rawExp, context, { hint: 'v-text' })
          : null
        vTextExp = runtimeExp ?? normalizeWxmlExpressionWithContext(rawExp, context)
        continue
      }
      const dir = transformDirective(prop, context, node, options?.forInfo, { isComponent: isComponentElement })
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  if (mappedTagClass) {
    staticClass = prependStaticClass(staticClass, mappedTagClass)
  }

  if (templateRef) {
    const className = `__wv-ref-${context.templateRefIndexSeed++}`
    staticClass = staticClass ? `${staticClass} ${className}` : className
    context.templateRefs.push({
      selector: `.${className}`,
      inFor,
      name: templateRef.name,
      expAst: templateRef.expAst,
      kind: isComponentElement ? 'component' : 'element',
    })
  }

  if (layoutHostKey) {
    if (!staticId && hasDynamicIdBinding) {
      context.warnings.push('layout-host 暂不支持与动态 id 同时使用，当前节点已忽略。')
    }
    else {
      const hostIndex = context.layoutHostIndexSeed++
      const hostId = staticId || `${WEVU_LAYOUT_HOST_ID_PREFIX}${hostIndex}`
      const hostRefName = `${WEVU_LAYOUT_HOST_REF_PREFIX}${hostIndex}`
      staticId = hostId
      context.templateRefs.push({
        selector: `#${hostId}`,
        inFor: false,
        name: hostRefName,
        kind: 'component',
      })
      context.layoutHosts.push({
        key: layoutHostKey,
        refName: hostRefName,
        selector: `#${hostId}`,
        kind: 'component',
      })
    }
  }

  if (staticId) {
    attrs.unshift(`id="${staticId}"`)
  }

  const classAttr = renderClassAttribute(staticClass, dynamicClassExp, context)
  if (classAttr) {
    attrs.unshift(classAttr)
  }
  const styleAttr = renderStyleAttribute(
    staticStyle,
    dynamicStyleExp,
    vShowExp,
    context,
  )
  if (styleAttr) {
    attrs.unshift(styleAttr)
  }

  return { attrs, vTextExp }
}
