import type { NodePath } from '@babel/traverse'
import type * as t from '@babel/types'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../utils/babel'
import { mapConstructorName } from './utils/constructorType'

const traverse: typeof traverseModule = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

export type ComponentPropMap = Map<string, string>

function resolveTypeFromNode(node: t.Node | null | undefined): string {
  if (!node) {
    return 'any'
  }

  if (node.type === 'Identifier') {
    return mapConstructorName(node.name)
  }

  if (node.type === 'StringLiteral') {
    return mapConstructorName(node.value)
  }

  if (node.type === 'NullLiteral') {
    return 'any'
  }

  if (node.type === 'NumericLiteral') {
    return 'number'
  }

  if (node.type === 'BooleanLiteral') {
    return 'boolean'
  }

  if (node.type === 'MemberExpression') {
    if (node.property.type === 'Identifier') {
      return mapConstructorName(node.property.name)
    }
    if (node.property.type === 'StringLiteral') {
      return mapConstructorName(node.property.value)
    }
    return 'any'
  }

  if (node.type === 'TSExpressionWithTypeArguments') {
    return resolveTypeFromNode(node.expression)
  }

  if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression' || node.type === 'TSNonNullExpression') {
    return resolveTypeFromNode(node.expression)
  }

  if (node.type === 'ArrayExpression') {
    const types = node.elements
      .map((element) => {
        if (!element) {
          return undefined
        }
        if (element.type === 'SpreadElement') {
          return 'any'
        }
        return resolveTypeFromNode(element)
      })
      .filter((value): value is string => Boolean(value))
    if (types.length === 0) {
      return 'any'
    }
    return Array.from(new Set(types)).join(' | ')
  }

  return 'any'
}

function getStaticPropertyName(node: t.Expression | t.PrivateName | t.Identifier | t.StringLiteral | t.NumericLiteral) {
  if (node.type === 'Identifier') {
    return node.name
  }
  if (node.type === 'StringLiteral') {
    return node.value
  }
  if (node.type === 'NumericLiteral') {
    return String(node.value)
  }
  return undefined
}

function extractPropertiesObject(node: t.ObjectExpression | null | undefined) {
  if (!node) {
    return undefined
  }

  const propMap: ComponentPropMap = new Map()
  for (const property of node.properties) {
    if (property.type !== 'ObjectProperty') {
      continue
    }
    const name = getStaticPropertyName(property.key)
    if (!name) {
      continue
    }

    const value = property.value

    if (value.type === 'ObjectExpression') {
      let primaryType: string | undefined
      const optionalTypes: string[] = []

      for (const option of value.properties) {
        if (option.type !== 'ObjectProperty') {
          continue
        }
        const optionName = getStaticPropertyName(option.key)
        if (!optionName) {
          continue
        }
        if (optionName === 'type') {
          primaryType = resolveTypeFromNode(option.value)
        }
        else if (optionName === 'optionalTypes' && option.value.type === 'ArrayExpression') {
          for (const element of option.value.elements) {
            if (!element) {
              continue
            }
            optionalTypes.push(resolveTypeFromNode(element))
          }
        }
      }

      const typeCandidates = [
        primaryType,
        ...optionalTypes,
      ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0))

      const deduped = Array.from(new Set(typeCandidates))
      const type = deduped.length > 0 ? deduped.join(' | ') : 'any'
      propMap.set(name, type)
      continue
    }

    const type = resolveTypeFromNode(value)
    propMap.set(name, type)
  }

  return propMap
}

function extractComponentProperties(optionsNode: t.ObjectExpression) {
  for (const property of optionsNode.properties) {
    if (property.type !== 'ObjectProperty') {
      continue
    }
    const name = getStaticPropertyName(property.key)
    if (name !== 'properties' && name !== 'props') {
      continue
    }
    if (property.value.type === 'ObjectExpression') {
      return extractPropertiesObject(property.value) ?? new Map()
    }
    return new Map()
  }
  return new Map()
}

export function extractComponentProps(code: string): ComponentPropMap {
  const ast = parse(code, BABEL_TS_MODULE_PARSER_OPTIONS)

  let props: ComponentPropMap = new Map()

  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      if (props.size > 0) {
        return
      }
      const [options] = path.node.arguments
      if (!options || options.type !== 'ObjectExpression') {
        return
      }
      props = extractComponentProperties(options)
    },
  })

  return props
}
