import type * as t from '@weapp-vite/ast/babelTypes'
import type { ComponentPropMap } from '../componentProps'
import type { PortablePropTypeContext } from './portablePropType'
import { BABEL_TS_MODULE_PARSER_OPTIONS, generate, parse, traverse } from '../../utils/babel'
import { collectPortablePropTypeContext, formatPortableComponentPropType } from './portablePropType'

function getNodeText(node: t.Node) {
  return generate(node, { comments: false, concise: true }).code.trim()
}

function getPropertyName(name: t.Node): string | undefined {
  if (name.type === 'Identifier') {
    return name.name
  }
  if (name.type === 'StringLiteral') {
    return name.value
  }
  if (name.type === 'NumericLiteral') {
    return String(name.value)
  }
  return getNodeText(name)
}

function unwrapTypeAnnotation(
  annotation: t.TSTypeAnnotation | t.TypeAnnotation | null | undefined,
): t.TSType | undefined {
  if (!annotation) {
    return undefined
  }
  if ('typeAnnotation' in annotation) {
    return annotation.typeAnnotation as unknown as t.TSType
  }
  return undefined
}

function mapConstructorType(node: t.TSType | undefined): string | undefined {
  if (!node) {
    return undefined
  }
  if (node.type === 'TSTypeReference') {
    const name = node.typeName.type === 'Identifier'
      ? node.typeName.name
      : getNodeText(node.typeName)
    const normalized = name.endsWith('Constructor')
      ? name.slice(0, -'Constructor'.length)
      : name
    switch (normalized) {
      case 'String':
        return 'string'
      case 'Number':
        return 'number'
      case 'Boolean':
        return 'boolean'
      case 'Object':
        return 'object'
      case 'Array':
        return 'unknown[]'
      case 'Null':
      case 'null':
        return 'unknown'
      default:
        return 'unknown'
    }
  }
  if (node.type === 'TSUnionType') {
    const items = node.types
      .map(item => mapConstructorType(item))
      .filter((value): value is string => Boolean(value))
    return items.length ? [...new Set(items)].join(' | ') : undefined
  }
  return 'unknown'
}

function resolveTypeFromConfigLiteral(
  configType: t.TSType | undefined,
  context: PortablePropTypeContext,
): string | undefined {
  if (!configType || configType.type !== 'TSTypeLiteral') {
    return undefined
  }

  let valueType: string | undefined
  let constructorType: string | undefined

  for (const member of configType.members) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }
    const key = getPropertyName(member.key)
    const type = unwrapTypeAnnotation(member.typeAnnotation)
    if (key === 'value' && type) {
      valueType = formatPortableComponentPropType(type, context)
    }
    else if (key === 'type') {
      constructorType = mapConstructorType(type)
    }
  }

  return valueType ?? constructorType
}

function isPropsConfigLiteral(configType: t.TSTypeLiteral): boolean {
  for (const member of configType.members) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }
    const key = getPropertyName(member.key)
    if (key === 'type' || key === 'value') {
      return true
    }
  }
  return false
}

function extractFromPropertiesTypeLiteral(
  node: t.TSTypeLiteral,
  context: PortablePropTypeContext,
): ComponentPropMap {
  const map: ComponentPropMap = new Map()

  for (const member of node.members) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }
    const propName = getPropertyName(member.key)
    if (!propName) {
      continue
    }
    const type = resolveTypeFromConfigLiteral(
      unwrapTypeAnnotation(member.typeAnnotation),
      context,
    ) ?? 'unknown'
    map.set(propName, type)
  }

  return map
}

function extractFromPropsInterfaceMembers(
  node: t.TSInterfaceDeclaration,
  context: PortablePropTypeContext,
): ComponentPropMap {
  const map: ComponentPropMap = new Map()

  for (const member of node.body.body) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }
    const propName = getPropertyName(member.key)
    if (!propName) {
      continue
    }

    const typeNode = unwrapTypeAnnotation(member.typeAnnotation)
    if (!typeNode || typeNode.type !== 'TSTypeLiteral') {
      continue
    }
    if (!isPropsConfigLiteral(typeNode)) {
      continue
    }

    const type = resolveTypeFromConfigLiteral(typeNode, context) ?? 'unknown'
    map.set(propName, type)
  }

  return map
}

export function extractComponentPropsFromDts(code: string): ComponentPropMap {
  let props: ComponentPropMap = new Map()

  const ast = parse(code, {
    ...BABEL_TS_MODULE_PARSER_OPTIONS,
    errorRecovery: true,
  })

  const context = collectPortablePropTypeContext(ast)

  traverse(ast, {
    TSInterfaceDeclaration(path) {
      if (props.size > 0) {
        path.stop()
        return
      }

      for (const member of path.node.body.body) {
        if (member.type !== 'TSPropertySignature') {
          continue
        }
        const name = getPropertyName(member.key)
        if (name !== 'properties') {
          continue
        }
        const typeNode = unwrapTypeAnnotation(member.typeAnnotation)
        if (typeNode?.type === 'TSTypeLiteral') {
          props = extractFromPropertiesTypeLiteral(typeNode, context)
          path.stop()
          return
        }
      }

      const extracted = extractFromPropsInterfaceMembers(path.node, context)
      if (extracted.size > 0) {
        props = extracted
        path.stop()
      }
    },
    ClassDeclaration(path) {
      if (props.size > 0) {
        path.stop()
        return
      }
      for (const member of path.node.body.body) {
        if (member.type !== 'ClassProperty' && member.type !== 'ClassAccessorProperty') {
          continue
        }
        const name = getPropertyName(member.key)
        if (name !== 'properties') {
          continue
        }
        const typeNode = unwrapTypeAnnotation(member.typeAnnotation)
        if (typeNode?.type === 'TSTypeLiteral') {
          props = extractFromPropertiesTypeLiteral(typeNode, context)
          path.stop()
          return
        }
      }
    },
  })

  return props
}

export function extractInlinePropsTypeFromCode(code: string): ComponentPropMap {
  const props: ComponentPropMap = new Map()
  const ast = parse(code, {
    ...BABEL_TS_MODULE_PARSER_OPTIONS,
    errorRecovery: true,
  })

  const context = collectPortablePropTypeContext(ast)

  const pushTypeLiteralMembers = (node: t.TSTypeLiteral) => {
    for (const member of node.members) {
      if (member.type !== 'TSPropertySignature') {
        continue
      }
      const propName = getPropertyName(member.key)
      if (!propName) {
        continue
      }
      const typeNode = unwrapTypeAnnotation(member.typeAnnotation)
      props.set(propName, typeNode ? formatPortableComponentPropType(typeNode, context) : 'unknown')
    }
  }

  const pushInterfaceMembers = (node: t.TSInterfaceDeclaration) => {
    for (const member of node.body.body) {
      if (member.type !== 'TSPropertySignature') {
        continue
      }
      const propName = getPropertyName(member.key)
      if (!propName) {
        continue
      }
      const typeNode = unwrapTypeAnnotation(member.typeAnnotation)
      props.set(propName, typeNode ? formatPortableComponentPropType(typeNode, context) : 'unknown')
    }
  }

  traverse(ast, {
    CallExpression(path) {
      if (!path.node.callee || path.node.callee.type !== 'Identifier' || path.node.callee.name !== 'defineProps') {
        return
      }
      const typeArguments = (path.node as {
        typeParameters?: { params?: t.Node[] | null } | null
        typeArguments?: { params?: t.Node[] | null } | null
      }).typeParameters ?? (path.node as {
        typeArguments?: { params?: t.Node[] | null } | null
      }).typeArguments
      const typeParameter = typeArguments?.params?.[0]
      if (!typeParameter) {
        return
      }
      if (typeParameter.type === 'TSTypeLiteral') {
        pushTypeLiteralMembers(typeParameter)
        path.stop()
        return
      }
      if (typeParameter.type === 'TSTypeReference' && typeParameter.typeName.type === 'Identifier') {
        const alias = context.typeAliases.get(typeParameter.typeName.name)?.typeAnnotation
        if (alias?.type === 'TSTypeLiteral') {
          pushTypeLiteralMembers(alias)
          path.stop()
          return
        }
        const iface = context.interfaces.get(typeParameter.typeName.name)
        if (iface) {
          pushInterfaceMembers(iface)
          path.stop()
        }
      }
    },
  })

  return props
}
