import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import type { LayoutPropValue, ResolvedPageLayout, ResolvedPageLayoutPlan } from '../types'
import {
  WEVU_INTERNAL_KEY_IDENTIFIER,
  WEVU_PAGE_LAYOUT_CURRENT_NAME_IDENTIFIER,
  WEVU_PAGE_LAYOUT_CURRENT_PROPS_IDENTIFIER,
  WEVU_PAGE_LAYOUT_NAME_KEY,
  WEVU_PAGE_LAYOUT_NEXT_NAME_IDENTIFIER,
  WEVU_PAGE_LAYOUT_NEXT_PROPS_IDENTIFIER,
  WEVU_PAGE_LAYOUT_NONE,
  WEVU_PAGE_LAYOUT_PROPS_KEY,
  WEVU_PAGE_LAYOUT_SETTER_KEY,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate } from '../../../../../utils/babel'
import { createStaticObjectKey, findNativePageOptionsObject, getObjectPropertyByKey, stripDefinePageMetaCalls, stripTypeSyntaxFromAst } from '../ast'

function injectNativePageLayoutSetter(pageOptions: t.ObjectExpression) {
  const existing = getObjectPropertyByKey(pageOptions, WEVU_PAGE_LAYOUT_SETTER_KEY)
  if (existing) {
    return
  }

  pageOptions.properties.push(
    t.objectMethod(
      'method',
      createStaticObjectKey(WEVU_PAGE_LAYOUT_SETTER_KEY),
      [t.identifier('layout'), t.identifier('props')],
      t.blockStatement([
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(WEVU_PAGE_LAYOUT_NEXT_NAME_IDENTIFIER),
            t.conditionalExpression(
              t.binaryExpression('===', t.identifier('layout'), t.booleanLiteral(false)),
              t.stringLiteral(WEVU_PAGE_LAYOUT_NONE),
              t.identifier('layout'),
            ),
          ),
        ]),
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(WEVU_PAGE_LAYOUT_NEXT_PROPS_IDENTIFIER),
            t.conditionalExpression(
              t.binaryExpression('===', t.identifier('layout'), t.booleanLiteral(false)),
              t.objectExpression([]),
              t.logicalExpression('||', t.identifier('props'), t.objectExpression([])),
            ),
          ),
        ]),
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(WEVU_PAGE_LAYOUT_CURRENT_NAME_IDENTIFIER),
            t.memberExpression(
              t.memberExpression(t.thisExpression(), t.identifier('data')),
              t.identifier(WEVU_PAGE_LAYOUT_NAME_KEY),
            ),
          ),
        ]),
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(WEVU_PAGE_LAYOUT_CURRENT_PROPS_IDENTIFIER),
            t.logicalExpression(
              '||',
              t.memberExpression(
                t.memberExpression(t.thisExpression(), t.identifier('data')),
                t.identifier(WEVU_PAGE_LAYOUT_PROPS_KEY),
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
              t.identifier(WEVU_PAGE_LAYOUT_CURRENT_NAME_IDENTIFIER),
              t.identifier(WEVU_PAGE_LAYOUT_NEXT_NAME_IDENTIFIER),
            ),
            t.callExpression(
              t.memberExpression(
                t.callExpression(
                  t.memberExpression(t.identifier('Object'), t.identifier('keys')),
                  [t.identifier(WEVU_PAGE_LAYOUT_CURRENT_PROPS_IDENTIFIER)],
                ),
                t.identifier('every'),
              ),
              [
                t.arrowFunctionExpression(
                  [t.identifier(WEVU_INTERNAL_KEY_IDENTIFIER)],
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
                      [t.identifier(WEVU_PAGE_LAYOUT_NEXT_PROPS_IDENTIFIER), t.identifier(WEVU_INTERNAL_KEY_IDENTIFIER)],
                    ),
                    t.callExpression(
                      t.memberExpression(t.identifier('Object'), t.identifier('is')),
                      [
                        t.memberExpression(t.identifier(WEVU_PAGE_LAYOUT_CURRENT_PROPS_IDENTIFIER), t.identifier(WEVU_INTERNAL_KEY_IDENTIFIER), true),
                        t.memberExpression(t.identifier(WEVU_PAGE_LAYOUT_NEXT_PROPS_IDENTIFIER), t.identifier(WEVU_INTERNAL_KEY_IDENTIFIER), true),
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
                    [t.identifier(WEVU_PAGE_LAYOUT_CURRENT_PROPS_IDENTIFIER)],
                  ),
                  t.identifier('length'),
                ),
                t.memberExpression(
                  t.callExpression(
                    t.memberExpression(t.identifier('Object'), t.identifier('keys')),
                    [t.identifier(WEVU_PAGE_LAYOUT_NEXT_PROPS_IDENTIFIER)],
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
                t.objectProperty(t.identifier(WEVU_PAGE_LAYOUT_NAME_KEY), t.identifier(WEVU_PAGE_LAYOUT_NEXT_NAME_IDENTIFIER)),
                t.objectProperty(t.identifier(WEVU_PAGE_LAYOUT_PROPS_KEY), t.identifier(WEVU_PAGE_LAYOUT_NEXT_PROPS_IDENTIFIER)),
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
      t.identifier(WEVU_PAGE_LAYOUT_NAME_KEY),
      layoutName ? t.stringLiteral(layoutName) : t.identifier('undefined'),
    ),
    t.objectProperty(
      t.identifier(WEVU_PAGE_LAYOUT_PROPS_KEY),
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
    const layoutNameProp = getObjectPropertyByKey(dataObject, WEVU_PAGE_LAYOUT_NAME_KEY)
    const layoutPropsProp = getObjectPropertyByKey(dataObject, WEVU_PAGE_LAYOUT_PROPS_KEY)
    if (!layoutNameProp) {
      dataObject.properties.unshift(
        t.objectProperty(
          t.identifier(WEVU_PAGE_LAYOUT_NAME_KEY),
          buildInitialNativePageLayoutNameExpression(currentLayout),
        ),
      )
    }
    if (!layoutPropsProp) {
      dataObject.properties.push(
        t.objectProperty(
          t.identifier(WEVU_PAGE_LAYOUT_PROPS_KEY),
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
