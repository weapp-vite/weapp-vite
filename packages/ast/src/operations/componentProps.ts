import type { NodePath } from '@babel/traverse'
import type * as t from '@babel/types'
import type { AstEngineName } from '../types'
import { walk } from 'oxc-walker'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../babel'
import { parseJsLikeWithEngine } from '../engine'

export type ComponentPropMap = Map<string, string>

const COMPONENT_PROPS_TEXT_HINTS = ['properties', 'props']

export function mayContainComponentPropsShape(code: string) {
  return COMPONENT_PROPS_TEXT_HINTS.some(hint => code.includes(hint))
}

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

export function mapConstructorName(name: string) {
  if (Object.hasOwn(CONSTRUCTOR_TYPE_MAP, name)) {
    return CONSTRUCTOR_TYPE_MAP[name]
  }
  const normalized = name.endsWith('Constructor')
    ? name.slice(0, -'Constructor'.length)
    : name
  return CONSTRUCTOR_TYPE_MAP[normalized] ?? 'any'
}

function resolveTypeFromNode(node: any): string {
  if (!node) {
    return 'any'
  }

  if (node.type === 'Identifier') {
    return mapConstructorName(node.name)
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    if (typeof node.value === 'string') {
      return mapConstructorName(node.value)
    }
    if (typeof node.value === 'number') {
      return 'number'
    }
    if (typeof node.value === 'boolean') {
      return 'boolean'
    }
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
    const property = node.property
    if (property?.type === 'Identifier') {
      return mapConstructorName(property.name)
    }
    if (
      property?.type === 'StringLiteral'
      || (property?.type === 'Literal' && typeof property.value === 'string')
    ) {
      return mapConstructorName(property.value)
    }
    return 'any'
  }

  if (node.type === 'TSExpressionWithTypeArguments') {
    return resolveTypeFromNode(node.expression)
  }

  if (
    node.type === 'TSAsExpression'
    || node.type === 'TSSatisfiesExpression'
    || node.type === 'TSNonNullExpression'
  ) {
    return resolveTypeFromNode(node.expression)
  }

  if (node.type === 'ArrayExpression') {
    const elements = Array.isArray(node.elements) ? node.elements : []
    const types = elements
      .map((element: any) => {
        if (!element) {
          return undefined
        }
        if (element.type === 'SpreadElement') {
          return 'any'
        }
        return resolveTypeFromNode(element)
      })
      .filter((value: string | undefined): value is string => Boolean(value))
    if (types.length === 0) {
      return 'any'
    }
    return [...new Set(types)].join(' | ')
  }

  return 'any'
}

function getStaticPropertyName(node: any) {
  if (!node) {
    return undefined
  }

  if (node.type === 'Identifier') {
    return node.name
  }
  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    if (typeof node.value === 'string') {
      return node.value
    }
  }
  if (node.type === 'NumericLiteral') {
    return String(node.value)
  }
  if (node.type === 'Literal' && typeof node.value === 'number') {
    return String(node.value)
  }
  return undefined
}

function extractPropertiesObject(node: any): ComponentPropMap | undefined {
  if (!node || node.type !== 'ObjectExpression') {
    return undefined
  }

  const propMap: ComponentPropMap = new Map()
  for (const property of node.properties ?? []) {
    if (property?.type !== 'ObjectProperty' && property?.type !== 'Property') {
      continue
    }

    const name = getStaticPropertyName(property.key)
    if (!name) {
      continue
    }

    const value = property.value
    if (value?.type === 'ObjectExpression') {
      let primaryType: string | undefined
      const optionalTypes: string[] = []

      for (const option of value.properties ?? []) {
        if (option?.type !== 'ObjectProperty' && option?.type !== 'Property') {
          continue
        }

        const optionName = getStaticPropertyName(option.key)
        if (!optionName) {
          continue
        }

        if (optionName === 'type') {
          primaryType = resolveTypeFromNode(option.value)
        }
        else if (optionName === 'optionalTypes' && option.value?.type === 'ArrayExpression') {
          for (const element of option.value.elements ?? []) {
            if (!element) {
              continue
            }
            optionalTypes.push(resolveTypeFromNode(element))
          }
        }
      }

      const typeCandidates = [primaryType, ...optionalTypes]
        .filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0))
      const deduped = [...new Set(typeCandidates)]
      propMap.set(name, deduped.length > 0 ? deduped.join(' | ') : 'any')
      continue
    }

    propMap.set(name, resolveTypeFromNode(value))
  }

  return propMap
}

function resolveOptionsObjectExpression(node: any, bindings: Map<string, any>): any {
  if (!node) {
    return undefined
  }

  if (node.type === 'ObjectExpression') {
    return node
  }

  if (node.type === 'Identifier') {
    return bindings.get(node.name)
  }

  if (
    node.type === 'TSAsExpression'
    || node.type === 'TSSatisfiesExpression'
    || node.type === 'TSNonNullExpression'
  ) {
    return resolveOptionsObjectExpression(node.expression, bindings)
  }

  return undefined
}

function resolveOptionsObjectExpressionWithBabel(
  path: NodePath<t.CallExpression>,
  node: t.Node | null | undefined,
) {
  if (!node) {
    return undefined
  }

  if (node.type === 'ObjectExpression') {
    return node
  }

  if (node.type === 'Identifier') {
    const binding = path.scope.getBinding(node.name)
    const bindingPath = binding?.path
    if (bindingPath?.isVariableDeclarator()) {
      const init = bindingPath.node.init
      if (init?.type === 'ObjectExpression') {
        return init
      }
    }
    return undefined
  }

  if (
    node.type === 'TSAsExpression'
    || node.type === 'TSSatisfiesExpression'
    || node.type === 'TSNonNullExpression'
  ) {
    return resolveOptionsObjectExpressionWithBabel(path, node.expression)
  }

  return undefined
}

function extractComponentProperties(optionsNode: any): ComponentPropMap {
  for (const property of optionsNode?.properties ?? []) {
    if (property?.type !== 'ObjectProperty' && property?.type !== 'Property') {
      continue
    }
    const name = getStaticPropertyName(property.key)
    if (name !== 'properties' && name !== 'props') {
      continue
    }
    if (property.value?.type === 'ObjectExpression') {
      return extractPropertiesObject(property.value) ?? new Map()
    }
    return new Map()
  }
  return new Map()
}

function collectComponentPropsWithBabel(code: string): ComponentPropMap {
  const ast = parse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
  let props: ComponentPropMap = new Map()

  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      if (props.size > 0) {
        return
      }
      const [options] = path.node.arguments
      const optionsObject = resolveOptionsObjectExpressionWithBabel(path, options)
      if (!optionsObject) {
        return
      }
      props = extractComponentProperties(optionsObject)
    },
  })

  return props
}

function collectComponentPropsWithOxc(code: string): ComponentPropMap {
  const ast = parseJsLikeWithEngine(code, {
    engine: 'oxc',
    filename: 'inline.ts',
  }) as any
  const props: ComponentPropMap = new Map()
  const bindings = new Map<string, any>()
  let resolved = false

  walk(ast, {
    enter(node) {
      if (resolved) {
        return
      }

      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
        const optionsObject = resolveOptionsObjectExpression(node.init, bindings)
        if (optionsObject) {
          bindings.set(node.id.name, optionsObject)
        }
        return
      }

      if (node.type !== 'CallExpression') {
        return
      }

      const [options] = node.arguments ?? []
      const optionsObject = resolveOptionsObjectExpression(options, bindings)
      if (!optionsObject) {
        return
      }

      resolved = true
      for (const [key, value] of extractComponentProperties(optionsObject)) {
        props.set(key, value)
      }
    },
  })

  return props
}

/**
 * 从源码中提取组件属性类型映射。
 */
export function collectComponentPropsFromCode(
  code: string,
  options?: {
    astEngine?: AstEngineName
  },
): ComponentPropMap {
  if (!mayContainComponentPropsShape(code)) {
    return new Map()
  }

  const engine = options?.astEngine ?? 'babel'

  try {
    return engine === 'oxc'
      ? collectComponentPropsWithOxc(code)
      : collectComponentPropsWithBabel(code)
  }
  catch {
    return new Map()
  }
}
