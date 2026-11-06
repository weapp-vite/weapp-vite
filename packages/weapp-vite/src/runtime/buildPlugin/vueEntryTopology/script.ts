import type { File, Node } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, generate, getVisitorKeys, parse } from '../../../utils/babel'

const topologyFields = new Set(['pages', 'subPackages', 'subpackages', 'usingComponents', 'componentGenerics', 'component', 'tabBar', 'appBar', 'plugins'])
const jsonMacro = /^define(?:App|Page|Component|Sitemap|Theme)Json$/

function walk(node: Node, visit: (node: Node, parent?: Node) => void, parent?: Node) {
  visit(node, parent)
  for (const key of getVisitorKeys()[node.type] ?? []) {
    const value = (node as unknown as Record<string, unknown>)[key]
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === 'object' && 'type' in child) {
        walk(child as Node, visit, node)
      }
    }
  }
}

function keyName(property: t.ObjectProperty | t.ObjectMethod) {
  return !property.computed && t.isIdentifier(property.key)
    ? property.key.name
    : t.isStringLiteral(property.key) ? property.key.value : undefined
}

function compact(node: Node) {
  return generate(node, { compact: true, comments: false }).code
}

function references(node: Node) {
  const names = new Set<string>()
  walk(node, (child, parent) => {
    if (t.isIdentifier(child) && parent && t.isReferenced(child, parent)) {
      names.add(child.name)
    }
  })
  return names
}

function selectObjectFields(node: Node, fields: ReadonlySet<string>) {
  if (!t.isObjectExpression(node)) {
    return node
  }
  return t.objectExpression(node.properties.filter(property =>
    t.isSpreadElement(property)
    || (property.computed && !t.isStringLiteral(property.key))
    || fields.has(keyName(property) ?? ''),
  ))
}

function selectPageLayout(node: Node) {
  const selected = selectObjectFields(node, new Set(['layout']))
  if (t.isObjectExpression(selected)) {
    return t.objectExpression(selected.properties.map((property) => {
      if (t.isObjectProperty(property) && keyName(property) === 'layout' && t.isObjectExpression(property.value)) {
        return t.objectProperty(property.key, selectObjectFields(property.value, new Set(['name'])) as t.Expression)
      }
      return property
    }))
  }
  return selected
}

/** 只记录引用结构和静态声明依赖，不执行 JSON、页面元信息或选项宏。 */
export function collectVueScriptTopology(scripts: readonly string[], componentNames: Set<string>, dynamicExpressions: readonly string[]) {
  const programs: File[] = scripts.filter(Boolean).map(source => parse(source, BABEL_TS_MODULE_PARSER_OPTIONS))
  const bindings = new Map<string, Node>()
  const imports = new Map<string, { source: string, imported: string }>()
  const structural: string[] = []
  const roots = new Set([...componentNames].map(name => name.split('.')[0]!))
  for (const expression of dynamicExpressions) {
    const ast = parse(`(${expression})`, BABEL_TS_MODULE_PARSER_OPTIONS)
    structural.push(compact(ast.program))
    for (const name of references(ast)) {
      roots.add(name)
    }
  }
  for (const ast of programs) {
    for (const statement of ast.program.body) {
      if (t.isImportDeclaration(statement)) {
        if (statement.importKind === 'type') {
          continue
        }
        for (const specifier of statement.specifiers) {
          if (t.isImportSpecifier(specifier) && specifier.importKind === 'type') {
            continue
          }
          const imported = t.isImportDefaultSpecifier(specifier)
            ? 'default'
            : t.isImportNamespaceSpecifier(specifier)
              ? '*'
              : t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value
          imports.set(specifier.local.name, { source: statement.source.value, imported })
        }
        continue
      }
      const declaration = t.isExportNamedDeclaration(statement) ? statement.declaration : statement
      if (t.isVariableDeclaration(declaration)) {
        for (const item of declaration.declarations) {
          for (const name of Object.keys(t.getBindingIdentifiers(item.id))) {
            bindings.set(name, item)
          }
        }
      }
      else if (declaration && (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) && declaration.id) {
        bindings.set(declaration.id.name, declaration)
      }
    }
  }
  const record = (node: Node) => {
    if (t.isObjectExpression(node) && !node.properties.length) {
      return
    }
    structural.push(compact(node))
    for (const name of references(node)) {
      roots.add(name)
    }
  }
  for (const ast of programs) {
    walk(ast, (node) => {
      if (t.isObjectProperty(node) && keyName(node) === 'components') {
        if (t.isObjectExpression(node.value)) {
          record(t.objectExpression(node.value.properties.filter(property => t.isSpreadElement(property) || componentNames.has(keyName(property) ?? ''))))
        }
        else {
          record(node.value)
        }
      }
      if (!t.isCallExpression(node) || !t.isIdentifier(node.callee)) {
        return
      }
      const imported = imports.get(node.callee.name)
      // JSON 编译器按原始调用名识别宏；不明 computed 字段保守参与拓扑，避免执行宏。
      const canonicalJsonMacro = jsonMacro.test(node.callee.name)
      if (!canonicalJsonMacro && imported && !/^(?:wevu(?:\/|$)|weapp-vite(?:\/|$)|@weapp-vite\/)/.test(imported.source)) {
        return
      }
      const name = canonicalJsonMacro ? node.callee.name : imported?.imported ?? node.callee.name
      const first = node.arguments[0]
      if (!first || t.isSpreadElement(first) || t.isArgumentPlaceholder(first)) {
        return
      }
      if (jsonMacro.test(name)) {
        record(selectObjectFields(first, topologyFields))
      }
      else if (name === 'definePageMeta') {
        record(selectPageLayout(first))
      }
      else if (name === 'setPageLayout') {
        record(first)
      }
    })
  }
  const reached = new Set<string>()
  const declarations: string[] = []
  const queue = [...roots]
  while (queue.length) {
    const name = queue.pop()!
    if (reached.has(name)) {
      continue
    }
    reached.add(name)
    const imported = imports.get(name)
    if (imported) {
      declarations.push(JSON.stringify([name, imported.source, imported.imported]))
    }
    const declaration = bindings.get(name)
    if (declaration) {
      declarations.push(compact(declaration))
      queue.push(...references(declaration))
    }
  }
  return { declarations: [...new Set(declarations)].sort(), structural: [...new Set(structural)].sort() }
}
