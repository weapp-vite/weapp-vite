import type * as t from '@weapp-vite/ast/babelTypes'
import type { ComponentPropMap } from '../componentProps'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { BABEL_TS_MODULE_PARSER_OPTIONS, generate, getVisitorKeys, parse, traverse } from '../../utils/babel'
import { mapConstructorName } from '../utils/constructorType'

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
  annotation: t.Noop | t.TSTypeAnnotation | t.TypeAnnotation | null | undefined,
): t.TSType | undefined {
  if (!annotation) {
    return undefined
  }
  if ('typeAnnotation' in annotation) {
    return annotation.typeAnnotation as unknown as t.TSType
  }
  return undefined
}

function containsImportType(node: t.Node): boolean {
  let has = false
  const VISITOR_KEYS = getVisitorKeys()
  const visit = (current: any) => {
    if (has) {
      return
    }
    if (!current) {
      return
    }
    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item)
        if (has) {
          return
        }
      }
      return
    }
    if (typeof current.type !== 'string') {
      return
    }
    if (current.type === 'TSImportType') {
      has = true
      return
    }
    const keys = (VISITOR_KEYS as Record<string, string[]>)[current.type]
    if (!keys) {
      return
    }
    for (const key of keys) {
      visit(current[key])
      if (has) {
        return
      }
    }
  }
  visit(node)
  return has
}

function mapConstructorType(node: t.TSType | undefined): string | undefined {
  if (!node) {
    return undefined
  }
  if (node.type === 'TSTypeReference') {
    if (node.typeName.type === 'Identifier') {
      return mapConstructorName(node.typeName.name)
    }
    return mapConstructorName(getNodeText(node.typeName))
  }
  if (node.type === 'TSUnionType') {
    const items = node.types
      .map(item => mapConstructorType(item))
      .filter((value): value is string => Boolean(value))
    return items.length ? [...new Set(items)].join(' | ') : undefined
  }
  if (node.type === 'TSNullKeyword') {
    return 'any'
  }
  return mapConstructorName(getNodeText(node))
}

function resolveTypeFromConfigLiteral(configType: t.TSType | undefined): string | undefined {
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
    if (key === 'value' && type && !containsImportType(type)) {
      valueType = getNodeText(type)
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

function extractFromPropertiesTypeLiteral(node: t.TSTypeLiteral): ComponentPropMap {
  const map: ComponentPropMap = new Map()

  for (const member of node.members) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }
    const propName = getPropertyName(member.key)
    if (!propName) {
      continue
    }
    const type = resolveTypeFromConfigLiteral(unwrapTypeAnnotation(member.typeAnnotation)) ?? 'any'
    map.set(propName, type)
  }

  return map
}

function extractFromPropsInterfaceMembers(node: t.TSInterfaceDeclaration): ComponentPropMap {
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

    const type = resolveTypeFromConfigLiteral(typeNode) ?? 'any'
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
          props = extractFromPropertiesTypeLiteral(typeNode)
          path.stop()
          return
        }
      }

      const extracted = extractFromPropsInterfaceMembers(path.node)
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
          props = extractFromPropertiesTypeLiteral(typeNode)
          path.stop()
          return
        }
      }
    },
  })

  return props
}

export function extractInlinePropsTypeFromCode(code: string): ComponentPropMap {
  const source = code.includes('<script')
    ? (() => {
        const parsed = parseSfc(code, { filename: 'layout.vue' })
        return parsed.descriptor.scriptSetup?.content ?? parsed.descriptor.script?.content ?? code
      })()
    : code
  const props: ComponentPropMap = new Map()
  const ast = parse(source, {
    ...BABEL_TS_MODULE_PARSER_OPTIONS,
    errorRecovery: true,
  })

  const typeAliases = new Map<string, t.TSType>()
  const interfaces = new Map<string, t.TSInterfaceDeclaration>()

  traverse(ast, {
    TSTypeAliasDeclaration(path) {
      typeAliases.set(path.node.id.name, path.node.typeAnnotation)
    },
    TSInterfaceDeclaration(path) {
      interfaces.set(path.node.id.name, path.node)
    },
  })

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
      props.set(propName, typeNode ? getNodeText(typeNode) : 'any')
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
      props.set(propName, typeNode ? getNodeText(typeNode) : 'any')
    }
  }

  traverse(ast, {
    CallExpression(path) {
      if (!path.node.callee || path.node.callee.type !== 'Identifier' || path.node.callee.name !== 'defineProps') {
        return
      }
      const typeParameter = path.node.typeParameters?.params?.[0]
      if (!typeParameter) {
        return
      }
      if (typeParameter.type === 'TSTypeLiteral') {
        pushTypeLiteralMembers(typeParameter)
        path.stop()
        return
      }
      if (typeParameter.type === 'TSTypeReference' && typeParameter.typeName.type === 'Identifier') {
        const alias = typeAliases.get(typeParameter.typeName.name)
        if (alias?.type === 'TSTypeLiteral') {
          pushTypeLiteralMembers(alias)
          path.stop()
          return
        }
        const iface = interfaces.get(typeParameter.typeName.name)
        if (iface) {
          pushInterfaceMembers(iface)
          path.stop()
        }
      }
    },
  })

  return props
}
