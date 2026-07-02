import type { OutputBundle, OutputChunk } from 'rolldown'
import type { ScriptAnalysisResult } from '../../../../../ast'
import type { MpPlatform } from '../../../../../types'
import { analyzeScript, analyzeScripts, mayContainPlatformApiAccess, mayContainStaticRequireLiteral, platformApiIdentifiers } from '../../../../../ast'
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

function mayNeedChunkScriptAnalysis(code: string) {
  if (code.includes('require')) {
    return true
  }

  for (const identifier of platformApiIdentifiers) {
    if (code.includes(identifier)) {
      return true
    }
  }
  return false
}

export type ChunkScriptAnalysis = Pick<ScriptAnalysisResult, 'hasPlatformApiAccess' | 'hasStaticRequireLiteral'>
export type ChunkScriptAnalysisCache = WeakMap<OutputChunk, {
  analysis: ChunkScriptAnalysis
  code: string
}>

export function rememberChunkScriptAnalysis(
  chunk: OutputChunk,
  analysis: ChunkScriptAnalysis,
  options?: {
    cache?: ChunkScriptAnalysisCache
  },
) {
  options?.cache?.set(chunk, {
    analysis,
    code: chunk.code,
  })
}

export function getChunkScriptAnalysis(
  chunk: OutputChunk,
  options?: {
    astEngine?: 'babel' | 'oxc'
    cache?: ChunkScriptAnalysisCache
  },
): ChunkScriptAnalysis {
  const cached = options?.cache?.get(chunk)
  if (cached?.code === chunk.code) {
    return cached.analysis
  }

  const analysis = mayNeedChunkScriptAnalysis(chunk.code)
    ? analyzeScript(chunk.code, { engine: options?.astEngine })
    : {
        hasPlatformApiAccess: false,
        hasStaticRequireLiteral: false,
      }
  rememberChunkScriptAnalysis(chunk, analysis, options)
  return analysis
}

export function warmupBundleScriptAnalysis(
  bundle: OutputBundle,
  options?: {
    astEngine?: 'babel' | 'oxc'
    cache?: ChunkScriptAnalysisCache
  },
) {
  const cache = options?.cache
  if (!cache) {
    return
  }

  const chunks: OutputChunk[] = []
  const inputs: Array<{ code: string, filename?: string }> = []
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const cached = cache.get(chunk)
    if (cached?.code === chunk.code) {
      continue
    }
    if (!mayNeedChunkScriptAnalysis(chunk.code)) {
      rememberChunkScriptAnalysis(chunk, {
        hasPlatformApiAccess: false,
        hasStaticRequireLiteral: false,
      }, options)
      continue
    }

    chunks.push(chunk)
    inputs.push({
      code: chunk.code,
      filename: chunk.fileName,
    })
  }

  if (inputs.length === 0) {
    return
  }

  const analyses = analyzeScripts(inputs, { engine: options.astEngine })
  for (const [index, analysis] of analyses.entries()) {
    const chunk = chunks[index]
    if (!chunk) {
      continue
    }
    rememberChunkScriptAnalysis(chunk, analysis, options)
  }
}

export function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    analysis?: Pick<ChunkScriptAnalysis, 'hasPlatformApiAccess'>
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!(options?.analysis?.hasPlatformApiAccess ?? mayContainPlatformApiAccess(code, { engine: options?.astEngine }))) {
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
    analysis?: Pick<ChunkScriptAnalysis, 'hasStaticRequireLiteral'>
    astEngine?: 'babel' | 'oxc'
  },
) {
  if (!(options?.analysis?.hasStaticRequireLiteral ?? mayContainStaticRequireLiteral(code, { engine: options?.astEngine }))) {
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
    analysisCache?: ChunkScriptAnalysisCache
    astEngine?: 'babel' | 'oxc'
  },
) {
  warmupBundleScriptAnalysis(bundle, {
    astEngine: options?.astEngine,
    cache: options?.analysisCache,
  })

  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const analysis = getChunkScriptAnalysis(chunk, {
      astEngine: options?.astEngine,
      cache: options?.analysisCache,
    })
    const nextCode = rewriteChunkNpmImportsByPlatform(platform, chunk.code, dependencies, mode, {
      ...options,
      analysis,
    })
    if (nextCode === chunk.code) {
      continue
    }
    chunk.code = nextCode
    rememberChunkScriptAnalysis(chunk, analysis, {
      cache: options?.analysisCache,
    })
  }
}

export function rewriteBundlePlatformApi(
  bundle: OutputBundle,
  globalName: string,
  options?: {
    analysisCache?: ChunkScriptAnalysisCache
    astEngine?: 'babel' | 'oxc'
  },
) {
  warmupBundleScriptAnalysis(bundle, {
    astEngine: options?.astEngine,
    cache: options?.analysisCache,
  })

  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const analysis = getChunkScriptAnalysis(chunk, {
      astEngine: options?.astEngine,
      cache: options?.analysisCache,
    })
    const nextCode = replacePlatformApiAccess(chunk.code, globalName, {
      ...options,
      analysis,
    })
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
    if (
      !(chunk.code.includes('Function(') && chunk.code.includes('return this'))
      && !chunk.code.includes('typeof self<')
    ) {
      continue
    }

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
