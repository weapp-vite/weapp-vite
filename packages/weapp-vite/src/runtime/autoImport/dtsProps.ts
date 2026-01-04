import type * as t from '@babel/types'
import type { ComponentPropMap } from '../componentProps'
import generate from '@babel/generator'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import { VISITOR_KEYS } from '@babel/types'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../../utils/babel'

const CONSTRUCTOR_TYPE_MAP: Record<string, string> = {
  String: 'string',
  StringConstructor: 'string',
  Number: 'number',
  NumberConstructor: 'number',
  Boolean: 'boolean',
  BooleanConstructor: 'boolean',
  Object: 'Record<string, any>',
  ObjectConstructor: 'Record<string, any>',
  Array: 'any[]',
  ArrayConstructor: 'any[]',
  null: 'any',
  Null: 'any',
  NullConstructor: 'any',
}

function mapConstructorName(name: string) {
  if (Object.hasOwn(CONSTRUCTOR_TYPE_MAP, name)) {
    return CONSTRUCTOR_TYPE_MAP[name]
  }
  const normalized = name.endsWith('Constructor')
    ? name.slice(0, -'Constructor'.length)
    : name
  return CONSTRUCTOR_TYPE_MAP[normalized] ?? 'any'
}

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
    return items.length ? Array.from(new Set(items)).join(' | ') : undefined
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
