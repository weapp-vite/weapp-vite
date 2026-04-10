import type { OutputBundle, OutputChunk } from 'rolldown'
import type { MpPlatform } from '../../../../types'
import path from 'pathe'
import { mayContainPlatformApiAccess, mayContainStaticRequireLiteral } from '../../../../ast'
import { toPosixPath } from '../../../../utils'
import { generate, parseJsLike, traverse } from '../../../../utils/babel'
import {
  hasNpmDependencyPrefix,
  normalizeNpmImportLookupPath,
  normalizeNpmImportPathByPlatform,
  resolveNpmDependencyId,
} from '../../../../utils/npmImport'
import { createWeapiAccessExpression } from '../../../../utils/weapi'
import {
  ABSOLUTE_NPM_PREFIX_RE,
  BROWSER_GLOBAL_HOST_TERNARY_RE,
  DIRECTIVE_PROLOGUE_RE,
  DYNAMIC_GLOBAL_RESOLUTION_RE,
  NPM_PROTOCOL_RE,
  platformApiIdentifiers,
} from './constants'

export function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  const injectedApiIdentifier = '__weappViteInjectedApi__'

  if (!mayContainPlatformApiAccess(code, { engine: options?.astEngine })) {
    return code
  }

  try {
    const ast = parseJsLike(code)
    let mutated = false

    const rewritePath = (path: any) => {
      const object = path.node?.object
      if (!object || object.type !== 'Identifier') {
        return
      }
      const identifierName = object.name
      if (!platformApiIdentifiers.has(identifierName)) {
        return
      }
      if (path.scope?.hasBinding?.(identifierName)) {
        return
      }
      path.node.object = {
        type: 'Identifier',
        name: injectedApiIdentifier,
      }
      mutated = true
    }

    traverse(ast as any, {
      MemberExpression: rewritePath,
      OptionalMemberExpression: rewritePath,
    })

    if (!mutated) {
      return code
    }

    const transformedCode = generate(ast as any).code
    const aliasCode = `var ${injectedApiIdentifier} = ${createWeapiAccessExpression(globalName)};`
    return `${aliasCode}\n${transformedCode}`
  }
  catch {
    return code
  }
}

export function normalizeNpmImportByPlatform(
  platform: MpPlatform | undefined,
  importee: string,
  dependencies: Record<string, string> | undefined,
  mode?: string,
) {
  return normalizeNpmImportPathByPlatform(importee, {
    platform,
    dependencies,
    alipayNpmMode: mode,
  })
}

export function rewriteChunkNpmImportsByPlatform(
  platform: MpPlatform | undefined,
  code: string,
  dependencies: Record<string, string> | undefined,
  mode?: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainStaticRequireLiteral(code, { engine: options?.astEngine })) {
    return code
  }

  try {
    const ast = parseJsLike(code)
    let mutated = false

    traverse(ast as any, {
      CallExpression(path: any) {
        const callee = path.node?.callee
        if (!callee || callee.type !== 'Identifier' || callee.name !== 'require') {
          return
        }
        if (path.scope?.hasBinding?.('require')) {
          return
        }

        const args = path.node.arguments
        if (!Array.isArray(args) || args.length === 0) {
          return
        }

        const firstArg = args[0]
        if (!firstArg) {
          return
        }

        const isStringLiteral = firstArg.type === 'StringLiteral' || firstArg.type === 'Literal'
        const isStaticTemplateLiteral = firstArg.type === 'TemplateLiteral'
          && Array.isArray(firstArg.expressions)
          && firstArg.expressions.length === 0
          && Array.isArray(firstArg.quasis)
          && firstArg.quasis.length === 1

        if (!isStringLiteral && !isStaticTemplateLiteral) {
          return
        }

        const currentValue = isStringLiteral
          ? firstArg.value
          : firstArg.quasis[0]?.value?.cooked ?? firstArg.quasis[0]?.value?.raw

        if (typeof currentValue !== 'string') {
          return
        }

        const nextValue = normalizeNpmImportByPlatform(platform, currentValue, dependencies, mode)
        if (nextValue === currentValue) {
          return
        }

        if (isStringLiteral) {
          firstArg.value = nextValue
        }
        else {
          firstArg.quasis[0].value.cooked = nextValue
          firstArg.quasis[0].value.raw = nextValue
        }

        mutated = true
      },
    })

    if (!mutated) {
      return code
    }

    return generate(ast as any).code
  }
  catch {
    return code
  }
}

export function rewriteBundleNpmImportsByPlatform(
  platform: MpPlatform | undefined,
  bundle: OutputBundle,
  dependencies: Record<string, string> | undefined,
  mode?: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const nextCode = rewriteChunkNpmImportsByPlatform(platform, chunk.code, dependencies, mode, options)
    if (nextCode === chunk.code) {
      continue
    }
    chunk.code = nextCode
  }
}

export function rewriteBundlePlatformApi(
  bundle: OutputBundle,
  globalName: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const nextCode = replacePlatformApiAccess(chunk.code, globalName, options)
    if (nextCode === chunk.code) {
      continue
    }
    chunk.code = nextCode
  }
}

export function rewriteBundleDynamicGlobalResolution(bundle: OutputBundle) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const hasDynamicGlobalResolution = DYNAMIC_GLOBAL_RESOLUTION_RE.test(chunk.code)
    DYNAMIC_GLOBAL_RESOLUTION_RE.lastIndex = 0
    const hasBrowserGlobalHostTernary = BROWSER_GLOBAL_HOST_TERNARY_RE.test(chunk.code)
    BROWSER_GLOBAL_HOST_TERNARY_RE.lastIndex = 0

    if (!hasDynamicGlobalResolution && !hasBrowserGlobalHostTernary) {
      continue
    }

    chunk.code = chunk.code
      .replaceAll(DYNAMIC_GLOBAL_RESOLUTION_RE, 'globalThis')
      .replaceAll(BROWSER_GLOBAL_HOST_TERNARY_RE, 'globalThis')
  }
}

export function matchesSubPackageDependency(dependencies: (string | RegExp)[] | undefined, importee: string, fallbackDependencies?: Record<string, string>) {
  const normalized = normalizeNpmImportLookupPath(importee)
  if (Array.isArray(dependencies) && dependencies.length > 0) {
    const dependencyId = resolveNpmDependencyId(normalized)
    return dependencies.some((pattern) => {
      if (typeof pattern === 'string') {
        return dependencyId === pattern || normalized === pattern || normalized.startsWith(`${pattern}/`)
      }

      pattern.lastIndex = 0
      if (pattern.test(dependencyId)) {
        return true
      }

      pattern.lastIndex = 0
      return pattern.test(normalized)
    })
  }

  return hasNpmDependencyPrefix(fallbackDependencies, normalized)
}

export function normalizeWeappLocalNpmImport(importee: string) {
  const normalized = importee.replace(NPM_PROTOCOL_RE, '').replace(ABSOLUTE_NPM_PREFIX_RE, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 1 || (segments.length === 2 && normalized.startsWith('@'))) {
    return `${normalized}/index`
  }
  return normalized
}

export function getRequireImportLiteral(node: any) {
  if (!node) {
    return null
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : null
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    return node.quasis[0]?.value?.cooked ?? null
  }

  return null
}

export function getStaticStringLiteral(node: any) {
  return getRequireImportLiteral(node)
}

export function setRequireImportLiteral(node: any, nextValue: string) {
  if (!node) {
    return
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    node.value = nextValue
    return
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    node.quasis[0].value.raw = nextValue
    node.quasis[0].value.cooked = nextValue
  }
}

export function normalizeRelativeChunkImport(fileName: string, importee: string) {
  return toPosixPath(path.normalize(path.join(path.dirname(fileName), importee)))
}

export function toRelativeRuntimeNpmImport(fileName: string, root: string, importee: string) {
  const normalized = normalizeWeappLocalNpmImport(importee)
  const target = root
    ? `${root}/miniprogram_npm/${normalized}`
    : `miniprogram_npm/${normalized}`
  const relative = toPosixPath(path.relative(path.dirname(fileName), target))
  return relative.startsWith('.') ? relative : `./${relative}`
}

export function rewriteChunkNpmImportsToLocalRoot(
  chunk: OutputChunk,
  root: string,
  dependencyPatterns: (string | RegExp)[] | undefined,
  dependencies: Record<string, string> | undefined,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainStaticRequireLiteral(chunk.code, { engine: options?.astEngine })) {
    return
  }

  try {
    const ast = parseJsLike(chunk.code)
    let mutated = false

    traverse(ast as any, {
      CallExpression(path: any) {
        const callee = path.node?.callee
        if (!callee || callee.type !== 'Identifier' || callee.name !== 'require') {
          return
        }
        if (path.scope?.hasBinding?.('require')) {
          return
        }

        const args = path.node.arguments
        if (!Array.isArray(args) || args.length === 0) {
          return
        }

        const firstArg = args[0]
        const currentValue = getRequireImportLiteral(firstArg)
        if (typeof currentValue !== 'string' || !matchesSubPackageDependency(dependencyPatterns, currentValue, dependencies)) {
          return
        }

        const nextValue = toRelativeRuntimeNpmImport(chunk.fileName, root, currentValue)
        if (nextValue === currentValue) {
          return
        }

        setRequireImportLiteral(firstArg, nextValue)
        mutated = true
      },
    })

    if (mutated) {
      chunk.code = generate(ast as any).code
    }
  }
  catch {
  }
}

export function rewriteJsonNpmImportsToLocalRoot(
  bundle: OutputBundle,
  root: string,
  dependencyPatterns: (string | RegExp)[] | undefined,
  dependencies: Record<string, string> | undefined,
) {
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'asset' || typeof output.fileName !== 'string' || !output.fileName.endsWith('.json')) {
      continue
    }
    if (root && (output.fileName === `${root}.json` || !output.fileName.startsWith(`${root}/`))) {
      continue
    }

    const source = typeof output.source === 'string' ? output.source : output.source?.toString()
    if (!source) {
      continue
    }

    try {
      const parsed = JSON.parse(source)
      if (!parsed || typeof parsed !== 'object' || !parsed.usingComponents || typeof parsed.usingComponents !== 'object' || Array.isArray(parsed.usingComponents)) {
        continue
      }

      let mutated = false
      for (const [componentName, importee] of Object.entries(parsed.usingComponents as Record<string, string>)) {
        if (typeof importee !== 'string' || !matchesSubPackageDependency(dependencyPatterns, importee, dependencies)) {
          continue
        }
        parsed.usingComponents[componentName] = toRelativeRuntimeNpmImport(output.fileName, root, importee)
        mutated = true
      }

      if (mutated) {
        output.source = `${JSON.stringify(parsed, null, 2)}\n`
      }
    }
    catch {
    }
  }
}

export function prependChunkCodePreservingDirectives(code: string, injectedCode: string) {
  const directiveMatch = code.match(DIRECTIVE_PROLOGUE_RE)
  if (!directiveMatch?.[0]) {
    return `${injectedCode}\n${code}`
  }

  const directivePrologue = directiveMatch[0]
  return `${directivePrologue}${injectedCode}\n${code.slice(directivePrologue.length)}`
}
