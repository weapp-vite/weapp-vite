import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import type { VueTransformResult } from 'wevu/compiler'
import type { LayoutPropValue, LayoutTransformLikeResult, ResolvedPageLayout, ResolvedPageLayoutPlan } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate } from '../../../../utils/babel'
import { createStaticObjectKey, findNativePageOptionsObject, findWevuOptionsObject, getObjectPropertyByKey, parseExpressionAst, stripDefinePageMetaCalls, stripTypeSyntaxFromAst } from './ast'
import { getLayoutConditionalDirective, getLayoutElseDirective } from './shared'
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
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('__wv_current_layout_name'),
            t.memberExpression(
              t.memberExpression(t.thisExpression(), t.identifier('data')),
              t.identifier('__wv_page_layout_name'),
            ),
          ),
        ]),
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('__wv_current_layout_props'),
            t.logicalExpression(
              '||',
              t.memberExpression(
                t.memberExpression(t.thisExpression(), t.identifier('data')),
                t.identifier('__wv_page_layout_props'),
              ),
              t.objectExpression([]),
            ),
          ),
        ]),
        t.ifStatement(
          t.logicalExpression(
            '&&',
            t.binaryExpression(
              '===',
              t.identifier('__wv_current_layout_name'),
              t.identifier('__wv_next_layout_name'),
            ),
            t.callExpression(
              t.memberExpression(
                t.callExpression(
                  t.memberExpression(t.identifier('Object'), t.identifier('keys')),
                  [t.identifier('__wv_current_layout_props')],
                ),
                t.identifier('every'),
              ),
              [
                t.arrowFunctionExpression(
                  [t.identifier('__wv_key')],
                  t.logicalExpression(
                    '&&',
                    t.callExpression(
                      t.memberExpression(
                        t.memberExpression(
                          t.memberExpression(t.identifier('Object'), t.identifier('prototype')),
                          t.identifier('hasOwnProperty'),
                        ),
                        t.identifier('call'),
                      ),
                      [t.identifier('__wv_next_layout_props'), t.identifier('__wv_key')],
                    ),
                    t.callExpression(
                      t.memberExpression(t.identifier('Object'), t.identifier('is')),
                      [
                        t.memberExpression(t.identifier('__wv_current_layout_props'), t.identifier('__wv_key'), true),
                        t.memberExpression(t.identifier('__wv_next_layout_props'), t.identifier('__wv_key'), true),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          t.blockStatement([
            t.ifStatement(
              t.binaryExpression(
                '===',
                t.memberExpression(
                  t.callExpression(
                    t.memberExpression(t.identifier('Object'), t.identifier('keys')),
                    [t.identifier('__wv_current_layout_props')],
                  ),
                  t.identifier('length'),
                ),
                t.memberExpression(
                  t.callExpression(
                    t.memberExpression(t.identifier('Object'), t.identifier('keys')),
                    [t.identifier('__wv_next_layout_props')],
                  ),
                  t.identifier('length'),
                ),
              ),
              t.blockStatement([
                t.returnStatement(),
              ]),
            ),
          ]),
        ),
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

function toStaticLayoutValueExpression(value: LayoutPropValue | undefined): t.Expression {
  if (typeof value === 'string') {
    return t.stringLiteral(value)
  }
  if (typeof value === 'number') {
    return t.numericLiteral(value)
  }
  if (typeof value === 'boolean') {
    return t.booleanLiteral(value)
  }
  if (value === null) {
    return t.nullLiteral()
  }
  return t.identifier('undefined')
}

function buildInitialNativePageLayoutState(currentLayout: ResolvedPageLayout | undefined) {
  const layoutName = currentLayout?.layoutName
  const layoutProps = currentLayout?.props ?? {}

  return t.objectExpression([
    t.objectProperty(
      t.identifier('__wv_page_layout_name'),
      layoutName ? t.stringLiteral(layoutName) : t.identifier('undefined'),
    ),
    t.objectProperty(
      t.identifier('__wv_page_layout_props'),
      t.objectExpression(
        Object.entries(layoutProps)
          .filter(([, value]) => !(typeof value === 'object' && value && 'kind' in value && value.kind === 'expression'))
          .map(([key, value]) => t.objectProperty(createStaticObjectKey(key), toStaticLayoutValueExpression(value))),
      ),
    ),
  ])
}

function buildInitialNativePageLayoutNameExpression(currentLayout: ResolvedPageLayout | undefined) {
  return currentLayout?.layoutName ? t.stringLiteral(currentLayout.layoutName) : t.identifier('undefined')
}

function buildInitialNativePageLayoutPropsExpression(currentLayout: ResolvedPageLayout | undefined) {
  const layoutProps = currentLayout?.props ?? {}
  return t.objectExpression(
    Object.entries(layoutProps)
      .filter(([, value]) => !(typeof value === 'object' && value && 'kind' in value && value.kind === 'expression'))
      .map(([key, value]) => t.objectProperty(createStaticObjectKey(key), toStaticLayoutValueExpression(value))),
  )
}

function injectNativePageLayoutState(
  pageOptions: t.ObjectExpression,
  currentLayout: ResolvedPageLayout | undefined,
) {
  const initialState = buildInitialNativePageLayoutState(currentLayout)
  const existingData = getObjectPropertyByKey(pageOptions, 'data')

  if (!existingData) {
    pageOptions.properties.unshift(
      t.objectProperty(createStaticObjectKey('data'), initialState),
    )
    return
  }

  if (t.isObjectExpression(existingData.value)) {
    const dataObject = existingData.value
    const layoutNameProp = getObjectPropertyByKey(dataObject, '__wv_page_layout_name')
    const layoutPropsProp = getObjectPropertyByKey(dataObject, '__wv_page_layout_props')
    if (!layoutNameProp) {
      dataObject.properties.unshift(
        t.objectProperty(
          t.identifier('__wv_page_layout_name'),
          buildInitialNativePageLayoutNameExpression(currentLayout),
        ),
      )
    }
    if (!layoutPropsProp) {
      dataObject.properties.push(
        t.objectProperty(
          t.identifier('__wv_page_layout_props'),
          buildInitialNativePageLayoutPropsExpression(currentLayout),
        ),
      )
    }
    return
  }

  existingData.value = t.callExpression(
    t.memberExpression(t.identifier('Object'), t.identifier('assign')),
    [
      t.objectExpression([]),
      existingData.value as t.Expression,
      initialState,
    ],
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
  const firstDirective = getLayoutConditionalDirective(0)
  if (!plan.layouts.length || !template.startsWith(`<block ${firstDirective}=`)) {
    return false
  }

  return plan.layouts.every((layout, index) => {
    const condition = plan.currentLayout?.layoutName === layout.layoutName
      ? `{{!__wv_page_layout_name || __wv_page_layout_name === '${layout.layoutName}'}}`
      : `{{__wv_page_layout_name === '${layout.layoutName}'}}`
    const directive = getLayoutConditionalDirective(index)

    return template.includes(`<block ${directive}="${condition}"><${layout.tagName}`)
  }) && template.includes(`<block ${getLayoutElseDirective()}>`)
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

  injectNativePageLayoutState(pageOptions, plan?.currentLayout)
  injectNativePageLayoutSetter(pageOptions)
  return generate(ast, { retainLines: true }).code
}
