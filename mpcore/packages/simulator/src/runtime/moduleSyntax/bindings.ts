import type { SourceEdit, SyntaxNode } from './ast'
import { childNodes, isSyntaxNode, patternIdentifiers } from './ast'

interface Scope {
  parent?: Scope
  bindings: Set<string>
  variable: boolean
  functionDepth: number
}

const functionTypes = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod'])
const blockTypes = new Set(['BlockStatement', 'CatchClause', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement', 'StaticBlock'])

/** 按词法作用域改写导入引用；声明、键名及同名局部变量保持原样。 */
export function rewriteImportReferences(root: SyntaxNode, imports: Set<string>, bindingName: string) {
  const scopes = new WeakMap<SyntaxNode, Scope>()
  const declarations = new WeakSet<SyntaxNode>()
  const moduleScope: Scope = { bindings: new Set(), variable: true, functionDepth: 0 }
  const declare = (pattern: unknown, scope: Scope) => {
    if (!isSyntaxNode(pattern)) {
      return
    }
    for (const identifier of patternIdentifiers(pattern)) {
      scope.bindings.add(String(identifier.name))
      declarations.add(identifier)
    }
  }
  const visit = (node: SyntaxNode, inherited: Scope, parent?: SyntaxNode, key?: string) => {
    let scope = inherited
    if (functionTypes.has(node.type)) {
      if (node.type === 'FunctionDeclaration') {
        declare(node.id, inherited)
      }
      scope = { parent: inherited, bindings: new Set(), variable: false, functionDepth: inherited.functionDepth + 1 }
      declare(node.id, scope)
      if (Array.isArray(node.params)) {
        node.params.forEach(parameter => declare(parameter, scope))
      }
    }
    else if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      if (node.type === 'ClassDeclaration') {
        declare(node.id, inherited)
      }
      scope = { parent: inherited, bindings: new Set(), variable: false, functionDepth: inherited.functionDepth }
      declare(node.id, scope)
    }
    else if (blockTypes.has(node.type)) {
      scope = {
        parent: inherited,
        bindings: new Set(),
        variable: node.type === 'StaticBlock' || (key === 'body' && !!parent && functionTypes.has(parent.type)),
        functionDepth: inherited.functionDepth,
      }
      if (node.type === 'CatchClause') {
        declare(node.param, scope)
      }
    }
    scopes.set(node, scope)
    if (node.type === 'VariableDeclaration') {
      let owner = scope
      while (node.kind === 'var' && !owner.variable && owner.parent) {
        owner = owner.parent
      }
      for (const child of childNodes(node)) {
        declare(child.node.id, owner)
      }
    }
    if (node.type === 'ImportDeclaration') {
      for (const child of childNodes(node)) {
        if (child.key === 'specifiers') {
          declare(child.node.local, moduleScope)
        }
      }
      return
    }
    if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && isSyntaxNode(node.callee) && node.callee.type === 'Import')) {
      throw new SyntaxError('Dynamic import is not supported by the synchronous mini-program module loader.')
    }
    if (node.type === 'MetaProperty' && isSyntaxNode(node.meta) && node.meta.name === 'import') {
      throw new SyntaxError('import.meta is not supported by the synchronous mini-program module loader.')
    }
    if (scope.functionDepth === 0 && (node.type === 'AwaitExpression' || (node.type === 'ForOfStatement' && node.await))) {
      throw new SyntaxError('Top-level await is not supported by the synchronous mini-program module loader.')
    }
    if (scope.functionDepth === 0 && node.type === 'ReturnStatement') {
      throw new SyntaxError('Top-level return is not valid in a mini-program ES module.')
    }
    for (const child of childNodes(node)) {
      const computedMethodKey = functionTypes.has(node.type) && child.key === 'key'
      const switchDiscriminant = node.type === 'SwitchStatement' && child.key === 'discriminant'
      visit(child.node, computedMethodKey || switchDiscriminant ? inherited : scope, node, child.key)
    }
  }
  visit(root, moduleScope)

  const edits: SourceEdit[] = []
  const rewrite = (node: SyntaxNode, parent?: SyntaxNode, key?: string) => {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' || (node.type === 'ExportNamedDeclaration' && !node.declaration)) {
      return
    }
    if (node.type === 'Identifier' && !declarations.has(node) && imports.has(String(node.name))) {
      const property = parent && key === 'key' && !parent.computed && ['ObjectProperty', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod', 'ClassProperty'].includes(parent.type)
      const member = parent && key === 'property' && !parent.computed && ['MemberExpression', 'OptionalMemberExpression'].includes(parent.type)
      const label = key === 'label' || parent?.type === 'PrivateName' || parent?.type === 'MetaProperty'
      let owner = scopes.get(node)
      while (owner && !owner.bindings.has(String(node.name))) {
        owner = owner.parent
      }
      if (!property && !member && !label && owner === moduleScope) {
        let content = `${bindingName}[${JSON.stringify(node.name)}]`
        if (parent && ((key === 'callee' && ['CallExpression', 'OptionalCallExpression'].includes(parent.type)) || (key === 'tag' && parent.type === 'TaggedTemplateExpression'))) {
          content = `(0, ${content})`
        }
        if (parent?.type === 'ObjectProperty' && parent.shorthand && key === 'value') {
          content = `${node.name}: ${content}`
        }
        edits.push({ start: node.start, end: node.end, content })
      }
    }
    childNodes(node).forEach(child => rewrite(child.node, node, child.key))
  }
  rewrite(root)
  return edits
}
