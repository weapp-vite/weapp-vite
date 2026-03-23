import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import type { VueTransformResult } from 'wevu/compiler'
import type { LayoutPropValue, LayoutTransformLikeResult, ResolvedPageLayout, ResolvedPageLayoutPlan } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate } from '../../../../utils/babel'
import { createStaticObjectKey, findNativePageOptionsObject, findWevuOptionsObject, getObjectPropertyByKey, parseExpressionAst, stripDefinePageMetaCalls, stripTypeSyntaxFromAst } from './ast'
import { buildDynamicLayoutTemplate, collapseNestedLayoutWrapper, hasDynamicExpressionLayoutProps, serializeLayoutProps } from './template'

function mergeLayoutUsingComponent(config: string | undefined, tagName: string, importPath: string) {
  const parsed = config ? JSON.parse(config) : {}
  const usingComponents = parsed.usingComponents && typeof parsed.usingComponents === 'object' && !Array.isArray(parsed.usingComponents)
    ? parsed.usingComponents
    : {}

  usingComponents[tagName] = importPath
  parsed.usingComponents = usingComponents
  return JSON.stringify(parsed, null, 2)
}

function injectNativePageLayoutSetter(pageOptions: t.ObjectExpression) {
  const existing = getObjectPropertyByKey(pageOptions, '__wevuSetPageLayout')
  if (existing) {
    return
  }

  pageOptions.properties.push(
    t.objectMethod(
      'method',
      createStaticObjectKey('__wevuSetPageLayout'),
      [t.identifier('layout'), t.identifier('props')],
      t.blockStatement([
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('__wv_next_layout_name'),
            t.conditionalExpression(
              t.binaryExpression('===', t.identifier('layout'), t.booleanLiteral(false)),
              t.stringLiteral('__wv_no_layout'),
              t.identifier('layout'),
            ),
          ),
        ]),
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('__wv_next_layout_props'),
            t.conditionalExpression(
              t.binaryExpression('===', t.identifier('layout'), t.booleanLiteral(false)),
              t.objectExpression([]),
              t.logicalExpression('||', t.identifier('props'), t.objectExpression([])),
            ),
          ),
        ]),
        t.expressionStatement(
          t.callExpression(
            t.memberExpression(t.thisExpression(), t.identifier('setData')),
            [
              t.objectExpression([
                t.objectProperty(t.identifier('__wv_page_layout_name'), t.identifier('__wv_next_layout_name')),
                t.objectProperty(t.identifier('__wv_page_layout_props'), t.identifier('__wv_next_layout_props')),
              ]),
            ],
          ),
        ),
      ]),
    ),
  )
}

function injectLayoutBindingComputed(script: string | undefined, props: Record<string, LayoutPropValue> | undefined) {
  if (!script || !props) {
    return script
  }

  const runtimeEntries = Object.entries(props)
    .filter((entry): entry is [string, { kind: 'expression', expression: string }] => typeof entry[1] === 'object' && entry[1] !== null && 'kind' in entry[1] && entry[1].kind === 'expression')

  if (runtimeEntries.length === 0) {
    return script
  }

  const ast = babelParse(script, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
  const optionsObject = findWevuOptionsObject(ast)
  if (!optionsObject) {
    return script
  }

  const computedEntries = runtimeEntries.map(([key, value]) => {
    const expressionAst = parseExpressionAst(value.expression) ?? t.identifier('undefined')
    return t.objectProperty(
      createStaticObjectKey(`__wv_layout_bind_${key}`),
      t.functionExpression(
        null,
        [],
        t.blockStatement([
          t.tryStatement(
            t.blockStatement([
              t.returnStatement(expressionAst),
            ]),
            t.catchClause(
              t.identifier('__wv_expr_err'),
              t.blockStatement([
                t.returnStatement(t.identifier('undefined')),
              ]),
            ),
            null,
          ),
        ]),
      ),
    )
  })

  const computedProp = getObjectPropertyByKey(optionsObject, 'computed')
  if (!computedProp) {
    optionsObject.properties.unshift(
      t.objectProperty(createStaticObjectKey('computed'), t.objectExpression(computedEntries)),
    )
  }
  else if (t.isObjectExpression(computedProp.value)) {
    const computedValue = computedProp.value as t.ObjectExpression
    computedValue.properties.push(...computedEntries)
  }
  else if (t.isIdentifier(computedProp.value) || t.isMemberExpression(computedProp.value)) {
    computedProp.value = t.objectExpression([
      ...computedEntries,
      t.spreadElement(t.cloneNode(computedProp.value, true)),
    ])
  }
  else {
    return script
  }

  return generate(ast, { retainLines: true }).code
}

function mergeLayoutUsingComponents(
  config: string | undefined,
  layouts: ResolvedPageLayout[],
) {
  let next = config
  for (const layout of layouts) {
    next = mergeLayoutUsingComponent(next, layout.tagName, layout.importPath)
  }
  return next
}

function hasDynamicLayoutTemplateWrapper(
  template: string,
  plan: ResolvedPageLayoutPlan,
) {
  if (!plan.layouts.length || !template.startsWith('<block wx:if=')) {
    return false
  }

  return plan.layouts.every((layout, index) => {
    const condition = plan.currentLayout?.layoutName === layout.layoutName
      ? `{{!__wv_page_layout_name || __wv_page_layout_name === '${layout.layoutName}'}}`
      : `{{__wv_page_layout_name === '${layout.layoutName}'}}`
    const directive = index === 0 ? 'wx:if' : 'wx:elif'

    return template.includes(`<block ${directive}="${condition}"><${layout.tagName}`)
  }) && template.includes('<block wx:else>')
}

export function applyPageLayout(
  result: VueTransformResult,
  _filename: string,
  layout: ResolvedPageLayout | undefined,
) {
  if (!layout || !result.template) {
    return result
  }

  const serializedProps = serializeLayoutProps(layout.props)
  if (result.template.startsWith(`<${layout.tagName}`)) {
    result.template = collapseNestedLayoutWrapper(result.template, layout.tagName)
    result.script = injectLayoutBindingComputed(result.script, layout.props)
    result.config = mergeLayoutUsingComponent(result.config, layout.tagName, layout.importPath)
    return result
  }
  result.template = `<${layout.tagName}${serializedProps}>${result.template}</${layout.tagName}>`
  result.script = injectLayoutBindingComputed(result.script, layout.props)
  result.config = mergeLayoutUsingComponent(result.config, layout.tagName, layout.importPath)

  return result
}

export function applyPageLayoutPlan(
  result: VueTransformResult,
  filename: string,
  plan: ResolvedPageLayoutPlan | undefined,
) {
  if (!plan || !result.template) {
    return result
  }

  if (!plan.dynamicSwitch) {
    return applyPageLayout(result, filename, plan.currentLayout)
  }

  if (hasDynamicLayoutTemplateWrapper(result.template, plan)) {
    result.script = injectLayoutBindingComputed(result.script, plan.currentLayout?.props)
    result.config = mergeLayoutUsingComponents(result.config, plan.layouts)
    return result
  }

  result.template = buildDynamicLayoutTemplate(result.template, plan.currentLayout, plan.layouts, plan.dynamicPropKeys)
  result.script = injectLayoutBindingComputed(result.script, plan.currentLayout?.props)
  result.config = mergeLayoutUsingComponents(result.config, plan.layouts)
  return result
}

export function applyPageLayoutPlanToNativePage(
  result: LayoutTransformLikeResult,
  filename: string,
  plan: ResolvedPageLayoutPlan | undefined,
) {
  if (!plan || !result.template) {
    return result
  }

  if (hasDynamicExpressionLayoutProps(plan.currentLayout?.props)) {
    throw new Error(`${filename} 中原生 Page 的 layout.props 暂不支持表达式，请改用静态字面量或在运行时调用 setPageLayout()。`)
  }

  return applyPageLayoutPlan(result as VueTransformResult, filename, plan)
}

export function injectNativePageLayoutRuntime(
  script: string | undefined,
  filename: string,
  plan: ResolvedPageLayoutPlan | undefined,
) {
  if (!script) {
    return script
  }

  const ast = babelParse(script, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
  stripTypeSyntaxFromAst(ast)
  const strippedMeta = stripDefinePageMetaCalls(ast)
  const shouldInjectSetter = Boolean(plan?.dynamicSwitch)

  if (!shouldInjectSetter && !strippedMeta) {
    return script
  }

  if (!shouldInjectSetter) {
    return generate(ast, { retainLines: true }).code
  }

  const pageOptions = findNativePageOptionsObject(ast)
  if (!pageOptions) {
    throw new Error(`${filename} 中未找到可注入 layout 运行时的 Page({}) 定义。`)
  }

  injectNativePageLayoutSetter(pageOptions)
  return generate(ast, { retainLines: true }).code
}
