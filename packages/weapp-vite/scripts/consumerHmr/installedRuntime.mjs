import assert from 'node:assert/strict'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import {
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
  WEAPP_VITE_STATEFUL_HMR_DIRECTORY,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { isRetiredRealmGuardRead } from './retiredRealmGuard.mjs'

const traverse = traverseModule.default ?? traverseModule
const contracts = new Map([
  [WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, 'WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY'],
  [WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, 'WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY'],
  [WEAPP_VITE_STATEFUL_HMR_DIRECTORY, 'WEAPP_VITE_STATEFUL_HMR_DIRECTORY'],
  [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, 'WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE'],
  [WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, 'WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE'],
  [WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE, 'WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE'],
])
const publicNames = new Map([...contracts].map(([key, name]) => [name, key]))

function nameOf(node) {
  return node?.type === 'Identifier' ? node.name : node?.type === 'StringLiteral' ? node.value : undefined
}

function propertyName(node, scope, seen) {
  return node.computed ? staticString(node.property ?? node.key, scope, seen) : nameOf(node.property ?? node.key)
}

function destructuredContract(pattern, identifier, scope, seen) {
  if (pattern.type !== 'ObjectPattern') {
    return undefined
  }
  for (const property of pattern.properties) {
    if (property.type !== 'ObjectProperty') {
      continue
    }
    const target = property.value.type === 'AssignmentPattern' ? property.value.left : property.value
    if (target === identifier) {
      return publicNames.get(propertyName(property, scope, seen))
    }
  }
}

/** 使用真实词法绑定追踪静态键，不能把另一个作用域的同名变量当作常量引用。 */
function staticString(node, scope, seen = new Set()) {
  if (!node || seen.has(node)) {
    return undefined
  }
  seen = new Set(seen).add(node)
  if (node.type === 'StringLiteral') {
    return node.value
  }
  if (node.type === 'TemplateLiteral') {
    let result = node.quasis[0].value.cooked
    if (result == null) {
      return undefined
    }
    for (let index = 0; index < node.expressions.length; index++) {
      const expression = staticString(node.expressions[index], scope, seen)
      const suffix = node.quasis[index + 1].value.cooked
      if (expression === undefined || suffix == null) {
        return undefined
      }
      result += expression + suffix
    }
    return result
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left, scope, seen)
    const right = staticString(node.right, scope, seen)
    return left === undefined || right === undefined ? undefined : left + right
  }
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    return publicNames.get(propertyName(node, scope, seen))
  }
  if (node.type !== 'Identifier') {
    return undefined
  }
  const binding = scope.getBinding(node.name)
  if (!binding) {
    return publicNames.get(node.name)
  }
  if (binding.path.isImportSpecifier()) {
    return publicNames.get(nameOf(binding.path.node.imported))
  }
  if (binding.path.isVariableDeclarator()) {
    const declaration = binding.path.node
    return declaration.id.type === 'Identifier'
      ? staticString(declaration.init, binding.path.scope, seen)
      : destructuredContract(declaration.id, binding.identifier, binding.path.scope, seen)
  }
}

/** 仅证明字面量与不可变本地别名组成的字符串纯度，不推断成员或导入值。 */
function inertString(node, scope, seen = new Set()) {
  if (!node || seen.has(node)) {
    return undefined
  }
  seen = new Set(seen).add(node)
  if (node.type === 'StringLiteral') {
    return node.value
  }
  if (node.type === 'TemplateLiteral') {
    let result = node.quasis[0].value.cooked
    if (result == null) {
      return undefined
    }
    for (let index = 0; index < node.expressions.length; index++) {
      const expression = inertString(node.expressions[index], scope, seen)
      const suffix = node.quasis[index + 1].value.cooked
      if (expression === undefined || suffix == null) {
        return undefined
      }
      result += expression + suffix
    }
    return result
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = inertString(node.left, scope, seen)
    const right = inertString(node.right, scope, seen)
    return left === undefined || right === undefined ? undefined : left + right
  }
  if (node.type !== 'Identifier') {
    return undefined
  }
  const binding = scope.getBinding(node.name)
  if (binding?.constant && binding.path.isVariableDeclarator() && binding.path.node.id.type === 'Identifier') {
    return inertString(binding.path.node.init, binding.path.scope, seen)
  }
}

function isDiscardedInertString(nodePath) {
  let expression = nodePath
  while (expression.parentPath.isTemplateLiteral() || expression.parentPath.isBinaryExpression({ operator: '+' })) {
    expression = expression.parentPath
  }
  return expression.parentPath.isExpressionStatement()
    && inertString(expression.node, expression.scope) !== undefined
}

function isCommonJsExports(node, scope) {
  return (node?.type === 'Identifier' && node.name === 'exports')
    || (node?.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'module'
      && propertyName(node, scope) === 'exports')
}

function exportedProperty(node, scope) {
  return node?.type === 'MemberExpression' && isCommonJsExports(node.object, scope) ? propertyName(node, scope) : undefined
}

function isPublicExportValue(nodePath, key) {
  const parent = nodePath.parentPath
  if (parent.isAssignmentExpression({ operator: '=' }) && parent.node.right === nodePath.node) {
    return exportedProperty(parent.node.left, parent.scope) === contracts.get(key)
  }
  if (parent.isObjectProperty() && parent.node.value === nodePath.node && propertyName(parent.node, parent.scope) === contracts.get(key)) {
    const object = parent.parentPath
    const assignment = object.parentPath
    return object.isObjectExpression() && assignment?.isAssignmentExpression({ operator: '=' })
      && assignment.node.right === object.node && isCommonJsExports(assignment.node.left, assignment.scope)
  }
  return false
}

/** 公开常量声明及导出可保留；其他用途必须证明没有残留的客户端或控制器。 */
export function assertNoStatefulInstallations(filename, source) {
  let ast
  try {
    // 转义字面量和静态模板也能表示 runtime key，不能按原始文本提前跳过。
    ast = parse(source, { sourceType: 'unambiguous', sourceFilename: filename })
  }
  catch (error) {
    assert.fail(`Cannot inspect classic JavaScript: ${filename}: ${error.message}`)
  }
  const fail = key => assert.fail(`Classic ${filename.replaceAll('\\', '/')} must remove ${key} runtime usage`)
  const inspectValue = (nodePath, key) => {
    let value = nodePath
    while (value.parentPath.isTemplateLiteral() || value.parentPath.isBinaryExpression({ operator: '+' })) {
      const combined = staticString(value.parentPath.node, value.parentPath.scope)
      if (!contracts.has(combined)) {
        break
      }
      key = combined
      value = value.parentPath
    }
    const parent = value.parentPath
    if (parent.isVariableDeclarator() && parent.node.init === value.node && parent.node.id.type === 'Identifier') {
      const binding = parent.scope.getBinding(parent.node.id.name)
      if (!binding?.constant) {
        fail(key)
      }
      const declaration = parent.parentPath
      if (declaration.parentPath.isExportNamedDeclaration() && parent.node.id.name !== contracts.get(key)) {
        fail(key)
      }
      return
    }
    if (parent.isExportSpecifier() && parent.node.local === value.node && nameOf(parent.node.exported) === contracts.get(key)) {
      return
    }
    if (isPublicExportValue(value, key)) {
      return
    }
    fail(key)
  }
  traverse(ast, {
    'StringLiteral|TemplateLiteral|BinaryExpression|ReferencedIdentifier': (nodePath) => {
      const value = staticString(nodePath.node, nodePath.scope)
      const key = typeof value === 'string' && (contracts.has(value) ? value : [...contracts.keys()].find(key => value.includes(key)))
      if (key) {
        if (isDiscardedInertString(nodePath)) {
          return
        }
        if (value !== key) {
          fail(key)
        }
        inspectValue(nodePath, key)
      }
      if (nodePath.isTemplateLiteral() && value === undefined) {
        for (const quasi of nodePath.node.quasis) {
          const embedded = [...contracts.keys()].find(key => quasi.value.cooked?.includes(key))
          if (embedded) {
            fail(embedded)
          }
        }
      }
    },
    'MemberExpression|OptionalMemberExpression': (nodePath) => {
      const property = propertyName(nodePath.node, nodePath.scope)
      if (contracts.has(property)) {
        if (isRetiredRealmGuardRead(nodePath)) {
          nodePath.skip()
          return
        }
        fail(property)
      }
      const key = publicNames.get(property)
      if (key) {
        const parent = nodePath.parentPath
        if (parent.isAssignmentExpression() && parent.node.left === nodePath.node && exportedProperty(nodePath.node, nodePath.scope) === property) {
          return
        }
        inspectValue(nodePath, key)
      }
    },
    ObjectProperty(nodePath) {
      const property = propertyName(nodePath.node, nodePath.scope)
      if (contracts.has(property)) {
        fail(property)
      }
    },
  })
}
