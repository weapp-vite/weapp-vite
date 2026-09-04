import type { CompilerAppShell, CompilerPageLayoutPlan, CompileVueFileOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import type { MpPlatform } from '../../../types'
import type { ResolvedAppShell } from './appShell'
import type { ResolvedPageLayoutPlan } from './pageLayout'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { getMiniProgramTemplatePlatform } from 'wevu/compiler'
import logger from '../../../logger'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import { createCachedEntryResolveOptions, resolveEntryPath } from '../../../utils/entryResolve'
import { toPosixPath } from '../../../utils/path'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { usingComponentFromResolvedFile } from '../../../utils/usingComponentFrom'
import { resolveRelativeOutputFileNameWithExtension } from '../../utils/outputFileName'
import { createSfcResolveSrcOptions } from '../../utils/vueSfc'
import { createCompilerAppShellSignature, toCompilerAppShell } from './appShell'
import { resolveClassStyleWxsLocationForBase } from './classStyle'
import { createCompilerPageLayoutPlanSignature, toCompilerPageLayoutPlan } from './pageLayout'
import { createUsingComponentPathResolver } from './usingComponentResolver'
import { isAutoSetDataPickEnabledWithPreset, isWevuMinifyEnabled, resolveWevuDefaultsWithPreset } from './wevuPreset'

export type CompileVueFileResolvedOptions = CompileVueFileOptions

export type SfcStylePreprocessOptions = NonNullable<NonNullable<CompileVueFileOptions['style']>['preprocessOptions']>

interface CompileOptionsContext {
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
  compileOptionsCache?: Map<string, CompileVueFileResolvedOptions>
  componentMetaCache?: CompileVueFileResolvedOptions['componentMetaCache']
  emitResolvedComponentEntries?: boolean
}

type AutoImportComponentSourceType = 'wevu-sfc' | 'native'

function hasVueExtension(id: string | undefined) {
  return Boolean(id?.endsWith('.vue'))
}

export function getCompileVueFileOptionsCacheKey(
  vuePath: string,
  isPage: boolean,
  isApp: boolean,
  delegatesComponentRegistration = false,
  emitResolvedComponentEntries = true,
  pageLayoutSignature = 'null',
  appShellSignature = 'null',
) {
  return `${vuePath}::${isPage ? 'page' : 'component'}::${isApp ? 'app' : 'entry'}::${delegatesComponentRegistration ? 'logical-registration' : 'module-registration'}::${emitResolvedComponentEntries ? 'emit-entries' : 'resolve-only'}::layout=${pageLayoutSignature}::app-shell=${appShellSignature}`
}

function shouldDelegateComponentRegistration(
  ctx: CompilerContext,
  vuePath: string,
  isPage: boolean,
  isApp: boolean,
  configService: NonNullable<CompilerContext['configService']>,
) {
  return !isPage
    && !isApp
    && !configService.weappLibConfig?.enabled
    && !ctx.moduleGraphService?.isLogicalLayoutEntry?.(vuePath)
}

export function isVueTransformSourceMapEnabled(configService: NonNullable<CompilerContext['configService']>) {
  return Boolean(configService.inlineConfig?.build?.sourcemap)
}

export function resolveSfcStylePreprocessOptions(
  configService: NonNullable<CompilerContext['configService']>,
): SfcStylePreprocessOptions | undefined {
  const options = configService.inlineConfig?.css?.preprocessorOptions as SfcStylePreprocessOptions | undefined
  if (!options) {
    return undefined
  }

  const root = path.resolve(configService.cwd, configService.inlineConfig?.root ?? '.')
  const nodeModules = path.resolve(root, 'node_modules')
  return Object.fromEntries(Object.entries(options).map(([language, languageOptions]) => {
    if (!['sass', 'scss'].includes(language)) {
      return [language, languageOptions]
    }

    const loadPaths = Array.isArray(languageOptions.loadPaths)
      ? languageOptions.loadPaths.filter((value): value is string => typeof value === 'string')
      : []
    return [language, {
      ...languageOptions,
      loadPaths: Array.from(new Set([...loadPaths, nodeModules])),
    }]
  }))
}

export function resolveVueTemplatePlatformOptions(options: {
  platform: string
  wxsEnabled: boolean
  wxsExtension?: string
  classStyleRuntime: 'auto' | 'wxs' | 'js'
  classStyleRuntimeWarned: { value: boolean }
}) {
  const supportsWxs = options.wxsEnabled && typeof options.wxsExtension === 'string' && options.wxsExtension.length > 0
  const resolvedWxsExtension = supportsWxs ? options.wxsExtension : undefined
  let classStyleRuntime = options.classStyleRuntime

  if (options.classStyleRuntime === 'auto') {
    classStyleRuntime = supportsWxs ? 'wxs' : 'js'
  }
  else if (options.classStyleRuntime === 'wxs' && !supportsWxs) {
    classStyleRuntime = 'js'
    if (!options.classStyleRuntimeWarned.value) {
      logger.warn('已配置 vue.template.classStyleRuntime = "wxs"，但当前平台不支持 WXS 或已禁用 weapp.wxs，将回退到 JS 运行时。')
      options.classStyleRuntimeWarned.value = true
    }
  }

  return {
    templatePlatform: getMiniProgramTemplatePlatform(options.platform as MpPlatform),
    supportsWxs,
    wxsExtension: resolvedWxsExtension,
    classStyleRuntime,
  } as const
}

/**
 * 将编译入口规范化为相对 Vite 项目根目录的诊断来源路径。
 */
export function resolveBindingManifestSourceFile(
  vuePath: string,
  configService: Pick<NonNullable<CompilerContext['configService']>, 'cwd' | 'inlineConfig'>,
) {
  const projectRoot = path.resolve(configService.cwd, configService.inlineConfig?.root ?? '.')
  const cleanPath = normalizeFsResolvedId(vuePath.split(/[?#]/, 1)[0])
  const relativePath = toPosixPath(path.relative(projectRoot, cleanPath))
  return relativePath.replace(/^\.\//, '') || '.'
}

function buildCompileVueFileOptions(
  ctx: CompilerContext,
  pluginCtx: any,
  vuePath: string,
  isPage: boolean,
  isApp: boolean,
  configService: NonNullable<CompilerContext['configService']>,
  state: CompileOptionsContext,
  delegatesComponentRegistration: boolean,
  pageLayout: CompilerPageLayoutPlan | undefined,
  appShell: CompilerAppShell | undefined,
): CompileVueFileResolvedOptions {
  const importerBaseName = removeExtensionDeep(vuePath)
  const autoImportResolveCache = new Map<string, {
    match: ReturnType<NonNullable<CompilerContext['autoImportService']>['resolve']>
    version: number
  }>()
  const resolveUsingComponentPath = createUsingComponentPathResolver(pluginCtx, configService, state.reExportResolutionCache)
  const externalComponentEntryMap = ctx.runtimeState?.build?.hmr?.externalComponentEntryMap
  const registerResolvedComponentEntry = externalComponentEntryMap
    ? async (...args: Parameters<typeof resolveUsingComponentPath>) => {
      const [importSource, importerFilename, info] = args
      const resolved = await resolveUsingComponentPath(importSource, importerFilename, info)
      if (typeof resolved !== 'string' && resolved?.from && resolved.resolvedId) {
        const outputKey = removeExtensionDeep(resolved.from).replace(/^\/+/, '')
        const isNewEntry = externalComponentEntryMap.get(outputKey) !== resolved.resolvedId
        externalComponentEntryMap.set(outputKey, resolved.resolvedId)
        if (isNewEntry && state.emitResolvedComponentEntries !== false && typeof pluginCtx.emitFile === 'function') {
          pluginCtx.emitFile({
            type: 'chunk',
            id: createLogicalEntryId(resolved.resolvedId, 'component'),
            fileName: resolveRelativeOutputFileNameWithExtension(configService, resolved.resolvedId, '.js'),
            preserveSignature: 'exports-only',
          })
        }
      }
      return resolved
    }
    : resolveUsingComponentPath
  const scopedSlotsCompiler = configService.weappViteConfig?.vue?.template?.scopedSlotsCompiler ?? 'auto'
  const scopedSlotsRequirePropsConfig = configService.weappViteConfig?.vue?.template?.scopedSlotsRequireProps
  const scopedSlotsRequireProps = scopedSlotsRequirePropsConfig ?? false
  const slotSingleRootNoWrapper = configService.weappViteConfig?.vue?.template?.slotSingleRootNoWrapper ?? false
  const slotFallbackWrapper = configService.weappViteConfig?.vue?.template?.slotFallbackWrapper
  const slotFallbackWrapperStrategy = configService.weappViteConfig?.vue?.template?.slotFallbackWrapperStrategy
    ?? (configService.platform === 'weapp' && slotFallbackWrapper === undefined ? 'virtual-host' : 'view')
  const slotMultipleInstance = configService.weappViteConfig?.vue?.template?.slotMultipleInstance ?? true
  const htmlTagToWxml = configService.weappViteConfig?.vue?.template?.htmlTagToWxml
  const htmlTagToWxmlTagClass = configService.weappViteConfig?.vue?.template?.htmlTagToWxmlTagClass ?? true
  const classStyleRuntimeConfig = configService.weappViteConfig?.vue?.template?.classStyleRuntime ?? 'js'
  const objectLiteralBindMode = configService.weappViteConfig?.vue?.template?.objectLiteralBindMode ?? 'runtime'
  const mustacheInterpolation = configService.weappViteConfig?.vue?.template?.mustacheInterpolation ?? 'compact'
  const functionPropNames = configService.weappViteConfig?.vue?.template?.functionPropNames
  const i18nConfig = configService.platform === 'weapp'
    ? configService.weappViteConfig?.i18n
    : undefined
  const templateSafeCallNames = i18nConfig
    ? [i18nConfig.functionName ?? 't']
    : undefined
  const formatWxmlConfig = configService.weappViteConfig?.vue?.template?.formatWxml ?? 'auto'
  const formatWxml = formatWxmlConfig === 'auto'
    ? configService.isDev
    : formatWxmlConfig
  const wxsEnabled = configService.weappViteConfig?.wxs !== false
  const wxsExtension = configService.outputExtensions?.wxs
  const templatePlatformOptions = resolveVueTemplatePlatformOptions({
    platform: configService.platform,
    wxsEnabled,
    wxsExtension,
    classStyleRuntime: classStyleRuntimeConfig,
    classStyleRuntimeWarned: state.classStyleRuntimeWarned,
  })
  const relativeBase = configService.relativeOutputPath(vuePath.slice(0, -4))
  const resolvedWxsExtension = templatePlatformOptions.wxsExtension
  let classStyleWxsSrc: string | undefined
  if (resolvedWxsExtension && relativeBase) {
    classStyleWxsSrc = resolveClassStyleWxsLocationForBase(ctx, relativeBase, resolvedWxsExtension, configService).src
  }
  const jsonConfig = configService.weappViteConfig?.json
  const wevuDefaults = resolveWevuDefaultsWithPreset(configService.weappViteConfig)
  const wevuMinify = isWevuMinifyEnabled(configService.weappViteConfig, configService.isDev)
  const jsonKind = isApp ? 'app' : isPage ? 'page' : 'component'
  const sourceMap = isVueTransformSourceMapEnabled(configService)
  async function resolvePotentialVueSfcEntryId(candidate: string | undefined) {
    const trimmed = candidate?.trim()
    if (!trimmed) {
      return undefined
    }

    const entryResolveOptions = createCachedEntryResolveOptions(configService, { kind: 'default' })
    const localCandidate = path.isAbsolute(trimmed)
      ? trimmed
      : trimmed.startsWith('.')
        ? path.resolve(path.dirname(vuePath), trimmed)
        : !trimmed.includes(':') && !trimmed.startsWith('@')
            ? path.resolve(configService.absoluteSrcRoot, trimmed)
            : undefined

    if (localCandidate) {
      const normalized = normalizeFsResolvedId(localCandidate)
      if (hasVueExtension(normalized)) {
        return normalized
      }
      const resolvedEntry = !normalized || isSkippableResolvedId(normalized)
        ? undefined
        : await resolveEntryPath(normalized, entryResolveOptions)
      if (hasVueExtension(resolvedEntry)) {
        return resolvedEntry
      }
    }

    const resolveCandidates = path.extname(trimmed)
      ? [trimmed]
      : [trimmed, `${trimmed}.vue`, `${trimmed}/index.vue`]

    for (const resolveCandidate of resolveCandidates) {
      const resolved = await pluginCtx.resolve?.(resolveCandidate, vuePath)
      const normalized = resolved?.id ? normalizeFsResolvedId(resolved.id) : undefined
      if (!normalized || isSkippableResolvedId(normalized)) {
        continue
      }
      if (hasVueExtension(normalized)) {
        return normalized
      }
      if (path.isAbsolute(normalized)) {
        const resolvedEntry = await resolveEntryPath(normalized, entryResolveOptions)
        if (hasVueExtension(resolvedEntry)) {
          return resolvedEntry
        }
      }
    }

    return undefined
  }

  async function resolveAutoImportComponentSourceType(match: NonNullable<ReturnType<NonNullable<CompilerContext['autoImportService']>['resolve']>>) {
    if (match.kind === 'local') {
      const resolvedId = match.entry.templatePath
      const sourceType: AutoImportComponentSourceType = hasVueExtension(resolvedId) ? 'wevu-sfc' : 'native'
      return {
        resolvedId,
        sourceType,
      }
    }

    const explicitSourceType = (match.value as { sourceType?: AutoImportComponentSourceType }).sourceType
    const explicitResolvedId = (match.value as { resolvedId?: string }).resolvedId
    const resolvedExplicitVueId = await resolvePotentialVueSfcEntryId(explicitResolvedId)
    if (explicitSourceType || resolvedExplicitVueId || hasVueExtension(explicitResolvedId) || hasVueExtension(match.value.from)) {
      return {
        resolvedId: resolvedExplicitVueId ?? explicitResolvedId,
        sourceType: explicitSourceType ?? (resolvedExplicitVueId || hasVueExtension(explicitResolvedId) || hasVueExtension(match.value.from) ? 'wevu-sfc' : 'native'),
      }
    }

    let localSourceBase: string | undefined
    if (match.value.from.startsWith('/')) {
      localSourceBase = path.join(configService.absoluteSrcRoot, match.value.from.slice(1))
    }
    else if (match.value.from.startsWith('.')) {
      localSourceBase = path.resolve(path.dirname(importerBaseName), match.value.from)
    }

    if (!localSourceBase) {
      return {
        resolvedId: explicitResolvedId,
        sourceType: 'native' as const,
      }
    }

    const resolvedId = await resolveEntryPath(
      localSourceBase,
      createCachedEntryResolveOptions(configService, { kind: 'default' }),
    )
    return {
      resolvedId,
      sourceType: hasVueExtension(resolvedId) ? 'wevu-sfc' as const : 'native' as const,
    }
  }

  return {
    isPage,
    isApp,
    skipComponentTransform: delegatesComponentRegistration,
    autoSetDataPick: isAutoSetDataPickEnabledWithPreset(configService.weappViteConfig),
    bindingManifestSourceFile: resolveBindingManifestSourceFile(vuePath, configService),
    runtimeBindingManifest: configService.isDev ? 'diagnostic' : 'compact',
    pageLayout,
    appShell,
    warn: (message: string) => logger.warn(message),
    autoUsingComponents: {
      enabled: true,
      warn: (message: string) => logger.warn(message),
      resolveUsingComponentPath: registerResolvedComponentEntry,
    },
    autoImportTags: {
      enabled: true,
      warn: (message: string) => logger.warn(message),
      resolveUsingComponent: async (tag: string) => {
        const autoImportService = ctx.autoImportService
        if (!autoImportService) {
          return undefined
        }

        const version = typeof autoImportService.getVersion === 'function'
          ? autoImportService.getVersion()
          : 0
        const cached = autoImportResolveCache.get(tag)
        const match = cached && cached.version === version
          ? cached.match
          : autoImportService.resolve(tag, importerBaseName)
        if (!cached || cached.version !== version) {
          autoImportResolveCache.set(tag, {
            match,
            version,
          })
        }
        if (!match?.value) {
          return undefined
        }
        const sourceInfo = await resolveAutoImportComponentSourceType(match)
        const stableFrom = sourceInfo.sourceType === 'wevu-sfc'
          ? usingComponentFromResolvedFile(sourceInfo.resolvedId, configService)
          : undefined
        if (stableFrom && sourceInfo.resolvedId) {
          ctx.runtimeState?.build?.hmr?.externalComponentEntryMap?.set(
            removeExtensionDeep(stableFrom).replace(/^\/+/, ''),
            sourceInfo.resolvedId,
          )
        }
        return {
          ...match.value,
          ...sourceInfo,
          ...(stableFrom ? { from: stableFrom } : {}),
        }
      },
    },
    template: {
      platform: templatePlatformOptions.templatePlatform,
      htmlTagToWxml,
      htmlTagToWxmlTagClass,
      scopedSlotsCompiler,
      scopedSlotsRequireProps,
      slotSingleRootNoWrapper,
      slotFallbackWrapper,
      slotFallbackWrapperStrategy,
      slotMultipleInstance,
      classStyleRuntime: templatePlatformOptions.classStyleRuntime,
      objectLiteralBindMode,
      mustacheInterpolation,
      functionPropNames,
      templateSafeCallNames,
      formatWxml,
      wxsExtension: templatePlatformOptions.wxsExtension,
      classStyleWxsSrc,
    },
    style: {
      preprocessOptions: resolveSfcStylePreprocessOptions(configService),
    },
    json: {
      kind: jsonKind,
      defaults: jsonConfig?.defaults,
      mergeStrategy: jsonConfig?.mergeStrategy,
    },
    sfcSrc: createSfcResolveSrcOptions(pluginCtx, configService),
    wevuDefaults,
    minify: wevuMinify,
    sourceMap,
    componentMetaCache: state.componentMetaCache,
  } as const
}

export function createCompileVueFileOptions(
  ctx: CompilerContext,
  pluginCtx: any,
  vuePath: string,
  isPage: boolean,
  isApp: boolean,
  configService: NonNullable<CompilerContext['configService']>,
  state: CompileOptionsContext,
  resolvedPageLayout?: ResolvedPageLayoutPlan,
  resolvedAppShell?: ResolvedAppShell,
) {
  const delegatesComponentRegistration = shouldDelegateComponentRegistration(
    ctx,
    vuePath,
    isPage,
    isApp,
    configService,
  )
  const pageLayout = toCompilerPageLayoutPlan(resolvedPageLayout)
  const pageLayoutSignature = createCompilerPageLayoutPlanSignature(resolvedPageLayout)
  const appShell = isPage && !isApp ? toCompilerAppShell(resolvedAppShell) : undefined
  const appShellSignature = createCompilerAppShellSignature(isPage && !isApp ? resolvedAppShell : undefined)
  const cacheKey = getCompileVueFileOptionsCacheKey(
    vuePath,
    isPage,
    isApp,
    delegatesComponentRegistration,
    state.emitResolvedComponentEntries !== false,
    pageLayoutSignature,
    appShellSignature,
  )
  const cached = state.compileOptionsCache?.get(cacheKey)
  if (cached) {
    return cached
  }

  const created = buildCompileVueFileOptions(
    ctx,
    pluginCtx,
    vuePath,
    isPage,
    isApp,
    configService,
    state,
    delegatesComponentRegistration,
    pageLayout,
    appShell,
  )
  state.compileOptionsCache?.set(cacheKey, created)
  return created
}
