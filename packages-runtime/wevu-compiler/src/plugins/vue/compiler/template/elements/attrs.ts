import type { AttributeNode, ElementNode } from '@vue/compiler-core'
import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { WevuBindingKind } from '../../../../../types/bindingManifest'
import type { ForParseResult, TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import {
  WEVU_CSS_VARS_STYLE_KEY,
  WEVU_LAYOUT_HOST_ID_PREFIX,
  WEVU_LAYOUT_HOST_REF_PREFIX,
  WEVU_SLOT_OWNER_ID_ATTR,
  WEVU_TEMPLATE_REF_CLASS_PREFIX,
} from '@weapp-core/constants'
import { components as builtinComponents } from '../../../../../auto-import-components/builtin.auto'
import { normalizeComponentHostName } from '../../../../../utils/text'
import { renderClassAttribute, renderStyleAttribute, transformAttribute } from '../attributes'
import { recordBindingExpression } from '../bindingManifest'
import { warn } from '../diagnostics'
import { transformDirective } from '../directives'
import { normalizeJsExpressionWithContext, normalizeWxmlExpressionWithContext } from '../expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from '../expression/runtimeBinding'
import { resolveMappedHtmlTagClassName, resolveTemplateTagName } from '../htmlTagMapping'
import { getBindDirectiveExpression } from './helpers'

const builtinTagSet = new Set(builtinComponents.map(tag => tag.toLowerCase()))

const MUSTACHE_EXPRESSION_RE = /\{\{([\s\S]*?)\}\}/g

function recordStaticAttributeBindings(
  prop: AttributeNode,
  context: TransformContext,
  isComponentElement: boolean,
) {
  const value = prop.value?.content
  if (!value?.includes('{{')) {
    return
  }
  if (prop.name === WEVU_SLOT_OWNER_ID_ATTR) {
    context.bindingManifest.features.scopedSlots = true
  }
  let kind: WevuBindingKind = isComponentElement ? 'component-prop' : 'attribute'
  if (prop.name === context.platform.directives.forAttr) {
    kind = 'for'
  }
  else if (
    prop.name === context.platform.directives.ifAttr
    || prop.name === context.platform.directives.elifAttr
  ) {
    kind = 'if'
  }
  else if (prop.name === 'class') {
    kind = 'class'
  }
  else if (prop.name === 'style') {
    kind = 'style'
  }
  for (const match of value.matchAll(MUSTACHE_EXPRESSION_RE)) {
    const expression = match[1]?.trim()
    if (!expression) {
      continue
    }
    recordBindingExpression(context, {
      kind,
      expression,
      sourceLocation: prop.value?.loc,
    })
  }
}
export function isBuiltinTag(tag: string) {
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
  if (context.scopeId) {
    attrs.push(`${context.scopeId}=""`)
  }
  const mappedTagClass = resolveMappedHtmlTagClassName(node.tag, context, resolvedTag)
  let staticClass: string | undefined
  let staticId: string | undefined
  let dynamicClassExp: string | undefined
  let dynamicClassLocation: typeof node.loc | undefined
  let staticStyle: string | undefined
  let dynamicStyleExp: string | undefined
  let dynamicStyleLocation: typeof node.loc | undefined
  let vShowExp: string | undefined
  let vShowLocation: typeof node.loc | undefined
  let vTextExp: string | undefined
  let templateRef: { name?: string, expAst?: Expression } | undefined
  let layoutHostKey: string | undefined
  let hasDynamicIdBinding = false
  const inFor = Boolean(options?.forInfo || context.forStack.length)

  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      recordStaticAttributeBindings(prop, context, isComponentElement)
      if (prop.name === 'layout-host') {
        const rawKey = prop.value?.type === NodeTypes.TEXT ? prop.value.content.trim() : ''
        if (!isComponentElement) {
          warn(context, 'layout-host 仅支持声明在组件节点上，当前节点已忽略。', prop.loc)
        }
        else if (!rawKey) {
          warn(context, 'layout-host 需要提供非空字符串 key。', prop.loc)
        }
        else {
          layoutHostKey = rawKey
        }
        continue
      }
      if (
        prop.name === 'slot-wrapper'
        || prop.name.startsWith('slot-wrapper-')
        || prop.name.startsWith('slot-wrapper:')
        || prop.name === 'slot-single-root-no-wrapper'
        || prop.name.startsWith('slot-single-root-no-wrapper-')
        || prop.name.startsWith('slot-single-root-no-wrapper:')
      ) {
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
      const attr = transformAttribute(prop, context, isComponentElement ? normalizeComponentHostName(prop.name) : undefined)
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
        warn(context, '暂不支持动态 layout-host，已忽略该绑定。', prop.loc)
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && (
          prop.arg.content === 'slot-wrapper'
          || prop.arg.content.startsWith('slot-wrapper-')
          || prop.arg.content.startsWith('slot-wrapper:')
          || prop.arg.content === 'slot-single-root-no-wrapper'
          || prop.arg.content.startsWith('slot-single-root-no-wrapper-')
          || prop.arg.content.startsWith('slot-single-root-no-wrapper:')
        )
      ) {
        if (
          prop.arg.content.endsWith('-class')
          || prop.arg.content.endsWith(':class')
          || prop.arg.content.endsWith('-style')
          || prop.arg.content.endsWith(':style')
        ) {
          continue
        }
        warn(context, `暂不支持动态 ${prop.arg.content}，已忽略该绑定。`, prop.loc)
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'class'
      ) {
        dynamicClassExp = getBindDirectiveExpression(prop) || undefined
        dynamicClassLocation = prop.exp?.loc ?? prop.loc
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'style'
      ) {
        dynamicStyleExp = getBindDirectiveExpression(prop) || undefined
        dynamicStyleLocation = prop.exp?.loc ?? prop.loc
        continue
      }
      if (prop.name === 'show' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        vShowExp = prop.exp.content
        vShowLocation = prop.exp.loc
        continue
      }
      if (prop.name === 'text' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        const rawExp = prop.exp.content
        const runtimeExp = shouldFallbackToRuntimeBinding(rawExp, context.templateSafeCallNames)
          ? registerRuntimeBindingExpression(rawExp, context, { hint: 'v-text' })
          : null
        vTextExp = runtimeExp ?? normalizeWxmlExpressionWithContext(rawExp, context)
        recordBindingExpression(context, {
          kind: 'text',
          expression: rawExp,
          outputPath: runtimeExp?.split('[')[0],
          sourceLocation: prop.exp.loc,
        })
        continue
      }
      const bindingCount = context.classStyleBindings.length
      const functionPropCount = context.functionPropPaths.size
      const inlineExpressionCount = context.inlineExpressions.length
      const dir = transformDirective(prop, context, node, options?.forInfo, { isComponent: isComponentElement })
      if (prop.name === 'bind' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        const arg = prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.arg.content : ''
        if (arg && arg !== 'ref' && arg !== 'class' && arg !== 'style' && arg !== 'key' && arg !== 'layout-host') {
          const generatedBinding = context.classStyleBindings
            .slice(bindingCount)
            .find(binding => binding.type === 'bind')
          recordBindingExpression(context, {
            kind: isComponentElement ? 'component-prop' : 'attribute',
            expression: getBindDirectiveExpression(prop),
            outputPath: generatedBinding?.name,
            sourceLocation: prop.exp.loc,
          })
        }
      }
      else if (prop.name === 'model' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        context.bindingManifest.features.model = true
        recordBindingExpression(context, {
          kind: isComponentElement ? 'component-prop' : 'attribute',
          expression: prop.exp.content,
          sourceLocation: prop.exp.loc,
        })
      }
      if (context.functionPropPaths.size > functionPropCount) {
        context.bindingManifest.features.functionProps = true
      }
      if (context.inlineExpressions.length > inlineExpressionCount) {
        context.bindingManifest.features.inlineEvents = true
      }
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  if (mappedTagClass) {
    staticClass = prependStaticClass(staticClass, mappedTagClass)
  }

  if (templateRef) {
    const refIndex = context.templateRefIndexSeed++
    const className = `${WEVU_TEMPLATE_REF_CLASS_PREFIX}${refIndex}`
    staticClass = staticClass ? `${staticClass} ${className}` : className
    context.templateRefs.push({
      selector: `.${className}`,
      inFor,
      name: templateRef.name,
      expAst: templateRef.expAst,
      kind: isComponentElement ? 'component' : 'element',
    })
    context.bindingManifest.features.templateRefs = true
  }

  if (layoutHostKey) {
    if (!staticId && hasDynamicIdBinding) {
      warn(context, 'layout-host 暂不支持与动态 id 同时使用，当前节点已忽略。', node.loc)
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
      context.bindingManifest.features.templateRefs = true
      context.layoutHosts.push({
        key: layoutHostKey,
        refName: hostRefName,
        selector: `#${hostId}`,
        kind: 'component',
      })
      context.bindingManifest.features.layout = true
    }
  }

  if (staticId) {
    attrs.unshift(`id="${staticId}"`)
  }

  const classBindingCount = context.classStyleBindings.length
  const classAttr = renderClassAttribute(staticClass, dynamicClassExp, context)
  if (dynamicClassExp) {
    const generatedBinding = context.classStyleBindings
      .slice(classBindingCount)
      .find(binding => binding.type === 'class')
    recordBindingExpression(context, {
      kind: 'class',
      expression: dynamicClassExp,
      outputPath: generatedBinding?.name,
      sourceLocation: dynamicClassLocation,
    })
  }
  if (classAttr) {
    attrs.unshift(classAttr)
  }
  const styleBindingCount = context.classStyleBindings.length
  const styleAttr = renderStyleAttribute(
    staticStyle,
    context.cssVars
      ? dynamicStyleExp ? `[${dynamicStyleExp}, ${WEVU_CSS_VARS_STYLE_KEY}]` : WEVU_CSS_VARS_STYLE_KEY
      : dynamicStyleExp,
    vShowExp,
    context,
  )
  const generatedStyleBinding = context.classStyleBindings
    .slice(styleBindingCount)
    .find(binding => binding.type === 'style')
  if (dynamicStyleExp) {
    recordBindingExpression(context, {
      kind: 'style',
      expression: dynamicStyleExp,
      outputPath: generatedStyleBinding?.name,
      sourceLocation: dynamicStyleLocation,
    })
  }
  if (vShowExp) {
    recordBindingExpression(context, {
      kind: 'style',
      expression: vShowExp,
      outputPath: generatedStyleBinding?.name,
      sourceLocation: vShowLocation,
    })
  }
  if (context.cssVars) {
    recordBindingExpression(context, {
      kind: 'style',
      expression: WEVU_CSS_VARS_STYLE_KEY,
      outputPath: generatedStyleBinding?.name,
    })
  }
  if (styleAttr) {
    attrs.unshift(styleAttr)
  }

  return { attrs, vTextExp }
}
