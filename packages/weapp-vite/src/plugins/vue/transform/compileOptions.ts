import type { CompileVueFileOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import type { MpPlatform } from '../../../types'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { getMiniProgramTemplatePlatform } from 'wevu/compiler'
import logger from '../../../logger'
import { createCachedEntryResolveOptions, resolveEntryPath } from '../../../utils/entryResolve'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { createSfcResolveSrcOptions } from '../../utils/vueSfc'
import { resolveClassStyleWxsLocationForBase } from './classStyle'
import { createUsingComponentPathResolver } from './usingComponentResolver'
import { isWevuMinifyEnabled, resolveWevuDefaultsWithPreset } from './wevuPreset'

export type CompileVueFileResolvedOptions = CompileVueFileOptions

interface CompileOptionsContext {
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
  compileOptionsCache?: Map<string, CompileVueFileResolvedOptions>
  componentMetaCache?: CompileVueFileResolvedOptions['componentMetaCache']
}

type AutoImportComponentSourceType = 'wevu-sfc' | 'native'

function hasVueExtension(id: string | undefined) {
  return Boolean(id?.endsWith('.vue'))
}

export function getCompileVueFileOptionsCacheKey(vuePath: string, isPage: boolean, isApp: boolean) {
  return `${vuePath}::${isPage ? 'page' : 'component'}::${isApp ? 'app' : 'entry'}`
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

function buildCompileVueFileOptions(
  ctx: CompilerContext,
  pluginCtx: any,
  vuePath: string,
  isPage: boolean,
  isApp: boolean,
  configService: NonNullable<CompilerContext['configService']>,
  state: CompileOptionsContext,
): CompileVueFileResolvedOptions {
  const importerBaseName = removeExtensionDeep(vuePath)
  const autoImportResolveCache = new Map<string, {
    match: ReturnType<NonNullable<CompilerContext['autoImportService']>['resolve']>
    version: number
  }>()
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
    warn: (message: string) => logger.warn(message),
    autoUsingComponents: {
      enabled: true,
      warn: (message: string) => logger.warn(message),
      resolveUsingComponentPath: createUsingComponentPathResolver(pluginCtx, configService, state.reExportResolutionCache),
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
        return {
          ...match.value,
          ...sourceInfo,
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
      formatWxml,
      wxsExtension: templatePlatformOptions.wxsExtension,
      classStyleWxsSrc,
    },
    json: {
      kind: jsonKind,
      defaults: jsonConfig?.defaults,
      mergeStrategy: jsonConfig?.mergeStrategy,
    },
    sfcSrc: createSfcResolveSrcOptions(pluginCtx, configService),
    wevuDefaults,
    minify: wevuMinify,
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
) {
  const cacheKey = getCompileVueFileOptionsCacheKey(vuePath, isPage, isApp)
  const cached = state.compileOptionsCache?.get(cacheKey)
  if (cached) {
    return cached
  }

  const created = buildCompileVueFileOptions(ctx, pluginCtx, vuePath, isPage, isApp, configService, state)
  state.compileOptionsCache?.set(cacheKey, created)
  return created
}
