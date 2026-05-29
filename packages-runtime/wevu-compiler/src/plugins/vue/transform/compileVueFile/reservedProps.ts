import type { TSInterfaceBody, TSType } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLike, traverse } from '../../../../utils/babel'

const RESERVED_SCRIPT_SETUP_PROPS = new Set(['id', 'class'])
const RESERVED_PROPS_WARNING = 'defineProps 中声明 id/class 可能无法在小程序 properties 中正确取值，请改用其他 prop 名称。'

type PropsTypeNode = TSInterfaceBody | TSType

function getStaticKeyName(key: t.Expression | t.PrivateName) {
  if (t.isIdentifier(key)) {
    return key.name
  }
  if (t.isStringLiteral(key)) {
    return key.value
  }
  return undefined
}

function getTypePropertyName(key: t.Expression | t.PrivateName | t.TSEntityName) {
  if (t.isIdentifier(key)) {
    return key.name
  }
  if (t.isStringLiteral(key)) {
    return key.value
  }
  return undefined
}

function isReservedScriptSetupProp(name: string | undefined) {
  return name != null && RESERVED_SCRIPT_SETUP_PROPS.has(name)
}

function runtimePropsContainReservedName(node: t.Node | null | undefined): boolean {
  if (t.isObjectExpression(node)) {
    return node.properties.some(prop => t.isObjectProperty(prop) && !prop.computed && isReservedScriptSetupProp(getStaticKeyName(prop.key)))
  }
  if (t.isArrayExpression(node)) {
    return node.elements.some(element => t.isStringLiteral(element) && isReservedScriptSetupProp(element.value))
  }
  return false
}

function createTypeScope(ast: t.File) {
  const scope = new Map<string, PropsTypeNode>()
  traverse(ast, {
    TSInterfaceDeclaration(path) {
      scope.set(path.node.id.name, path.node.body)
    },
    TSTypeAliasDeclaration(path) {
      scope.set(path.node.id.name, path.node.typeAnnotation)
    },
  })
  return scope
}

function typePropsContainReservedName(typeNode: PropsTypeNode | null | undefined, scope: Map<string, PropsTypeNode>, seen = new Set<string>()): boolean {
  if (!typeNode) {
    return false
  }
  if (t.isTSTypeLiteral(typeNode)) {
    return typeNode.members.some((member) => {
      return t.isTSPropertySignature(member) && !member.computed && isReservedScriptSetupProp(getTypePropertyName(member.key))
    })
  }
  if (t.isTSInterfaceBody(typeNode)) {
    return typeNode.body.some((member) => {
      return t.isTSPropertySignature(member) && !member.computed && isReservedScriptSetupProp(getTypePropertyName(member.key))
    })
  }
  if (t.isTSIntersectionType(typeNode)) {
    return typeNode.types.some(item => typePropsContainReservedName(item, scope, seen))
  }
  if (t.isTSTypeReference(typeNode) && t.isIdentifier(typeNode.typeName)) {
    const typeName = typeNode.typeName.name
    if (seen.has(typeName)) {
      return false
    }
    const resolved = scope.get(typeName)
    if (!resolved) {
      return false
    }
    seen.add(typeName)
    return typePropsContainReservedName(resolved, scope, seen)
  }
  return false
}

function hasDefinePropsReservedName(scriptSetupCode: string) {
  let hasReservedName = false
  try {
    const ast = parseJsLike(scriptSetupCode)
    const typeScope = createTypeScope(ast)
    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee
        if (!t.isIdentifier(callee, { name: 'defineProps' })) {
          return
        }
        if (runtimePropsContainReservedName(path.node.arguments[0])) {
          hasReservedName = true
          path.stop()
          return
        }
        const typeParam = path.node.typeParameters?.params?.[0]
        if (typePropsContainReservedName(typeParam, typeScope)) {
          hasReservedName = true
          path.stop()
        }
      },
    })
  }
  catch {
    return false
  }
  return hasReservedName
}

export function warnReservedScriptSetupProps(scriptSetupCode: string | undefined, warn: ((message: string) => void) | undefined) {
  if (!scriptSetupCode || !hasDefinePropsReservedName(scriptSetupCode)) {
    return
  }
  warn?.(RESERVED_PROPS_WARNING)
}
