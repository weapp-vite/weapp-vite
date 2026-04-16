import type * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '@weapp-vite/ast/babel'

export interface TemplateComponentMeta {
  emitDetails: Map<string, string | null>
  emits: Set<string>
  modelDetails: Map<string, string | null>
  models: Set<string>
  propDetails: Map<string, string | null>
  props: Set<string>
}

function getPropertyName(node: t.Node | null | undefined): string | undefined {
  if (!node) {
    return undefined
  }

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

function normalizeSummary(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const summary = value.replace(/\s+/gu, ' ').trim()

  return summary || null
}

function getNodeSummary(node: t.Node | null | undefined, sourceText: string) {
  if (node?.start == null || node.end == null) {
    return null
  }

  return normalizeSummary(sourceText.slice(node.start, node.end))
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

function getSfcScriptSource(sourceText: string) {
  if (!sourceText.includes('<script')) {
    return sourceText
  }

  const blocks: Array<{
    content: string
    isSetup: boolean
  }> = []
  const openPattern = /<script\b([^>]*)>/giu
  const closePattern = /<\/script>/giu

  openPattern.lastIndex = 0
  let openMatch = openPattern.exec(sourceText)

  while (openMatch && openMatch.index != null) {
    closePattern.lastIndex = openMatch.index + openMatch[0].length
    const closeMatch = closePattern.exec(sourceText)

    if (!closeMatch || closeMatch.index == null) {
      break
    }

    blocks.push({
      content: sourceText.slice(openMatch.index + openMatch[0].length, closeMatch.index),
      isSetup: /\bsetup\b/iu.test(openMatch[1] ?? ''),
    })

    openMatch = openPattern.exec(sourceText)
  }

  return blocks.find(block => block.isSetup)?.content ?? blocks[0]?.content ?? ''
}

function collectTypeReferences(ast: t.File) {
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

  return {
    interfaces,
    typeAliases,
  }
}

function setDetail(map: Map<string, string | null>, name: string, summary: string | null) {
  if (!map.has(name) || (map.get(name) == null && summary != null)) {
    map.set(name, summary)
  }
}

function collectPropDetailsFromTypeLiteral(node: t.TSTypeLiteral, sourceText: string) {
  const details = new Map<string, string | null>()

  for (const member of node.members) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }

    const name = getPropertyName(member.key)

    if (name) {
      setDetail(details, name, getNodeSummary(unwrapTypeAnnotation(member.typeAnnotation), sourceText))
    }
  }

  return details
}

function collectPropDetailsFromInterface(node: t.TSInterfaceDeclaration, sourceText: string) {
  const details = new Map<string, string | null>()

  for (const member of node.body.body) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }

    const name = getPropertyName(member.key)

    if (name) {
      setDetail(details, name, getNodeSummary(unwrapTypeAnnotation(member.typeAnnotation), sourceText))
    }
  }

  return details
}

function getRuntimeConstructorSummary(node: t.Node | null | undefined): string | null {
  if (!node) {
    return null
  }

  if (node.type === 'Identifier') {
    if (node.name === 'String') {
      return 'string'
    }

    if (node.name === 'Number') {
      return 'number'
    }

    if (node.name === 'Boolean') {
      return 'boolean'
    }

    if (node.name === 'Array') {
      return 'any[]'
    }

    if (node.name === 'Object') {
      return 'Record<string, any>'
    }
  }

  if (node.type === 'ArrayExpression') {
    const items = node.elements
      .map(element => getRuntimeConstructorSummary(element))
      .filter((value): value is string => Boolean(value))

    return items.length > 0
      ? normalizeSummary(items.join(' | '))
      : null
  }

  return null
}

function getRuntimePropSummary(node: t.Node | null | undefined) {
  if (!node) {
    return null
  }

  if (node.type === 'ObjectExpression') {
    for (const property of node.properties) {
      if (property.type !== 'ObjectProperty') {
        continue
      }

      if (getPropertyName(property.key) === 'type') {
        return getRuntimeConstructorSummary(property.value)
      }
    }

    return null
  }

  return getRuntimeConstructorSummary(node)
}

function collectPropDetailsFromObjectExpression(node: t.ObjectExpression) {
  const details = new Map<string, string | null>()

  for (const property of node.properties) {
    if (property.type !== 'ObjectProperty' && property.type !== 'ObjectMethod') {
      continue
    }

    const name = getPropertyName(property.key)

    if (name) {
      setDetail(
        details,
        name,
        property.type === 'ObjectProperty'
          ? getRuntimePropSummary(property.value)
          : null,
      )
    }
  }

  return details
}

function getFunctionParameterSummary(parameter: t.FunctionParameter, sourceText: string) {
  if (parameter.type === 'Identifier') {
    const typeSummary = getNodeSummary(unwrapTypeAnnotation(parameter.typeAnnotation), sourceText)

    return typeSummary
      ? `${parameter.name}: ${typeSummary}`
      : parameter.name
  }

  return getNodeSummary(parameter, sourceText)
}

function collectEventDetailsFromTypeLiteral(node: t.TSTypeLiteral, sourceText: string) {
  const details = new Map<string, string | null>()

  for (const member of node.members) {
    if (member.type !== 'TSCallSignatureDeclaration') {
      continue
    }

    const parameter = member.parameters[0]

    if (parameter?.type !== 'Identifier') {
      continue
    }

    const type = unwrapTypeAnnotation(parameter.typeAnnotation)

    if (type?.type === 'TSLiteralType' && type.literal.type === 'StringLiteral') {
      const payloadSummary = member.parameters
        .slice(1)
        .map(parameter => getFunctionParameterSummary(parameter, sourceText))
        .filter((value): value is string => Boolean(value))
        .join(', ')

      setDetail(details, type.literal.value, payloadSummary || 'void')
    }
  }

  return details
}

function collectEventDetailsFromObjectTypeLiteral(node: t.TSTypeLiteral, sourceText: string) {
  const details = new Map<string, string | null>()

  for (const member of node.members) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }

    const name = getPropertyName(member.key)

    if (name) {
      setDetail(details, name, getNodeSummary(unwrapTypeAnnotation(member.typeAnnotation), sourceText))
    }
  }

  return details
}

function collectEventDetailsFromArrayExpression(node: t.ArrayExpression) {
  const details = new Map<string, string | null>()

  for (const element of node.elements) {
    if (element?.type === 'StringLiteral') {
      setDetail(details, element.value, null)
    }
  }

  return details
}

function collectModelDetails(ast: t.File, sourceText: string) {
  const details = new Map<string, string | null>()

  traverse(ast, {
    CallExpression(path) {
      if (path.node.callee.type !== 'Identifier' || path.node.callee.name !== 'defineModel') {
        return
      }

      const firstArgument = path.node.arguments[0]
      const typeParameter = path.node.typeParameters?.params?.[0]
      const summary = getNodeSummary(typeParameter, sourceText)

      if (firstArgument?.type === 'StringLiteral') {
        setDetail(details, firstArgument.value, summary)
        return
      }

      setDetail(details, 'modelValue', summary)
    },
  })

  return details
}

function addDetailEntries(
  names: Set<string>,
  targetMap: Map<string, string | null>,
  sourceMap: Map<string, string | null>,
) {
  for (const [name, summary] of sourceMap) {
    names.add(name)
    setDetail(targetMap, name, summary)
  }
}

function createEmptyTemplateComponentMeta(): TemplateComponentMeta {
  return {
    emitDetails: new Map<string, string | null>(),
    emits: new Set<string>(),
    modelDetails: new Map<string, string | null>(),
    models: new Set<string>(),
    propDetails: new Map<string, string | null>(),
    props: new Set<string>(),
  }
}

export function extractTemplateComponentMeta(sourceText: string): TemplateComponentMeta {
  const scriptSource = getSfcScriptSource(sourceText)
  let ast: t.File

  try {
    ast = parse(scriptSource, {
      ...BABEL_TS_MODULE_PARSER_OPTIONS,
      errorRecovery: true,
    })
  }
  catch {
    return createEmptyTemplateComponentMeta()
  }

  const { interfaces, typeAliases } = collectTypeReferences(ast)
  const emitDetails = new Map<string, string | null>()
  const props = new Set<string>()
  const propDetails = new Map<string, string | null>()
  const emits = new Set<string>()
  const modelDetails = collectModelDetails(ast, scriptSource)
  const models = new Set(modelDetails.keys())

  traverse(ast, {
    CallExpression(path) {
      if (path.node.callee.type !== 'Identifier') {
        return
      }

      if (path.node.callee.name === 'defineProps') {
        const typeParameter = path.node.typeParameters?.params?.[0]

        if (typeParameter?.type === 'TSTypeLiteral') {
          addDetailEntries(props, propDetails, collectPropDetailsFromTypeLiteral(typeParameter, scriptSource))
        }

        if (typeParameter?.type === 'TSTypeReference' && typeParameter.typeName.type === 'Identifier') {
          const alias = typeAliases.get(typeParameter.typeName.name)
          const iface = interfaces.get(typeParameter.typeName.name)

          if (alias?.type === 'TSTypeLiteral') {
            addDetailEntries(props, propDetails, collectPropDetailsFromTypeLiteral(alias, scriptSource))
          }

          if (iface) {
            addDetailEntries(props, propDetails, collectPropDetailsFromInterface(iface, scriptSource))
          }
        }

        const firstArgument = path.node.arguments[0]

        if (firstArgument?.type === 'ObjectExpression') {
          addDetailEntries(props, propDetails, collectPropDetailsFromObjectExpression(firstArgument))
        }
      }

      if (path.node.callee.name === 'defineEmits') {
        const typeParameter = path.node.typeParameters?.params?.[0]

        if (typeParameter?.type === 'TSTypeLiteral') {
          addDetailEntries(emits, emitDetails, collectEventDetailsFromTypeLiteral(typeParameter, scriptSource))
          addDetailEntries(emits, emitDetails, collectEventDetailsFromObjectTypeLiteral(typeParameter, scriptSource))
        }

        const firstArgument = path.node.arguments[0]

        if (firstArgument?.type === 'ArrayExpression') {
          addDetailEntries(emits, emitDetails, collectEventDetailsFromArrayExpression(firstArgument))
        }

        if (firstArgument?.type === 'ObjectExpression') {
          addDetailEntries(emits, emitDetails, collectPropDetailsFromObjectExpression(firstArgument))
        }
      }
    },
  })

  return {
    emitDetails,
    emits,
    modelDetails,
    models,
    propDetails,
    props,
  }
}
