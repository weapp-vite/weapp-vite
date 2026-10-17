import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type { Node } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { isWevuRuntimeModuleId } from '../../../../../constants'
import { JSON_MACROS } from '../../jsonMacros/parse'
import { unwrapTypeLikeExpression } from '../../scriptComponent'
import { createModuleValueBoundary } from './ownership'

const pureRuntimeApis: Record<string, true> = {
  ref: true,
  shallowRef: true,
  reactive: true,
  shallowReactive: true,
  readonly: true,
  shallowReadonly: true,
  computed: true,
  isRef: true,
  unref: true,
  toRef: true,
  toRefs: true,
  toValue: true,
  isReactive: true,
  isReadonly: true,
  isProxy: true,
  toRaw: true,
  markRaw: true,
  triggerRef: true,
  isShallow: true,
  defineComponent: true,
}
const compilerMacros: Record<string, true> = {
  defineProps: true,
  defineEmits: true,
  defineExpose: true,
  defineOptions: true,
  defineSlots: true,
  withDefaults: true,
  definePage: true,
  definePageMeta: true,
}

export type ResolveValue = (node: Node, scope: Scope) => Value | undefined

interface ValueOrigin {
  node: Node
  scope: Scope
  resolve: ResolveValue
}

export type Value
  = | { kind: 'api', name: string }
    | { kind: 'module', source: string, name: string, exported: (name: string) => Value | undefined }
    | ({ kind: 'local', imported?: true } & ValueOrigin)
    | ({ kind: 'ref' | 'refs', value: Value | undefined } & ValueOrigin)
    | { kind: 'props' | 'opaque' | 'primitive' }

export interface ValueResolver {
  resolve: ResolveValue
  member: (object: Value | undefined, name: string | undefined) => Value | undefined
  safeData: (value: Value | undefined) => boolean
  functionReturn: (value: Value | undefined) => Value | undefined
  imported: (source: string, name: string) => Value
  key: (node: Node, computed: boolean, scope: Scope) => string | undefined
  moduleValue: (value: Value | undefined) => Value | undefined
}

const primitive: Value = { kind: 'primitive' }

export function isCompilerMacro(name: string) {
  return compilerMacros[name] === true || JSON_MACROS.has(name)
}

export function isSafeApi(name: string) {
  return pureRuntimeApis[name] === true || isCompilerMacro(name)
}

export function runtimeModule(source: string) {
  return source === 'vue' || isWevuRuntimeModuleId(source)
}

export function propertyName(node: Node, computed: boolean) {
  return t.isStringLiteral(node) || t.isNumericLiteral(node) ? String(node.value) : !computed && t.isIdentifier(node) ? node.name : undefined
}

export function isPrimitive(value: Value | undefined): boolean {
  return value?.kind === 'primitive' || (value?.kind === 'local' && (t.isNullLiteral(value.node) || t.isStringLiteral(value.node) || t.isNumericLiteral(value.node) || t.isBooleanLiteral(value.node) || t.isBigIntLiteral(value.node)))
}

/** 值证明与 Babel 绑定身份共用；未知属性、原型、代理和访问器均不冒充普通字段。 */
export function createValueResolver(scopes: WeakMap<Node, Scope>, lookup: (name: string, scope: Scope) => Value | undefined, exported: (source: string, name: string) => Value | undefined, sharedBindings: WeakSet<Node>, moduleScope: Scope): ValueResolver {
  const resolving = new Set<Node>()
  const boundary = createModuleValueBoundary(isPrimitive, name => pureRuntimeApis[name] === true)
  const dataProofs = new WeakMap<ResolveValue, WeakMap<Scope, { complete: WeakMap<Node, boolean>, visiting: WeakSet<Node> }>>()
  function imported(source: string, name: string): Value {
    return runtimeModule(source) || ((source === 'weapp-vite' || source === 'wevu/router' || source === 'wevu/dev/router') && isCompilerMacro(name))
      ? { kind: 'api', name }
      : boundary.imported(exported(source, name)) ?? { kind: 'module', source, name, exported: name => boundary.imported(exported(source, name)) }
  }
  function key(node: Node, computed: boolean, scope: Scope): string | undefined {
    const name = propertyName(node, computed)
    if (name !== undefined) {
      return name
    }
    // eslint-disable-next-line ts/no-use-before-define -- 键名和值解析互相递归，函数声明在首次调用前已初始化。
    const value = resolve(node, scope)
    return value?.kind === 'local' ? propertyName(value.node, true) : undefined
  }
  function member(object: Value | undefined, name: string | undefined): Value | undefined {
    if (!object || name === undefined) {
      return undefined
    }
    if (object.kind === 'api' && object.name === '*') {
      return { kind: 'api', name }
    }
    if (object.kind === 'module' && object.name === '*') {
      return object.exported(name) ?? { ...object, name }
    }
    if (object.kind === 'ref') {
      return name === 'value' ? object.value : undefined
    }
    if (object.kind === 'refs') {
      const value = member(object.value, name)
      return value ? { ...object, kind: 'ref', value } : undefined
    }
    if (object.kind === 'props') {
      return { kind: 'opaque' }
    }
    if (object.kind !== 'local') {
      return undefined
    }
    if (t.isObjectExpression(object.node)) {
      for (let index = object.node.properties.length - 1; index >= 0; index--) {
        const property = object.node.properties[index]!
        if (t.isSpreadElement(property) || propertyName(property.key, property.computed) === undefined) {
          return undefined
        }
        if (propertyName(property.key, property.computed) === name) {
          return t.isObjectProperty(property) ? object.resolve(property.value, object.scope) : property.kind === 'method' ? object.resolve(property, object.scope) : undefined
        }
      }
    }
    if (t.isArrayExpression(object.node)) {
      if (name === 'length') {
        return primitive
      }
      const element = /^(?:0|[1-9]\d*)$/.test(name) ? object.node.elements[Number(name)] : undefined
      return element ? object.resolve(element, object.scope) : undefined
    }
    return undefined
  }
  function functionReturn(value: Value | undefined): Value | undefined {
    if (value?.kind !== 'local' || !t.isFunction(value.node) || value.node.async || value.node.generator) {
      return undefined
    }
    const body = value.node.body
    if (t.isExpression(body)) {
      return boundary.factoryReturn(value, value.resolve(body, value.scope))
    }
    if (body.body.some(statement => !t.isVariableDeclaration(statement) && !t.isFunctionDeclaration(statement) && !t.isExpressionStatement(statement) && !t.isReturnStatement(statement) && !t.isEmptyStatement(statement))) {
      return undefined
    }
    const returns = body.body.filter(statement => t.isReturnStatement(statement))
    return returns.length === 1 && returns[0]!.argument ? boundary.factoryReturn(value, value.resolve(returns[0]!.argument, value.scope)) : undefined
  }
  function resolve(input: Node, scope: Scope): Value | undefined {
    const node = t.isExpression(input) ? unwrapTypeLikeExpression(input) : input
    if (resolving.has(node)) {
      return undefined
    }
    resolving.add(node)
    try {
      if (t.isIdentifier(node)) {
        const binding = scope.getBinding(node.name)
        if (!binding) {
          return lookup(node.name, scope) ?? (isCompilerMacro(node.name) ? { kind: 'api', name: node.name } : node.name === 'undefined' ? primitive : undefined)
        }
        if (!binding.constant) {
          return undefined
        }
        const declaration = binding.path.node
        if (t.isImportSpecifier(declaration) || t.isImportDefaultSpecifier(declaration) || t.isImportNamespaceSpecifier(declaration)) {
          const parent = binding.path.parent
          if (!t.isImportDeclaration(parent) || parent.importKind === 'type' || (t.isImportSpecifier(declaration) && declaration.importKind === 'type')) {
            return undefined
          }
          return imported(parent.source.value, t.isImportSpecifier(declaration) ? propertyName(declaration.imported, false)! : t.isImportDefaultSpecifier(declaration) ? 'default' : '*')
        }
        // 普通 script 的配置在模块求值时可读；函数/实例消费其复合值时不再拥有字段。
        const shared = sharedBindings.has(binding.identifier) || (binding.scope === moduleScope && scope.getFunctionParent() !== null)
        if (t.isVariableDeclarator(declaration) && declaration.init) {
          let value = resolve(declaration.init, binding.path.scope)
          if (t.isObjectPattern(declaration.id)) {
            const property = declaration.id.properties.find(item => t.isObjectProperty(item) && t.isIdentifier(item.value, { name: node.name }))
            value = t.isObjectProperty(property) ? member(value, propertyName(property.key, property.computed)) : undefined
          }
          else if (!t.isIdentifier(declaration.id)) {
            value = undefined
          }
          return shared ? boundary.imported(value) : value
        }
        if (t.isFunctionDeclaration(declaration)) {
          const value = resolve(declaration, binding.path.scope)
          return shared ? boundary.imported(value) : value
        }
        if (binding.kind === 'param') {
          const fn = binding.path.getFunctionParent()
          const owner = fn?.isFunctionDeclaration() && fn.node.id ? fn.parentPath.scope.getBinding(fn.node.id.name) : undefined
          const index = fn?.node.params.indexOf(declaration as t.Identifier) ?? -1
          if (owner?.referencePaths.length && index >= 0 && owner.referencePaths.every((reference) => {
            const call = reference.parentPath
            return call?.isCallExpression() && call.node.callee === reference.node && call.node.arguments[index] && isPrimitive(resolve(call.node.arguments[index]!, call.scope))
          })) {
            return primitive
          }
        }
        return undefined
      }
      if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
        return member(resolve(node.object, scope), key(node.property, node.computed, scope))
      }
      if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
        const callee = resolve(node.callee, scope)
        if (callee?.kind !== 'api') {
          return functionReturn(callee)
        }
        const first = node.arguments[0] ? resolve(node.arguments[0], scope) : primitive
        switch (callee.name) {
          case 'ref': case 'shallowRef': return first?.kind === 'ref' ? first : { kind: 'ref', value: first, node, scope, resolve }
          case 'toRefs': return { kind: 'refs', value: first, node, scope, resolve }
          case 'reactive': case 'shallowReactive': case 'readonly': case 'shallowReadonly': case 'toRaw': case 'markRaw': return first
          case 'computed': return { kind: 'ref', value: functionReturn(first) ?? functionReturn(member(first, 'get')), node, scope, resolve }
          case 'unref': return first?.kind === 'ref' ? first.value : first
          case 'toValue': return first?.kind === 'ref' ? first.value : first?.kind === 'local' && t.isFunction(first.node) ? functionReturn(first) : first
          case 'toRef': return node.arguments.length > 1
            ? { kind: 'ref', value: member(first, key(node.arguments[1]!, true, scope)), node, scope, resolve }
            : first?.kind === 'ref' ? first : { kind: 'ref', value: first?.kind === 'local' && t.isFunction(first.node) ? functionReturn(first) : first, node, scope, resolve }
          case 'isRef': case 'isReactive': case 'isReadonly': case 'isProxy': case 'isShallow': return primitive
          case 'defineComponent': return first?.kind === 'local' && t.isObjectExpression(first.node) ? first : undefined
          case 'defineProps': return { kind: 'props' }
          case 'withDefaults': return first
          default: return undefined
        }
      }
      if (t.isBinaryExpression(node) || t.isUnaryExpression(node) || t.isUpdateExpression(node) || t.isTemplateLiteral(node)) {
        return primitive
      }
      return { kind: 'local', node, scope: scopes.get(node) ?? scope, resolve }
    }
    finally {
      resolving.delete(node)
    }
  }
  function safeData(value: Value | undefined): boolean {
    if (!value) {
      return false
    }
    if (value.kind === 'primitive' || value.kind === 'props') {
      return true
    }
    if (value.kind === 'ref' || value.kind === 'refs') {
      return safeData(value.value)
    }
    if (value.kind !== 'local') {
      return value.kind === 'api' && isSafeApi(value.name)
    }
    if (isPrimitive(value) || t.isFunction(value.node)) {
      return true
    }
    let scopes = dataProofs.get(value.resolve)
    if (!scopes) {
      scopes = new WeakMap()
      dataProofs.set(value.resolve, scopes)
    }
    let proof = scopes.get(value.scope)
    if (!proof) {
      proof = { complete: new WeakMap(), visiting: new WeakSet() }
      scopes.set(value.scope, proof)
    }
    const complete = proof.complete.get(value.node)
    if (complete !== undefined) {
      return complete
    }
    if (proof.visiting.has(value.node)) {
      return false
    }
    proof.visiting.add(value.node)
    let safe = false
    if (t.isObjectExpression(value.node)) {
      safe = value.node.properties.every(property => !t.isSpreadElement(property) && propertyName(property.key, property.computed) !== undefined
        && (t.isObjectProperty(property) ? safeData(value.resolve(property.value, value.scope)) : property.kind === 'method'))
    }
    else if (t.isArrayExpression(value.node)) {
      safe = value.node.elements.every(element => !element || (!t.isSpreadElement(element) && safeData(value.resolve(element, value.scope))))
    }
    proof.visiting.delete(value.node)
    proof.complete.set(value.node, safe)
    return safe
  }
  return { resolve, member, safeData, functionReturn, imported, key, moduleValue: boundary.imported }
}
