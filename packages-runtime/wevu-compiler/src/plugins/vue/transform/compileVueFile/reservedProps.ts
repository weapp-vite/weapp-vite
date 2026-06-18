import type { TSInterfaceBody, TSType } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLike, traverse } from '../../../../utils/babel'

const RESERVED_SCRIPT_SETUP_PROPS = new Set(['id', 'class', 'slot'])
const RESERVED_PROPS_WARNING = 'defineProps 中声明 id/class/slot 可能无法在小程序 properties 中正确取值，请改用其他 prop 名称。'

type PropsTypeNode = TSInterfaceBody | TSType
interface SourcePosition {
  line: number
  column: number
}

interface ReservedPropsWarningContext {
  filename?: string
  scriptSetupStart?: SourcePosition
}

interface ReservedPropsWarningResult {
  location?: SourcePosition
}

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

function getDefinePropsLocation(node: t.CallExpression): SourcePosition | undefined {
  const start = node.loc?.start
  if (!start) {
    return undefined
  }
  return {
    line: start.line,
    column: start.column,
  }
}

function resolveSourceLocation(location: SourcePosition | undefined, scriptSetupStart: SourcePosition | undefined) {
  if (!location) {
    return undefined
  }
  if (!scriptSetupStart) {
    return location
  }
  return {
    line: scriptSetupStart.line + location.line - 1,
    column: location.line === 1
      ? scriptSetupStart.column + location.column
      : location.column,
  }
}

function createReservedPropsWarning(location: SourcePosition | undefined, filename: string | undefined) {
  if (!location || !filename) {
    return RESERVED_PROPS_WARNING
  }
  return `${filename}:${location.line}:${location.column + 1} ${RESERVED_PROPS_WARNING}`
}

function detectDefinePropsReservedName(scriptSetupCode: string): ReservedPropsWarningResult | undefined {
  let result: ReservedPropsWarningResult | undefined
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
          result = {
            location: getDefinePropsLocation(path.node),
          }
          path.stop()
          return
        }
        const typeArguments = (path.node as {
          typeParameters?: { params?: t.Node[] | null } | null
          typeArguments?: { params?: t.Node[] | null } | null
        }).typeParameters ?? (path.node as {
          typeArguments?: { params?: t.Node[] | null } | null
        }).typeArguments
        const typeParam = typeArguments?.params?.[0] as PropsTypeNode | undefined
        if (typePropsContainReservedName(typeParam, typeScope)) {
          result = {
            location: getDefinePropsLocation(path.node),
          }
          path.stop()
        }
      },
    })
  }
  catch {
    return undefined
  }
  return result
}

export function warnReservedScriptSetupProps(
  scriptSetupCode: string | undefined,
  warn: ((message: string) => void) | undefined,
  context: ReservedPropsWarningContext = {},
) {
  if (!scriptSetupCode) {
    return
  }
  const result = detectDefinePropsReservedName(scriptSetupCode)
  if (!result) {
    return
  }
  const location = resolveSourceLocation(result.location, context.scriptSetupStart)
  warn?.(createReservedPropsWarning(location, context.filename))
}
