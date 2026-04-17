import type { OutputBundle, OutputChunk } from 'rolldown'
import type { MpPlatform } from '../../../../../types'
import { mayContainPlatformApiAccess, mayContainStaticRequireLiteral } from '../../../../../ast'
import { generate, parseJsLike, traverse } from '../../../../../utils/babel'
import {
  hasNpmDependencyPrefix,
  normalizeNpmImportLookupPath,
  normalizeNpmImportPathByPlatform,
  resolveNpmDependencyId,
} from '../../../../../utils/npmImport'
import { rewriteMiniProgramPlatformApiAccess } from '../../platformApiRewrite'
import {
  BROWSER_GLOBAL_HOST_TERNARY_RE,
  DYNAMIC_GLOBAL_RESOLUTION_RE,
} from '../constants'
import { getRequireImportLiteral, setRequireImportLiteral } from './literals'

export function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!mayContainPlatformApiAccess(code, { engine: options?.astEngine })) {
    return code
  }
  return rewriteMiniProgramPlatformApiAccess(code, globalName, {
    engine: options?.astEngine,
  })
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
        const currentValue = getRequireImportLiteral(firstArg)
        if (typeof currentValue !== 'string') {
          return
        }

        const nextValue = normalizeNpmImportByPlatform(platform, currentValue, dependencies, mode)
        if (nextValue === currentValue) {
          return
        }

        setRequireImportLiteral(firstArg, nextValue)
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

export function matchesSubPackageDependency(
  dependencies: (string | RegExp)[] | undefined,
  importee: string,
  fallbackDependencies?: Record<string, string>,
) {
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
