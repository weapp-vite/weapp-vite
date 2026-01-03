import type { ComponentPropMap } from '../componentProps'
import * as ts from 'typescript'

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

function getNodeText(sourceFile: ts.SourceFile, node: ts.Node) {
  return node.getText(sourceFile).trim()
}

function getPropertyName(sourceFile: ts.SourceFile, name: ts.PropertyName) {
  if (ts.isIdentifier(name)) {
    return name.text
  }
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return getNodeText(sourceFile, name)
}

function containsImportType(node: ts.Node): boolean {
  let has = false
  const visit = (current: ts.Node) => {
    if (has) {
      return
    }
    if (ts.isImportTypeNode(current)) {
      has = true
      return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return has
}

function mapConstructorType(sourceFile: ts.SourceFile, node: ts.TypeNode | undefined): string | undefined {
  if (!node) {
    return undefined
  }
  if (ts.isTypeReferenceNode(node)) {
    if (ts.isIdentifier(node.typeName)) {
      return mapConstructorName(node.typeName.text)
    }
    return mapConstructorName(getNodeText(sourceFile, node.typeName))
  }
  if (ts.isUnionTypeNode(node)) {
    const items = node.types
      .map(item => mapConstructorType(sourceFile, item))
      .filter((value): value is string => Boolean(value))
    return items.length ? Array.from(new Set(items)).join(' | ') : undefined
  }
  if (ts.isLiteralTypeNode(node) && ts.isNullLiteral(node.literal)) {
    return 'any'
  }
  return mapConstructorName(getNodeText(sourceFile, node))
}

function resolveTypeFromConfigLiteral(sourceFile: ts.SourceFile, configType: ts.TypeNode | undefined): string | undefined {
  if (!configType || !ts.isTypeLiteralNode(configType)) {
    return undefined
  }

  let valueType: string | undefined
  let constructorType: string | undefined

  for (const member of configType.members) {
    if (!ts.isPropertySignature(member) || !member.name) {
      continue
    }
    const key = getPropertyName(sourceFile, member.name)
    if (key === 'value' && member.type && !containsImportType(member.type)) {
      valueType = getNodeText(sourceFile, member.type)
    }
    else if (key === 'type') {
      constructorType = mapConstructorType(sourceFile, member.type)
    }
  }

  return valueType ?? constructorType
}

function extractFromPropertiesTypeLiteral(sourceFile: ts.SourceFile, node: ts.TypeLiteralNode): ComponentPropMap {
  const map: ComponentPropMap = new Map()

  for (const member of node.members) {
    if (!ts.isPropertySignature(member) || !member.name) {
      continue
    }
    const propName = getPropertyName(sourceFile, member.name)
    const type = resolveTypeFromConfigLiteral(sourceFile, member.type) ?? 'any'
    map.set(propName, type)
  }

  return map
}

export function extractComponentPropsFromDts(code: string): ComponentPropMap {
  const sourceFile = ts.createSourceFile('component.d.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let props: ComponentPropMap = new Map()

  const visit = (node: ts.Node) => {
    if (props.size > 0) {
      return
    }

    if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      for (const member of node.members) {
        const nameNode = (member as any).name as ts.PropertyName | undefined
        if (!nameNode) {
          continue
        }
        const name = getPropertyName(sourceFile, nameNode)
        if (name !== 'properties') {
          continue
        }
        const typeNode = (member as any).type as ts.TypeNode | undefined
        if (typeNode && ts.isTypeLiteralNode(typeNode)) {
          props = extractFromPropertiesTypeLiteral(sourceFile, typeNode)
          return
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return props
}
