import type { File, FunctionDeclaration, JSXElement, JSXFragment } from '@weapp-vite/ast/babelTypes'
import type { StaticTemplateCompileResult, StaticTemplateRoot } from './types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, generate, parse } from '@weapp-vite/ast'
import * as t from '@weapp-vite/ast/babelTypes'
import { renderStaticTemplate } from './render'

const REACT_RUNTIME_MODULE_ID = '@weapp-vite/react'

export class ReactNativeBridgeStaticError extends Error {
  constructor(filename: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    super(`[react] ${filename} 使用了原生组件 bridge，组件结构必须可静态分析：${message}`, { cause })
    this.name = 'ReactNativeBridgeStaticError'
  }
}

function collectRuntimeImportNames(ast: File, importedName: string) {
  const names = new Set<string>()
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement) || statement.source.value !== REACT_RUNTIME_MODULE_ID) {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported, { name: importedName })) {
        names.add(specifier.local.name)
      }
    }
  }
  return names
}

function collectNativeComponentTags(ast: File, factoryNames: Set<string>) {
  const tags = new Map<string, string>()
  for (const statement of ast.program.body) {
    const declaration = t.isVariableDeclaration(statement)
      ? statement
      : t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)
        ? statement.declaration
        : undefined
    if (!declaration) {
      continue
    }
    for (const item of declaration.declarations) {
      if (
        !t.isIdentifier(item.id)
        || !t.isCallExpression(item.init)
        || !t.isIdentifier(item.init.callee)
        || !factoryNames.has(item.init.callee.name)
      ) {
        continue
      }
      const [tagArgument] = item.init.arguments
      if (!t.isStringLiteral(tagArgument) || !tagArgument.value) {
        throw new Error('createNativeComponent 的 tagName 必须是非空字符串字面量')
      }
      tags.set(item.id.name, tagArgument.value)
    }
  }
  return tags
}

function collectNativeBridgeContext(ast: File) {
  const factoryNames = collectRuntimeImportNames(ast, 'createNativeComponent')
  return {
    nativeComponentTags: collectNativeComponentTags(ast, factoryNames),
    slotComponentNames: collectRuntimeImportNames(ast, 'Slot'),
  }
}

export function hasNativeComponentBridge(source: string) {
  const ast = parse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as File
  return collectNativeBridgeContext(ast).nativeComponentTags.size > 0
}

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

function findFirstFunctionDeclaration(ast: File): FunctionDeclaration | undefined {
  for (const statement of ast.program.body) {
    const candidate = t.isFunctionDeclaration(statement)
      ? statement
      : t.isExportNamedDeclaration(statement) && t.isFunctionDeclaration(statement.declaration)
        ? statement.declaration
        : undefined
    if (candidate?.id && findReturnedTemplate(candidate)) {
      return candidate
    }
  }
  return undefined
}

export function compileStaticReactPage(
  source: string,
  filename: string,
  componentName?: string,
): StaticTemplateCompileResult {
  const ast = parse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as File
  const bridgeContext = collectNativeBridgeContext(ast)
  try {
    const component = componentName
      ? findFunctionDeclaration(ast, componentName)
      : findFirstFunctionDeclaration(ast)
    if (!component) {
      throw new Error(`未找到直接 return JSX 的 static template 组件${componentName ? ` ${componentName}` : ''}`)
    }
    const root = findReturnedTemplate(component)
    if (!root) {
      throw new Error(`static template 组件 ${componentName ?? component.id?.name ?? ''} 必须直接 return JSX`)
    }

    const context = {
      ...bridgeContext,
      slots: [],
      slotSeed: 0,
      usedNativeComponents: new Set<string>(),
    }
    const template = renderStaticTemplate(root, context)
    const generated = generate(ast, {
      sourceFileName: filename,
      sourceMaps: true,
    }, source)

    return {
      code: generated.code,
      nativeComponents: [...context.usedNativeComponents].sort(),
      slots: context.slots,
      template,
    }
  }
  catch (error) {
    if (bridgeContext.nativeComponentTags.size > 0 && !(error instanceof ReactNativeBridgeStaticError)) {
      throw new ReactNativeBridgeStaticError(filename, error)
    }
    throw error
  }
}

export type { StaticTemplateCompileResult, StaticTemplateSlot } from './types'
