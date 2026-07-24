import type { File, FunctionDeclaration, JSXElement, JSXFragment } from '@weapp-vite/ast/babelTypes'
import type { StaticTemplateCompileResult, StaticTemplateRoot } from './types.ts'
import { BABEL_TS_MODULE_PARSER_OPTIONS, generate, parse } from '@weapp-vite/ast'
import * as t from '@weapp-vite/ast/babelTypes'
import { renderStaticTemplate } from './render.ts'

function findFunctionDeclaration(ast: File, componentName: string): FunctionDeclaration | undefined {
  for (const statement of ast.program.body) {
    if (t.isFunctionDeclaration(statement) && statement.id?.name === componentName) {
      return statement
    }
    if (
      t.isExportNamedDeclaration(statement)
      && t.isFunctionDeclaration(statement.declaration)
      && statement.declaration.id?.name === componentName
    ) {
      return statement.declaration
    }
  }
  return undefined
}

function findReturnedTemplate(component: FunctionDeclaration): StaticTemplateRoot | undefined {
  for (const statement of component.body.body) {
    if (!t.isReturnStatement(statement) || !statement.argument) {
      continue
    }
    if (t.isJSXElement(statement.argument) || t.isJSXFragment(statement.argument)) {
      return statement.argument as JSXElement | JSXFragment
    }
  }
  return undefined
}

export function compileStaticReactPage(
  source: string,
  filename: string,
  componentName = 'ReactStaticPage',
): StaticTemplateCompileResult {
  const ast = parse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as File
  const component = findFunctionDeclaration(ast, componentName)
  if (!component) {
    throw new Error(`未找到 static template 组件 ${componentName}`)
  }
  const root = findReturnedTemplate(component)
  if (!root) {
    throw new Error(`static template 组件 ${componentName} 必须直接 return JSX`)
  }

  const context = {
    slots: [],
    slotSeed: 0,
  }
  const template = renderStaticTemplate(root, context)
  const generated = generate(ast, {
    sourceFileName: filename,
    sourceMaps: true,
  }, source)

  return {
    code: generated.code,
    slots: context.slots,
    template,
  }
}

export type { StaticTemplateCompileResult, StaticTemplateSlot } from './types.ts'
