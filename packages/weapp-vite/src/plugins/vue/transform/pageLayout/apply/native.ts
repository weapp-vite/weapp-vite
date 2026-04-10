import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import type { LayoutPropValue, ResolvedPageLayout, ResolvedPageLayoutPlan } from '../types'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate } from '../../../../../utils/babel'
import { createStaticObjectKey, findNativePageOptionsObject, getObjectPropertyByKey, stripDefinePageMetaCalls, stripTypeSyntaxFromAst } from '../ast'

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
