import type { SourceEdit, SyntaxNode } from './ast'
import { parse } from '@babel/parser'
import { applySourceEdits, createUniqueName, patternIdentifiers } from './ast'
import { rewriteImportReferences } from './bindings'

interface Span {
  start?: number | null
  end?: number | null
}

function position(node: Span, edge: 'start' | 'end') {
  const value = node[edge]
  if (typeof value !== 'number') {
    throw new SyntaxError('Missing source range in mini-program module syntax.')
  }
  return value
}

function identifierName(node: { type: string, name?: string, value?: unknown }) {
  return node.type === 'Identifier' ? String(node.name) : String(node.value)
}

/** 同步转换静态 ESM；CJS 保留原字节，Node 与浏览器共享导入和导出语义。 */
export function transformMiniProgramModule(source: string) {
  if (!/\b(?:import|export)\b/.test(source)) {
    return source
  }
  const ast = parse(source, { sourceType: 'unambiguous', allowReturnOutsideFunction: true, tokens: true })
  const moduleNodes = ast.program.body.filter(node => ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportDefaultDeclaration', 'ExportAllDeclaration'].includes(node.type))
  if (moduleNodes.length === 0) {
    return source
  }
  const root = ast.program as unknown as SyntaxNode
  const fresh = createUniqueName(root)
  const moduleName = fresh()
  const requireName = fresh()
  const objectName = fresh()
  const bindingsName = fresh()
  const dependencies = new Map<string, string>()
  const imports = new Map<string, string>()
  const exports = new Map<string, string>()
  const hoistedDefaultNames: string[] = []
  const starExports: string[] = []
  const edits: SourceEdit[] = []
  const dependency = (request: string) => {
    let name = dependencies.get(request)
    if (!name) {
      name = fresh()
      dependencies.set(request, name)
    }
    return name
  }
  const remove = (node: Span) => edits.push({ start: position(node, 'start'), end: position(node, 'end'), content: '' })
  const own = (object: string, key: string) => `${objectName}.prototype.hasOwnProperty.call(${object}, ${key})`

  for (const node of moduleNodes) {
    if ('attributes' in node && node.attributes?.length) {
      throw new SyntaxError('Import attributes are not supported by the synchronous mini-program module loader.')
    }
    if (node.type === 'ImportDeclaration') {
      if (node.phase) {
        throw new SyntaxError('Import phases are not supported by the synchronous mini-program module loader.')
      }
      const namespace = dependency(node.source.value)
      for (const specifier of node.specifiers) {
        const binding = specifier.type === 'ImportNamespaceSpecifier'
          ? namespace
          : specifier.type === 'ImportDefaultSpecifier'
            ? `${namespace} != null && ${own(namespace, '"default"')} ? ${namespace}.default : ${namespace}`
            : `${namespace}[${JSON.stringify(identifierName(specifier.imported))}]`
        imports.set(specifier.local.name, binding)
      }
      remove(node)
    }
    else if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        edits.push({ start: position(node, 'start'), end: position(node.declaration, 'start'), content: '' })
        const patterns = node.declaration.type === 'VariableDeclaration'
          ? node.declaration.declarations.map(declaration => declaration.id)
          : 'id' in node.declaration && node.declaration.id ? [node.declaration.id] : []
        for (const pattern of patterns) {
          for (const identifier of patternIdentifiers(pattern as unknown as SyntaxNode)) {
            exports.set(String(identifier.name), String(identifier.name))
          }
        }
      }
      else {
        const namespace = node.source ? dependency(node.source.value) : undefined
        for (const specifier of node.specifiers) {
          const exported = identifierName(specifier.exported)
          if (specifier.type === 'ExportNamespaceSpecifier' && namespace) {
            exports.set(exported, namespace)
          }
          else if (specifier.type === 'ExportSpecifier') {
            const local = identifierName(specifier.local)
            exports.set(exported, namespace ? `${namespace}[${JSON.stringify(local)}]` : local)
          }
          else {
            throw new SyntaxError(`Unsupported mini-program export specifier: ${specifier.type}.`)
          }
        }
        remove(node)
      }
    }
    else if (node.type === 'ExportAllDeclaration') {
      starExports.push(dependency(node.source.value))
      remove(node)
    }
    else if (node.type === 'ExportDefaultDeclaration') {
      const declaration = node.declaration
      const defaultToken = ast.tokens?.find(token => token.start > position(node, 'start') && token.end <= position(declaration, 'start') && token.type.label === 'default')
      if (!defaultToken) {
        throw new SyntaxError('Missing default export token in mini-program module syntax.')
      }
      if (declaration.type === 'FunctionDeclaration' && !declaration.id) {
        const name = fresh()
        const keyword = ast.tokens?.find(token => token.start >= position(declaration, 'start') && token.type.label === 'function')
        const nameToken = declaration.generator
          ? ast.tokens?.find(token => token.start >= (keyword?.end ?? position(declaration, 'start')) && token.type.label === '*')
          : keyword
        if (!nameToken) {
          throw new SyntaxError('Missing default function token in mini-program module syntax.')
        }
        exports.set('default', name)
        hoistedDefaultNames.push(name)
        edits.push({ start: position(node, 'start'), end: defaultToken.end, content: '' })
        edits.push({ start: nameToken.end, end: nameToken.end, content: ` ${name}` })
      }
      else if ((declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') && declaration.id) {
        exports.set('default', declaration.id.name)
        edits.push({ start: position(node, 'start'), end: defaultToken.end, content: '' })
      }
      else {
        const name = fresh()
        exports.set('default', name)
        edits.push({ start: position(node, 'start'), end: defaultToken.end, content: `const ${name} = ` })
        edits.push({ start: position(node, 'end'), end: position(node, 'end'), content: ';' })
      }
    }
  }
  edits.push(...rewriteImportReferences(root, new Set(imports.keys()), bindingsName))
  const declarations = [
    dependencies.size ? `let ${[...dependencies.values()].join(', ')};` : '',
    `const ${bindingsName} = ${objectName}.create(null);`,
    ...[...imports].map(([name, expression]) => `${objectName}.defineProperty(${bindingsName}, ${JSON.stringify(name)}, { get: () => (${expression}) });`),
    ...[...exports].map(([name, expression]) => {
      const value = imports.has(expression) ? `${bindingsName}[${JSON.stringify(expression)}]` : expression
      return `${objectName}.defineProperty(${moduleName}.exports, ${JSON.stringify(name)}, { enumerable: true, get: () => ${value} });`
    }),
    ...hoistedDefaultNames.map(name => `${objectName}.defineProperty(${name}, 'name', { value: 'default', configurable: true });`),
    ...[...dependencies].map(([request, namespace]) => `${namespace} = ${requireName}(${JSON.stringify(request)});`),
  ]
  if (starExports.length) {
    const owners = fresh()
    const namespace = fresh()
    const key = fresh()
    declarations.push(`
      const ${owners} = ${objectName}.create(null);
      for (const ${namespace} of [${starExports.join(', ')}]) {
        for (const ${key} of ${objectName}.keys(${namespace})) {
          if (${key} === 'default' || ${own(`${moduleName}.exports`, key)}) continue;
          ${owners}[${key}] = ${own(owners, key)} && ${owners}[${key}] !== ${namespace} ? null : ${namespace};
        }
      }
      for (const ${key} of ${objectName}.keys(${owners})) {
        if (${owners}[${key}] !== null) ${objectName}.defineProperty(${moduleName}.exports, ${key}, { enumerable: true, get: () => ${owners}[${key}][${key}] });
      }
    `)
  }
  // 构建器可在 ESM 正文前注入 CJS runtime 导出；正文执行完成后再封口，保留这类产物的注册时机。
  return `(function(${moduleName}, ${requireName}, ${objectName}) {\n"use strict";\n${declarations.join('\n')}\n${applySourceEdits(source, edits)}\n${objectName}.preventExtensions(${moduleName}.exports);\n}).call(undefined, module, require, Object);`
}
