import type { Plugin } from 'vite'
import type { DynamicImportToken, RequireCallbackToken, RequireToken } from '../utils/ast'
import type { CorePluginState } from './helpers'
import MagicString from 'magic-string'
import path from 'pathe'
import logger from '../../logger'
import { resolveSubPackagePrefix } from '../../runtime/chunkStrategy/collector'
import { collectRequireTokens } from '../utils/ast'
import { resolveRelativeOutputFileNameWithExtension } from '../utils/outputFileName'

const REQUIRE_ANALYSIS_FILTER_RE = /\.[jt]s$/
const URL_SUFFIX_RE = /[?#].*$/

interface ResolvedAsyncDependency {
  fileName: string
  id: string
}

interface DependencyRewrite {
  end: number
  start: number
  value: string
}

interface RewriteAsyncDependenciesOptions {
  dependencyRewrites?: DependencyRewrite[]
  nativeImportTokens?: DynamicImportToken[]
  requireCallbackTokens?: RequireCallbackToken[]
}

interface NativeImportEligibilityOptions {
  dynamicImports: string
  importerPackageRoot: string
  independentTarget: boolean
  platform: string
  request: string
  targetPackageRoot: string
}

function cleanModuleId(id: string) {
  return id.replace(URL_SUFFIX_RE, '')
}

function createRelativeModuleSpecifier(importerFileName: string, targetFileName: string) {
  const relativePath = path.relative(path.dirname(importerFileName), targetFileName)
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function resolveModulePackageRoot(
  id: string,
  relativeAbsoluteSrcRoot: (id: string) => string,
  subPackageRoots: string[],
) {
  return resolveSubPackagePrefix(
    relativeAbsoluteSrcRoot(cleanModuleId(id)),
    subPackageRoots,
  )
}

/**
 * 判断静态导入是否能安全交给微信普通分包的原生异步加载器。
 */
export function isNativeSubPackageImport(options: NativeImportEligibilityOptions) {
  return options.dynamicImports === 'native'
    && options.platform === 'weapp'
    && options.request.startsWith('.')
    && Boolean(options.targetPackageRoot)
    && options.targetPackageRoot !== options.importerPackageRoot
    && !options.independentTarget
}

export function rewriteAsyncDependencies(
  code: string,
  options: RewriteAsyncDependenciesOptions,
) {
  const {
    dependencyRewrites = [],
    nativeImportTokens = [],
    requireCallbackTokens = [],
  } = options

  if (
    dependencyRewrites.length === 0
    && nativeImportTokens.length === 0
    && requireCallbackTokens.length === 0
  ) {
    return null
  }

  const source = new MagicString(code)
  for (const token of requireCallbackTokens) {
    source.overwrite(token.callStart, token.start, 'void require.async(')
    source.overwrite(token.end, token.successCallbackStart, ').then(')
  }
  for (const token of nativeImportTokens) {
    source.overwrite(token.callStart, token.start, 'require.async(')
  }
  for (const rewrite of dependencyRewrites) {
    source.overwrite(rewrite.start, rewrite.end, JSON.stringify(rewrite.value))
  }

  return {
    code: source.toString(),
    map: source.generateMap({ hires: 'boundary' }),
  }
}

export function rewriteRequireCallbacks(code: string, tokens: RequireCallbackToken[]) {
  return rewriteAsyncDependencies(code, { requireCallbackTokens: tokens })
}

export function createRequireAnalysisPlugin(state: CorePluginState): Plugin {
  const { ctx, requireAsyncEmittedChunks } = state
  const { configService, scanService } = ctx
  const dynamicImports = configService.weappViteConfig.chunks?.dynamicImports ?? 'preserve'
  let warnedInlineFallback = false

  return {
    name: 'weapp-vite:post',
    enforce: 'post',

    buildStart() {
      if (dynamicImports === 'inline' && state.buildTarget === 'app' && !warnedInlineFallback) {
        warnedInlineFallback = true
        logger.warn('`weapp.chunks.dynamicImports: "inline"` 已废弃，当前会回退为 `preserve`；请改用 `preserve`，或在微信分包场景使用 `native`。')
      }
    },

    transform: {
      filter: {
        id: REQUIRE_ANALYSIS_FILTER_RE,
      },
      async handler(code, id) {
        try {
          const ast = this.parse(code)
          const {
            dynamicImportTokens,
            requireCallbackTokens,
            requireTokens,
          } = collectRequireTokens(ast)
          const dependencyRewrites: DependencyRewrite[] = []
          const nativeImportTokens: DynamicImportToken[] = []
          const resolvedDependencies: ResolvedAsyncDependency[] = []
          const importerFileName = resolveRelativeOutputFileNameWithExtension(configService, cleanModuleId(id), '.js')
          const subPackageRoots = [...scanService.subPackageMap.keys()]
            .filter(Boolean)
            .sort((left, right) => right.length - left.length)
          const importerPackageRoot = resolveModulePackageRoot(
            id,
            configService.relativeAbsoluteSrcRoot,
            subPackageRoots,
          )

          const resolveDependency = async (token: RequireToken | DynamicImportToken) => {
            if (!token.value.startsWith('.')) {
              return null
            }

            const absoluteRequest = path.resolve(path.dirname(cleanModuleId(id)), token.value)
            const resolved = await this.resolve(absoluteRequest, id)
            if (!resolved || resolved.external) {
              return null
            }

            const resolvedId = cleanModuleId(resolved.id)
            const fileName = resolveRelativeOutputFileNameWithExtension(configService, resolvedId, '.js')
            return {
              dependency: {
                fileName,
                id: resolvedId,
              },
              specifier: createRelativeModuleSpecifier(importerFileName, fileName),
            }
          }

          for (const token of requireTokens) {
            const resolved = await resolveDependency(token)
            if (!resolved) {
              continue
            }
            dependencyRewrites.push({
              end: token.end,
              start: token.start,
              value: resolved.specifier,
            })
            resolvedDependencies.push(resolved.dependency)
          }

          if (dynamicImports === 'native' && configService.platform === 'weapp') {
            for (const token of dynamicImportTokens) {
              const resolved = await resolveDependency(token)
              if (!resolved) {
                continue
              }

              const targetPackageRoot = resolveModulePackageRoot(
                resolved.dependency.id,
                configService.relativeAbsoluteSrcRoot,
                subPackageRoots,
              )
              if (!isNativeSubPackageImport({
                dynamicImports,
                importerPackageRoot,
                independentTarget: scanService.independentSubPackageMap.has(targetPackageRoot),
                platform: configService.platform,
                request: token.value,
                targetPackageRoot,
              })) {
                continue
              }

              dependencyRewrites.push({
                end: token.end,
                start: token.start,
                value: resolved.specifier,
              })
              nativeImportTokens.push(token)
              resolvedDependencies.push(resolved.dependency)
            }
          }

          const rewritten = rewriteAsyncDependencies(code, {
            dependencyRewrites,
            nativeImportTokens,
            requireCallbackTokens,
          })

          return {
            code: rewritten?.code ?? code,
            ...(rewritten ? {} : { ast }),
            map: rewritten?.map ?? null,
            meta: { requireAsyncDependencies: resolvedDependencies },
          }
        }
        catch (error) {
          logger.error(error)
        }
      },
    },

    async moduleParsed(moduleInfo) {
      const dependencies = moduleInfo.meta.requireAsyncDependencies as ResolvedAsyncDependency[]
      if (!Array.isArray(dependencies)) {
        return
      }

      for (const dependency of dependencies) {
        await this.load({ id: dependency.id })
        if (requireAsyncEmittedChunks.has(dependency.id)) {
          continue
        }

        requireAsyncEmittedChunks.add(dependency.id)
        this.emitFile({
          type: 'chunk',
          id: dependency.id,
          fileName: dependency.fileName,
          preserveSignature: 'exports-only',
        })
      }
    },
  }
}
