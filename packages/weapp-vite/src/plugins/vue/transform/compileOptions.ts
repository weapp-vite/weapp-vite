import type { CompilerContext } from '../../../context'
import type { MpPlatform } from '../../../types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { getMiniProgramTemplatePlatform } from 'wevu/compiler'
import logger from '../../../logger'
import { createSfcResolveSrcOptions } from '../../utils/vueSfc'
import { resolveClassStyleWxsLocationForBase } from './classStyle'
import { createUsingComponentPathResolver } from './usingComponentResolver'
import { resolveWevuDefaultsWithPreset } from './wevuPreset'

interface CompileOptionsContext {
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
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

export function createCompileVueFileOptions(
  ctx: CompilerContext,
  pluginCtx: any,
  vuePath: string,
  isPage: boolean,
  isApp: boolean,
  configService: NonNullable<CompilerContext['configService']>,
  state: CompileOptionsContext,
) {
  const scopedSlotsCompiler = configService.weappViteConfig?.vue?.template?.scopedSlotsCompiler ?? 'auto'
  const scopedSlotsRequirePropsConfig = configService.weappViteConfig?.vue?.template?.scopedSlotsRequireProps
  const scopedSlotsRequireProps = scopedSlotsRequirePropsConfig ?? (scopedSlotsCompiler !== 'augmented')
  const slotMultipleInstance = configService.weappViteConfig?.vue?.template?.slotMultipleInstance ?? true
  const slotSingleRootNoWrapper = configService.weappViteConfig?.vue?.template?.slotSingleRootNoWrapper ?? false
  const htmlTagToWxml = configService.weappViteConfig?.vue?.template?.htmlTagToWxml
  const htmlTagToWxmlTagClass = configService.weappViteConfig?.vue?.template?.htmlTagToWxmlTagClass ?? true
  const classStyleRuntimeConfig = configService.weappViteConfig?.vue?.template?.classStyleRuntime ?? 'js'
  const objectLiteralBindMode = configService.weappViteConfig?.vue?.template?.objectLiteralBindMode ?? 'runtime'
  const mustacheInterpolation = configService.weappViteConfig?.vue?.template?.mustacheInterpolation ?? 'compact'
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
  const jsonKind = isApp ? 'app' : isPage ? 'page' : 'component'
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
        const match = ctx.autoImportService?.resolve(tag, removeExtensionDeep(vuePath))
        return match?.value
      },
    },
    template: {
      platform: templatePlatformOptions.templatePlatform,
      htmlTagToWxml,
      htmlTagToWxmlTagClass,
      scopedSlotsCompiler,
      scopedSlotsRequireProps,
      slotMultipleInstance,
      slotSingleRootNoWrapper,
      classStyleRuntime: templatePlatformOptions.classStyleRuntime,
      objectLiteralBindMode,
      mustacheInterpolation,
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
  } as const
}
