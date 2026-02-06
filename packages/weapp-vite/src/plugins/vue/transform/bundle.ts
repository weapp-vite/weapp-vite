import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import type { OutputExtensions } from '../../../platforms/types'
import fs from 'fs-extra'
import { compileVueFile, getClassStyleWxsSource } from 'wevu/compiler'
import logger from '../../../logger'
import { ALIPAY_GENERIC_COMPONENT_PLACEHOLDER, resolveJson } from '../../../utils'
import { getPathExistsTtlMs } from '../../../utils/cachePolicy'
import { normalizeWatchPath } from '../../../utils/path'
import { scanWxml } from '../../../wxml'
import { handleWxml } from '../../../wxml/handle'
import { pathExists as pathExistsCached } from '../../utils/cache'
import { resolveClassStyleWxsLocationForBase } from './classStyle'
import { createCompileVueFileOptions } from './compileOptions'
import { emitClassStyleWxsAssetIfMissing, emitSfcJsonAsset, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from './emitAssets'
import { collectFallbackPageEntryIds } from './fallbackEntries'
import { injectWevuPageFeaturesInJsWithViteResolver } from './injectPageFeatures'
import { emitScopedSlotAssets } from './scopedSlot'

export interface CompilationCacheEntry {
  result: VueTransformResult
  source?: string
  isPage: boolean
}

export interface VueBundleState {
  ctx: CompilerContext
  pluginCtx: any
  compilationCache: Map<string, CompilationCacheEntry>
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
}

interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

function normalizeVueConfigForPlatform(
  config: string | undefined,
  options: {
    platform: string
    dependencies?: Record<string, string>
  },
) {
  if (!config || options.platform !== 'alipay') {
    return config
  }

  try {
    const parsed = JSON.parse(config)
    return resolveJson(
      {
        json: parsed,
      },
      undefined,
      options.platform as any,
      {
        dependencies: options.dependencies,
      },
    ) ?? config
  }
  catch {
    return config
  }
}

function normalizeVueTemplateForPlatform(
  template: string,
  options: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
  },
) {
  if (options.platform !== 'alipay') {
    return template
  }

  try {
    const token = scanWxml(template, {
      platform: options.platform as any,
    })
    return handleWxml(token, {
      templateExtension: options.templateExtension,
      scriptModuleExtension: options.scriptModuleExtension,
    }).code
  }
  catch {
    return template
  }
}

function emitAlipayGenericPlaceholderAssets(
  ctx: { emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void },
  bundle: Record<string, any>,
  relativeBase: string,
  configSource: string | undefined,
  outputExtensions: OutputExtensions | undefined,
  platform: string,
) {
  if (platform !== 'alipay' || !configSource) {
    return
  }

  let config: Record<string, any>
  try {
    const parsed = JSON.parse(configSource)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return
    }
    config = parsed
  }
  catch {
    return
  }

  const componentGenerics = config.componentGenerics
  if (!componentGenerics || typeof componentGenerics !== 'object' || Array.isArray(componentGenerics)) {
    return
  }

  const shouldEmit = Object.values(componentGenerics).some((value) => {
    if (value === true) {
      return true
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false
    }
    return (value as Record<string, any>).default === ALIPAY_GENERIC_COMPONENT_PLACEHOLDER
  })
  if (!shouldEmit) {
    return
  }

  const templateExtension = outputExtensions?.wxml ?? 'wxml'
  const jsonExtension = outputExtensions?.json ?? 'json'
  const scriptExtension = outputExtensions?.js ?? 'js'
  const dirIndex = relativeBase.lastIndexOf('/')
  const dir = dirIndex >= 0 ? relativeBase.slice(0, dirIndex) : ''
  const placeholderName = ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.replace(/^\.\//, '')
  const placeholderBase = dir ? `${dir}/${placeholderName}` : placeholderName

  emitSfcTemplateIfMissing(ctx, bundle, placeholderBase, '<view />', templateExtension)
  emitSfcJsonAsset(ctx, bundle, placeholderBase, { config: JSON.stringify({ component: true }) }, {
    extension: jsonExtension,
    kind: 'component',
  })

  const scriptFileName = `${placeholderBase}.${scriptExtension}`
  const existing = bundle[scriptFileName]
  const scriptSource = 'Component({})'
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== scriptSource) {
      existing.source = scriptSource
    }
    return
  }

  ctx.emitFile({ type: 'asset', fileName: scriptFileName, source: scriptSource })
}

export async function emitVueBundleAssets(
  bundle: Record<string, any>,
  state: VueBundleState,
) {
  const { ctx, pluginCtx, compilationCache, reExportResolutionCache, classStyleRuntimeWarned } = state
  const { configService, scanService } = ctx
  if (!configService || !scanService) {
    return
  }

  const compileOptionsState = { reExportResolutionCache, classStyleRuntimeWarned }
  const outputExtensions = configService.outputExtensions
  const templateExtension = outputExtensions?.wxml ?? 'wxml'
  const styleExtension = outputExtensions?.wxss ?? 'wxss'
  const jsonExtension = outputExtensions?.json ?? 'json'

  // 首先处理缓存中已有的编译结果
  for (const [filename, cached] of compilationCache.entries()) {
    if (typeof pluginCtx.addWatchFile === 'function') {
      pluginCtx.addWatchFile(normalizeWatchPath(filename))
    }

    let result = cached.result
    if (configService.isDev) {
      try {
        const source = await fs.readFile(filename, 'utf-8')
        if (source !== cached.source) {
          const isApp = /[\\/]app\.vue$/.test(filename)
          const compiled = await compileVueFile(
            source,
            filename,
            createCompileVueFileOptions(ctx, pluginCtx, filename, cached.isPage, isApp, configService, compileOptionsState),
          )

          if (cached.isPage && compiled.script) {
            const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, compiled.script, filename, {
              checkMtime: configService.isDev,
            })
            if (injected.transformed) {
              compiled.script = injected.code
            }
          }

          cached.source = source
          cached.result = compiled
          result = compiled
        }
      }
      catch {
        // 忽略异常，回退到缓存的编译结果
      }
    }

    // 计算输出文件名（去掉 .vue 扩展名）
    const baseName = filename.slice(0, -4)
    const relativeBase = configService.relativeOutputPath(baseName)
    if (!relativeBase) {
      continue
    }

    const isAppVue = /[\\/]app\.vue$/.test(filename)
    const shouldEmitComponentJson = !isAppVue && !cached.isPage
    const shouldMergeJsonAsset = isAppVue
    const jsonConfig = configService.weappViteConfig?.json
    const jsonKind = isAppVue ? 'app' : cached.isPage ? 'page' : 'component'

    // 发出模板文件
    if (result.template) {
      emitSfcTemplateIfMissing(pluginCtx, bundle, relativeBase, normalizeVueTemplateForPlatform(result.template, {
        platform: configService.platform,
        templateExtension,
        scriptModuleExtension: configService.outputExtensions?.wxs,
      }), templateExtension)
    }

    const wxsExtension = configService.outputExtensions?.wxs
    const needsClassStyleWxs = Boolean(result.classStyleWxs)
      || Boolean(result.scopedSlotComponents?.some(slot => slot.classStyleWxs))
    let classStyleWxs: ClassStyleWxsAsset | undefined
    if (needsClassStyleWxs && typeof wxsExtension === 'string' && wxsExtension.length > 0) {
      const classStyleWxsLocation = resolveClassStyleWxsLocationForBase(ctx, relativeBase, wxsExtension, configService)
      classStyleWxs = { fileName: classStyleWxsLocation.fileName, source: getClassStyleWxsSource() }
    }

    if (result.classStyleWxs && classStyleWxs) {
      emitClassStyleWxsAssetIfMissing(
        pluginCtx,
        bundle,
        classStyleWxs.fileName,
        classStyleWxs.source,
      )
    }

    emitScopedSlotAssets(pluginCtx, bundle, relativeBase, result, ctx, classStyleWxs, outputExtensions, {
      defaults: jsonConfig?.defaults?.component,
      mergeStrategy: jsonConfig?.mergeStrategy,
    })

    // 发出 .json 文件（页面/组件配置）
    if (result.config || shouldEmitComponentJson) {
      const normalizedConfig = normalizeVueConfigForPlatform(result.config, {
        platform: configService.platform,
        dependencies: configService.packageJson?.dependencies,
      })
      emitAlipayGenericPlaceholderAssets(pluginCtx, bundle, relativeBase, normalizedConfig, outputExtensions, configService.platform)
      emitSfcJsonAsset(pluginCtx, bundle, relativeBase, { config: normalizedConfig }, {
        defaultConfig: shouldEmitComponentJson ? { component: true } : undefined,
        mergeExistingAsset: shouldMergeJsonAsset,
        mergeStrategy: jsonConfig?.mergeStrategy,
        defaults: jsonConfig?.defaults?.[jsonKind],
        kind: jsonKind,
        extension: jsonExtension,
      })
    }
  }

  const collectedEntries = await collectFallbackPageEntryIds(configService, scanService)
  for (const entryId of collectedEntries) {
    const relativeBase = configService.relativeOutputPath(entryId)
    if (!relativeBase) {
      continue
    }
    const vuePath = `${entryId}.vue`

    // 说明：compilationCache 使用完整的 .vue 路径作为 key，这里需要保持一致避免重复编译覆盖已生成的 chunk
    if (compilationCache.has(vuePath)) {
      continue
    }

    if (typeof pluginCtx.addWatchFile === 'function') {
      pluginCtx.addWatchFile(normalizeWatchPath(vuePath))
    }

    if (!(await pathExistsCached(vuePath, { ttlMs: getPathExistsTtlMs(configService) }))) {
      continue
    }

    try {
      const source = await fs.readFile(vuePath, 'utf-8')
      const result = await compileVueFile(
        source,
        vuePath,
        createCompileVueFileOptions(ctx, pluginCtx, vuePath, true, false, configService, compileOptionsState),
      )

      if (result.script) {
        const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, vuePath, {
          checkMtime: configService.isDev,
        })
        if (injected.transformed) {
          result.script = injected.code
        }
      }

      // 注意：后备产物仅用于补齐未被 Vite 引用时缺失的 template/style/json。
      // JS 入口必须交给 bundler（chunk）统一产出；否则直接写入脚本内容会绕过 output.format，导致 dist 出现 ESM 产物甚至覆盖 CJS chunk。

      if (result.template) {
        emitSfcTemplateIfMissing(pluginCtx, bundle, relativeBase, normalizeVueTemplateForPlatform(result.template, {
          platform: configService.platform,
          templateExtension,
          scriptModuleExtension: configService.outputExtensions?.wxs,
        }), templateExtension)
      }

      const wxsExtension = configService.outputExtensions?.wxs
      const needsClassStyleWxs = Boolean(result.classStyleWxs)
        || Boolean(result.scopedSlotComponents?.some(slot => slot.classStyleWxs))
      let classStyleWxs: ClassStyleWxsAsset | undefined
      if (needsClassStyleWxs && typeof wxsExtension === 'string' && wxsExtension.length > 0) {
        const classStyleWxsLocation = resolveClassStyleWxsLocationForBase(ctx, relativeBase, wxsExtension, configService)
        classStyleWxs = { fileName: classStyleWxsLocation.fileName, source: getClassStyleWxsSource() }
      }

      if (result.classStyleWxs && classStyleWxs) {
        emitClassStyleWxsAssetIfMissing(
          pluginCtx,
          bundle,
          classStyleWxs.fileName,
          classStyleWxs.source,
        )
      }

      const jsonConfig = configService.weappViteConfig?.json
      emitScopedSlotAssets(pluginCtx, bundle, relativeBase, result, ctx, classStyleWxs, outputExtensions, {
        defaults: jsonConfig?.defaults?.component,
        mergeStrategy: jsonConfig?.mergeStrategy,
      })

      // 说明：fallback 产物不在 Vite 模块图中，无法走 Vite CSS pipeline（sass/postcss）。
      // 这里仍然兜底发出样式文件，避免生产构建缺失样式文件。
      if (result.style) {
        emitSfcStyleIfMissing(pluginCtx, bundle, relativeBase, result.style, styleExtension)
      }

      const normalizedConfig = normalizeVueConfigForPlatform(result.config, {
        platform: configService.platform,
        dependencies: configService.packageJson?.dependencies,
      })
      emitAlipayGenericPlaceholderAssets(pluginCtx, bundle, relativeBase, normalizedConfig, outputExtensions, configService.platform)
      emitSfcJsonAsset(pluginCtx, bundle, relativeBase, { config: normalizedConfig }, {
        mergeExistingAsset: true,
        mergeStrategy: jsonConfig?.mergeStrategy,
        defaults: jsonConfig?.defaults?.page,
        kind: 'page',
        extension: jsonExtension,
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[Vue 编译] 编译 ${vuePath} 失败：${message}`)
    }
  }
}
