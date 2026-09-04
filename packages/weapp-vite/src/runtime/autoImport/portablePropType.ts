import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, generate, parse, traverse } from '../../utils/babel'

interface ImportedTypeBinding {
  importedName?: string
  kind: 'default' | 'named' | 'namespace'
  source: string
}

export interface PortablePropTypeContext {
  imports: Map<string, ImportedTypeBinding>
  interfaces: Map<string, t.TSInterfaceDeclaration>
  typeAliases: Map<string, t.TSTypeAliasDeclaration>
}

const PORTABLE_GLOBAL_TYPE_NAMES: Record<string, true> = {
  Array: true,
  ArrayBuffer: true,
  Awaited: true,
  Blob: true,
  Capitalize: true,
  ConstructorParameters: true,
  CustomEvent: true,
  Date: true,
  Error: true,
  Event: true,
  Exclude: true,
  Extract: true,
  File: true,
  Function: true,
  InstanceType: true,
  Lowercase: true,
  Map: true,
  NonNullable: true,
  Omit: true,
  OmitThisParameter: true,
  Parameters: true,
  Partial: true,
  Pick: true,
  Promise: true,
  Readonly: true,
  ReadonlyArray: true,
  ReadonlyMap: true,
  ReadonlySet: true,
  Record: true,
  RegExp: true,
  Required: true,
  ReturnType: true,
  Set: true,
  ThisParameterType: true,
  ThisType: true,
  Uint8Array: true,
  Uncapitalize: true,
  Uppercase: true,
  WeakMap: true,
  WeakSet: true,
}

const PORTABLE_GLOBAL_NAMESPACE_NAMES: Record<string, true> = {
  Intl: true,
}

const PORTABLE_IMPORT_PATH_RE = /^[\w.-]+(?:\/[\w.-]+)*$/
const PORTABLE_SCALAR_TYPE_RE = /^(?:boolean|never|null|number|object|string|undefined|unknown|void)(?:\[\])*$/
const PORTABLE_TYPE_ALIAS_NAME = '__WeappVitePortableComponentProp'

function getNodeText(node: t.Node) {
  return generate(node, { comments: false, concise: true }).code.trim()
}

function getEntityNameParts(name: t.TSEntityName): string[] | undefined {
  if (t.isIdentifier(name)) {
    return [name.name]
  }
  if (!t.isTSQualifiedName(name)) {
    return undefined
  }
  const left = getEntityNameParts(name.left)
  return left ? [...left, name.right.name] : undefined
}

function createEntityName(parts: string[]): t.TSEntityName | undefined {
  const first = parts[0]
  if (!first) {
    return undefined
  }
  let entityName: t.TSEntityName = t.identifier(first)
  for (const part of parts.slice(1)) {
    entityName = t.tsQualifiedName(entityName, t.identifier(part))
  }
  return entityName
}

function isPortableImportSource(source: string) {
  if (source.startsWith('.') || source.startsWith('/') || source.startsWith('@/')) {
    return false
  }
  if (source.startsWith('node:')) {
    return PORTABLE_IMPORT_PATH_RE.test(source.slice('node:'.length))
  }
  if (source.startsWith('#')) {
    return PORTABLE_IMPORT_PATH_RE.test(source.slice(1))
  }
  if (source.startsWith('@')) {
    return PORTABLE_IMPORT_PATH_RE.test(source.slice(1)) && source.includes('/')
  }
  return PORTABLE_IMPORT_PATH_RE.test(source)
}

export function collectPortablePropTypeContext(ast: t.Node): PortablePropTypeContext {
  const context: PortablePropTypeContext = {
    imports: new Map(),
    interfaces: new Map(),
    typeAliases: new Map(),
  }

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value
      for (const specifier of path.node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier)) {
          context.imports.set(specifier.local.name, { kind: 'default', source })
        }
        else if (t.isImportNamespaceSpecifier(specifier)) {
          context.imports.set(specifier.local.name, { kind: 'namespace', source })
        }
        else if (t.isImportSpecifier(specifier)) {
          context.imports.set(specifier.local.name, {
            importedName: t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value,
            kind: 'named',
            source,
          })
        }
      }
    },
    TSInterfaceDeclaration(path) {
      context.interfaces.set(path.node.id.name, path.node)
    },
    TSTypeAliasDeclaration(path) {
      context.typeAliases.set(path.node.id.name, path.node)
    },
  })

  return context
}

function createImportedTypeNode(
  binding: ImportedTypeBinding,
  referenceParts: string[],
  reference: t.TSTypeReference,
  context: PortablePropTypeContext,
  resolving: Set<string>,
): t.TSType {
  if (!isPortableImportSource(binding.source)) {
    return t.tsUnknownKeyword()
  }
  const qualifierParts = binding.kind === 'namespace'
    ? referenceParts.slice(1)
    : [binding.importedName ?? 'default', ...referenceParts.slice(1)]
  const qualifier = createEntityName(qualifierParts)
  if (!qualifier) {
    return t.tsUnknownKeyword()
  }
  const typeArguments = reference.typeArguments
    ? t.tsTypeParameterInstantiation(
        // eslint-disable-next-line ts/no-use-before-define -- 类型引用递归归一化需要共享同一转换入口。
        reference.typeArguments.params.map(param => createPortableTypeNode(param, context, resolving)),
      )
    : null
  return t.tsImportType(t.stringLiteral(binding.source), qualifier, typeArguments)
}

function resolveLocalTypeNode(
  name: string,
  reference: t.TSTypeReference,
  context: PortablePropTypeContext,
  resolving: Set<string>,
): t.TSType {
  if (resolving.has(name) || reference.typeArguments) {
    return t.tsUnknownKeyword()
  }

  const typeAlias = context.typeAliases.get(name)
  if (typeAlias) {
    if (typeAlias.typeParameters) {
      return t.tsUnknownKeyword()
    }
    const nextResolving = new Set(resolving)
    nextResolving.add(name)
    // eslint-disable-next-line ts/no-use-before-define -- 类型别名递归归一化需要共享同一转换入口。
    return createPortableTypeNode(typeAlias.typeAnnotation, context, nextResolving)
  }

  const interfaceDeclaration = context.interfaces.get(name)
  if (!interfaceDeclaration || interfaceDeclaration.typeParameters || interfaceDeclaration.extends?.length) {
    return t.tsUnknownKeyword()
  }
  const nextResolving = new Set(resolving)
  nextResolving.add(name)
  // eslint-disable-next-line ts/no-use-before-define -- 接口成员递归归一化需要共享同一转换入口。
  return createPortableTypeNode(
    t.tsTypeLiteral(interfaceDeclaration.body.body.map(member => t.cloneNode(member, true))),
    context,
    nextResolving,
  )
}

function createPortableTypeNode(
  node: t.TSType,
  context: PortablePropTypeContext,
  resolving: Set<string>,
): t.TSType {
  const declaration = t.tsTypeAliasDeclaration(
    t.identifier(PORTABLE_TYPE_ALIAS_NAME),
    null,
    t.cloneNode(node, true),
  )
  const file = t.file(t.program([declaration]))

  traverse(file, {
    TSAnyKeyword(path) {
      path.replaceWith(t.tsUnknownKeyword())
    },
    TSImportType(path) {
      if (!isPortableImportSource(path.node.source.value)) {
        path.replaceWith(t.tsUnknownKeyword())
      }
    },
    TSTypeQuery(path) {
      if (
        !t.isTSImportType(path.node.exprName)
        || !isPortableImportSource(path.node.exprName.source.value)
      ) {
        path.replaceWith(t.tsUnknownKeyword())
      }
    },
    TSTypeReference(path) {
      const referenceParts = getEntityNameParts(path.node.typeName)
      const rootName = referenceParts?.[0]
      if (!referenceParts || !rootName) {
        path.replaceWith(t.tsUnknownKeyword())
        return
      }

      const importedType = context.imports.get(rootName)
      if (importedType) {
        path.replaceWith(createImportedTypeNode(importedType, referenceParts, path.node, context, resolving))
        path.skip()
        return
      }

      if (referenceParts.length === 1 && (context.typeAliases.has(rootName) || context.interfaces.has(rootName))) {
        path.replaceWith(resolveLocalTypeNode(rootName, path.node, context, resolving))
        path.skip()
        return
      }

      if (
        (referenceParts.length === 1 && Object.hasOwn(PORTABLE_GLOBAL_TYPE_NAMES, rootName))
        || (referenceParts.length > 1 && Object.hasOwn(PORTABLE_GLOBAL_NAMESPACE_NAMES, rootName))
      ) {
        return
      }
      path.replaceWith(t.tsUnknownKeyword())
    },
  })

  return declaration.typeAnnotation
}

export function formatPortableComponentPropType(
  node: t.TSType,
  context: PortablePropTypeContext,
) {
  return getNodeText(createPortableTypeNode(node, context, new Set()))
}

/** 将组件 prop 类型收敛为可在独立生成声明中解析的类型。 */
export function normalizePortableComponentPropType(type: string) {
  const normalizedType = type.trim()
  if (PORTABLE_SCALAR_TYPE_RE.test(normalizedType)) {
    return normalizedType
  }
  if (!normalizedType) {
    return 'unknown'
  }
  try {
    const ast = parse(`type ${PORTABLE_TYPE_ALIAS_NAME} = ${normalizedType}`, {
      ...BABEL_TS_MODULE_PARSER_OPTIONS,
      errorRecovery: false,
    })
    let typeNode: t.TSType | undefined
    traverse(ast, {
      TSTypeAliasDeclaration(path) {
        if (path.node.id.name === PORTABLE_TYPE_ALIAS_NAME) {
          typeNode = path.node.typeAnnotation
          path.stop()
        }
      },
    })
    if (!typeNode) {
      return 'unknown'
    }
    return formatPortableComponentPropType(typeNode, {
      imports: new Map(),
      interfaces: new Map(),
      typeAliases: new Map(),
    })
  }
  catch {
    return 'unknown'
  }
}
