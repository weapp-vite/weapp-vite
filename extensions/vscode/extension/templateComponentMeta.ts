import type * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '@weapp-vite/ast/babel'

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

function collectPropNamesFromTypeLiteral(node: t.TSTypeLiteral) {
  const names = new Set<string>()

  for (const member of node.members) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }

    const name = getPropertyName(member.key)

    if (name) {
      names.add(name)
    }
  }

  return names
}

function collectPropNamesFromInterface(node: t.TSInterfaceDeclaration) {
  const names = new Set<string>()

  for (const member of node.body.body) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }

    const name = getPropertyName(member.key)

    if (name) {
      names.add(name)
    }
  }

  return names
}

function collectPropNamesFromObjectExpression(node: t.ObjectExpression) {
  const names = new Set<string>()

  for (const property of node.properties) {
    if (property.type !== 'ObjectProperty' && property.type !== 'ObjectMethod') {
      continue
    }

    const name = getPropertyName(property.key)

    if (name) {
      names.add(name)
    }
  }

  return names
}

function collectEventNamesFromTypeLiteral(node: t.TSTypeLiteral) {
  const names = new Set<string>()

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
      names.add(type.literal.value)
    }
  }

  return names
}

function collectEventNamesFromObjectTypeLiteral(node: t.TSTypeLiteral) {
  const names = new Set<string>()

  for (const member of node.members) {
    if (member.type !== 'TSPropertySignature') {
      continue
    }

    const name = getPropertyName(member.key)

    if (name) {
      names.add(name)
    }
  }

  return names
}

function collectEventNamesFromArrayExpression(node: t.ArrayExpression) {
  const names = new Set<string>()

  for (const element of node.elements) {
    if (element?.type === 'StringLiteral') {
      names.add(element.value)
    }
  }

  return names
}

function collectModelNames(ast: t.File) {
  const names = new Set<string>()

  traverse(ast, {
    CallExpression(path) {
      if (path.node.callee.type !== 'Identifier' || path.node.callee.name !== 'defineModel') {
        return
      }

      const firstArgument = path.node.arguments[0]

      if (firstArgument?.type === 'StringLiteral') {
        names.add(firstArgument.value)
        return
      }

      names.add('modelValue')
    },
  })

  return names
}

export function extractTemplateComponentMeta(sourceText: string) {
  const scriptSource = getSfcScriptSource(sourceText)
  let ast: t.File

  try {
    ast = parse(scriptSource, {
      ...BABEL_TS_MODULE_PARSER_OPTIONS,
      errorRecovery: true,
    })
  }
  catch {
    return {
      emits: new Set<string>(),
      models: new Set<string>(),
      props: new Set<string>(),
    }
  }

  const { interfaces, typeAliases } = collectTypeReferences(ast)
  const props = new Set<string>()
  const emits = new Set<string>()
  const models = collectModelNames(ast)

  traverse(ast, {
    CallExpression(path) {
      if (path.node.callee.type !== 'Identifier') {
        return
      }

      if (path.node.callee.name === 'defineProps') {
        const typeParameter = path.node.typeParameters?.params?.[0]

        if (typeParameter?.type === 'TSTypeLiteral') {
          for (const name of collectPropNamesFromTypeLiteral(typeParameter)) {
            props.add(name)
          }
        }

        if (typeParameter?.type === 'TSTypeReference' && typeParameter.typeName.type === 'Identifier') {
          const alias = typeAliases.get(typeParameter.typeName.name)
          const iface = interfaces.get(typeParameter.typeName.name)

          if (alias?.type === 'TSTypeLiteral') {
            for (const name of collectPropNamesFromTypeLiteral(alias)) {
              props.add(name)
            }
          }

          if (iface) {
            for (const name of collectPropNamesFromInterface(iface)) {
              props.add(name)
            }
          }
        }

        const firstArgument = path.node.arguments[0]

        if (firstArgument?.type === 'ObjectExpression') {
          for (const name of collectPropNamesFromObjectExpression(firstArgument)) {
            props.add(name)
          }
        }
      }

      if (path.node.callee.name === 'defineEmits') {
        const typeParameter = path.node.typeParameters?.params?.[0]

        if (typeParameter?.type === 'TSTypeLiteral') {
          for (const name of collectEventNamesFromTypeLiteral(typeParameter)) {
            emits.add(name)
          }

          for (const name of collectEventNamesFromObjectTypeLiteral(typeParameter)) {
            emits.add(name)
          }
        }

        const firstArgument = path.node.arguments[0]

        if (firstArgument?.type === 'ArrayExpression') {
          for (const name of collectEventNamesFromArrayExpression(firstArgument)) {
            emits.add(name)
          }
        }

        if (firstArgument?.type === 'ObjectExpression') {
          for (const name of collectPropNamesFromObjectExpression(firstArgument)) {
            emits.add(name)
          }
        }
      }
    },
  })

  return {
    emits,
    models,
    props,
  }
}
