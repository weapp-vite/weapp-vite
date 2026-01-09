import type { Plugin } from 'vite'
import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { CompilerContext } from '../../../context'
import type { VueTransformResult } from './compileVueFile'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { WE_VU_MODULE_ID, WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import logger from '../../../logger'
import { getPathExistsTtlMs } from '../../../utils/cachePolicy'
import { toPosixPath } from '../../../utils/path'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { toAbsoluteId } from '../../../utils/toAbsoluteId'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../../utils/cache'
import { getSfcCheckMtime, readAndParseSfc } from '../../utils/vueSfc'
import { createPageEntryMatcher } from '../../wevu/pageFeatures'
import { VUE_PLUGIN_NAME } from '../index'
import { getSourceFromVirtualId } from '../resolver'
import { compileVueFile } from './compileVueFile'
import { emitSfcJsonAsset, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from './vitePlugin/emitAssets'
import { collectFallbackPageEntryIds } from './vitePlugin/fallbackEntries'
import { injectWevuPageFeaturesInJsWithViteResolver } from './vitePlugin/injectPageFeatures'
import { createUsingComponentPathResolver } from './vitePlugin/usingComponentResolver'

interface WeappVueStyleRequest {
  filename: string
  index: number
}

function parseWeappVueStyleRequest(id: string): WeappVueStyleRequest | undefined {
  const [filename, rawQuery] = id.split('?', 2)
  if (!rawQuery) {
    return
  }

  const params = new URLSearchParams(rawQuery)
  if (!params.has('weapp-vite-vue')) {
    return
  }

  if (params.get('type') !== 'style') {
    return
  }

  const indexRaw = params.get('index')
  const index = indexRaw ? Number(indexRaw) : 0
  if (!Number.isFinite(index) || index < 0) {
    return
  }

  return { filename, index }
}

function buildWeappVueStyleRequest(filename: string, styleBlock: { lang?: string, scoped?: boolean, module?: boolean | string }, index: number): string {
  const lang = styleBlock.lang || 'css'

  let query = `weapp-vite-vue&type=style&index=${index}`
  if (styleBlock.scoped) {
    query += '&scoped=true'
  }
  if (styleBlock.module) {
    query += typeof styleBlock.module === 'string'
      ? `&module=${encodeURIComponent(styleBlock.module)}`
      : '&module=true'
  }

  // IMPORTANT: `lang.*` must be at the end so Vite's CSS_LANGS_RE can match it.
  query += `&lang.${lang}`
  return `${filename}?${query}`
}

function parseJsonSafely(source: string | undefined): Record<string, any> | undefined {
  if (!source) {
    return undefined
  }
  try {
    return JSON.parse(source)
  }
  catch {
    return undefined
  }
}

const SCOPED_SLOT_VIRTUAL_PREFIX = '\0weapp-vite:scoped-slot:'

function buildScopedSlotComponentModule(): string {
  return [
    `import { ${WE_VU_RUNTIME_APIS.createWevuScopedSlotComponent} as _createWevuScopedSlotComponent } from '${WE_VU_MODULE_ID}';`,
    'const globalObject = typeof globalThis !== \'undefined\' ? globalThis : undefined;',
    'const createWevuScopedSlotComponent = globalObject?.__weapp_vite_createScopedSlotComponent',
    '  ?? _createWevuScopedSlotComponent;',
    'if (typeof createWevuScopedSlotComponent === \'function\') {',
    '  createWevuScopedSlotComponent();',
    '}',
    '',
  ].join('\n')
}

function getScopedSlotVirtualId(componentBase: string): string {
  return `${SCOPED_SLOT_VIRTUAL_PREFIX}${componentBase}`
}

function emitScopedSlotAssets(
  ctx: { emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void },
  bundle: Record<string, any>,
  relativeBase: string,
  result: VueTransformResult,
  compilerCtx?: Pick<CompilerContext, 'autoImportService' | 'wxmlService'>,
) {
  const scopedSlots = result.scopedSlotComponents
  if (!scopedSlots?.length) {
    return
  }

  const configObj = parseJsonSafely(result.config) ?? {}
  const baseUsingComponents: Record<string, string> = (configObj.usingComponents && typeof configObj.usingComponents === 'object' && !Array.isArray(configObj.usingComponents))
    ? { ...configObj.usingComponents }
    : {}
  const usingComponents: Record<string, string> = { ...baseUsingComponents }

  for (const scopedSlot of scopedSlots) {
    const componentBase = `${relativeBase}.__scoped-slot-${scopedSlot.id}`
    const componentPath = `/${toPosixPath(componentBase)}`
    usingComponents[scopedSlot.componentName] = componentPath

    const wxmlFile = `${componentBase}.wxml`
    const jsonFile = `${componentBase}.json`
    const scopedUsingComponents = resolveScopedSlotAutoImports(
      compilerCtx,
      baseUsingComponents,
      componentBase,
      scopedSlot.template,
    )

    if (!bundle[wxmlFile]) {
      ctx.emitFile({ type: 'asset', fileName: wxmlFile, source: scopedSlot.template })
    }
    if (!bundle[jsonFile]) {
      const json = {
        component: true,
        usingComponents: scopedUsingComponents,
      }
      ctx.emitFile({ type: 'asset', fileName: jsonFile, source: JSON.stringify(json, null, 2) })
    }
  }

  configObj.usingComponents = usingComponents
  result.config = JSON.stringify(configObj, null, 2)
}

function resolveScopedSlotAutoImports(
  compilerCtx: Pick<CompilerContext, 'autoImportService' | 'wxmlService'> | undefined,
  baseUsingComponents: Record<string, string>,
  componentBase: string,
  template: string,
): Record<string, string> {
  const usingComponents: Record<string, string> = { ...baseUsingComponents }
  const autoImportService = compilerCtx?.autoImportService
  const wxmlService = compilerCtx?.wxmlService
  if (!autoImportService || !wxmlService) {
    return usingComponents
  }

  try {
    const token = wxmlService.analyze(template)
    const depComponentNames = Object.keys(token.components ?? {})
    for (const depComponentName of depComponentNames) {
      const match = autoImportService.resolve(depComponentName, componentBase)
      if (!match) {
        continue
      }
      const { value } = match
      if (Object.prototype.hasOwnProperty.call(usingComponents, value.name)) {
        continue
      }
      usingComponents[value.name] = value.from
    }
  }
  catch {
    // ignore - fallback to baseUsingComponents
  }

  return usingComponents
}

function emitScopedSlotChunks(
  ctx: { emitFile: (asset: { type: 'chunk', id: string, fileName: string }) => void },
  relativeBase: string,
  result: VueTransformResult,
  scopedSlotModules: Map<string, string>,
  emittedScopedSlotChunks: Set<string>,
) {
  const scopedSlots = result.scopedSlotComponents
  if (!scopedSlots?.length) {
    return
  }

  for (const scopedSlot of scopedSlots) {
    const componentBase = `${relativeBase}.__scoped-slot-${scopedSlot.id}`
    const jsFile = `${componentBase}.js`
    if (emittedScopedSlotChunks.has(jsFile)) {
      continue
    }

    const virtualId = getScopedSlotVirtualId(componentBase)
    if (!scopedSlotModules.has(virtualId)) {
      scopedSlotModules.set(virtualId, buildScopedSlotComponentModule())
    }

    ctx.emitFile({
      type: 'chunk',
      id: virtualId,
      fileName: jsFile,
      // @ts-ignore
      preserveSignature: 'exports-only',
    })
    emittedScopedSlotChunks.add(jsFile)
  }
}

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>()
  const pageMatcher = createPageEntryMatcher(ctx)
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()
  const styleBlocksCache = new Map<string, SFCStyleBlock[]>()
  const scopedSlotModules = new Map<string, string>()
  const emittedScopedSlotChunks = new Set<string>()

  function createCompileVueFileOptions(
    pluginCtx: any,
    vuePath: string,
    isPage: boolean,
    isApp: boolean,
    configService: NonNullable<CompilerContext['configService']>,
  ) {
    const scopedSlotsCompiler = configService.weappViteConfig?.vue?.template?.scopedSlotsCompiler ?? 'auto'
    const slotMultipleInstance = configService.weappViteConfig?.vue?.template?.slotMultipleInstance ?? true
    const jsonConfig = configService.weappViteConfig?.json
    const wevuDefaults = configService.weappViteConfig?.wevu?.defaults
    const jsonKind = isApp ? 'app' : isPage ? 'page' : 'component'
    return {
      isPage,
      isApp,
      autoUsingComponents: {
        enabled: true,
        warn: (message: string) => logger.warn(message),
        resolveUsingComponentPath: createUsingComponentPathResolver(pluginCtx, configService, reExportResolutionCache),
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
        scopedSlotsCompiler,
        slotMultipleInstance,
      },
      json: {
        kind: jsonKind,
        defaults: jsonConfig?.defaults,
        mergeStrategy: jsonConfig?.mergeStrategy,
      },
      wevuDefaults,
    } as const
  }

  return {
    name: `${VUE_PLUGIN_NAME}:transform`,

    buildStart() {
      scopedSlotModules.clear()
      emittedScopedSlotChunks.clear()
    },

    resolveId(id) {
      if (id.startsWith(SCOPED_SLOT_VIRTUAL_PREFIX)) {
        return id
      }
      return null
    },

    async load(id) {
      if (id.startsWith(SCOPED_SLOT_VIRTUAL_PREFIX)) {
        const code = scopedSlotModules.get(id)
        if (!code) {
          return null
        }
        return { code, map: null }
      }

      const parsed = parseWeappVueStyleRequest(id)
      if (!parsed) {
        return null
      }

      const { filename, index } = parsed
      let styles = styleBlocksCache.get(filename)
      if (!styles) {
        try {
          const parsedSfc = await readAndParseSfc(filename, { checkMtime: getSfcCheckMtime(ctx.configService) })
          styles = parsedSfc.descriptor.styles
          styleBlocksCache.set(filename, styles)
        }
        catch {
          return null
        }
      }

      const block = styles[index]
      if (!block) {
        return null
      }

      return {
        code: block.content,
        map: null,
      }
    },

    async transform(code, id) {
      // 只处理 .vue 文件
      if (!id.endsWith('.vue')) {
        return null
      }

      const configService = ctx.configService
      if (!configService) {
        return null
      }

      // 说明：id 可能是虚拟模块 ID（\0vue:...）或实际文件路径
      // 使用 getSourceFromVirtualId 统一处理
      const sourceId = getSourceFromVirtualId(id)

      // 将相对路径转换为绝对路径
      const filename = toAbsoluteId(sourceId, configService, undefined, { base: 'cwd' })
      if (!filename || !path.isAbsolute(filename)) {
        return null
      }

      // 重要：当 .vue 以虚拟模块（\0vue:...）形式参与构建时，rollup/rolldown 不一定会自动监听真实文件路径
      // 因此这里显式加入 watchFile，确保修改 .vue 能触发 weapp-vite dev 的增量构建。
      if (typeof (this as any).addWatchFile === 'function') {
        ;(this as any).addWatchFile(filename)
      }

      try {
        // 读取源文件（如果 code 没有被提供）
        const source = typeof code === 'string'
          ? code
          : configService.isDev
            ? await readFileCached(filename, { checkMtime: true, encoding: 'utf8' })
            : await fs.readFile(filename, 'utf-8')

        // 缓存 style blocks，供 `?weapp-vite-vue&type=style` 的 load 阶段使用
        try {
          const parsedSfc = await readAndParseSfc(filename, { source, checkMtime: false })
          styleBlocksCache.set(filename, parsedSfc.descriptor.styles)
        }
        catch {
          // ignore - parse errors will be surfaced by compileVueFile later
        }

        if (ctx.runtimeState.scan.isDirty) {
          pageMatcher.markDirty()
        }
        const isPage = await pageMatcher.isPageFile(filename)
        const isApp = /[\\/]app\.vue$/.test(filename)
        // 编译 Vue 文件
        const result = await compileVueFile(source, filename, createCompileVueFileOptions(this, filename, isPage, isApp, configService))

        if (isPage && result.script) {
          const injected = await injectWevuPageFeaturesInJsWithViteResolver(this, result.script, filename, {
            checkMtime: configService.isDev,
          })
          if (injected.transformed) {
            result.script = injected.code
          }
        }
        compilationCache.set(filename, { result, source, isPage })

        const relativeBase = configService.relativeOutputPath(filename.slice(0, -4))
        if (relativeBase) {
          emitScopedSlotChunks(this, relativeBase, result, scopedSlotModules, emittedScopedSlotChunks)
        }

        let returnedCode = result.script ?? ''
        const styleBlocks = styleBlocksCache.get(filename)
        if (styleBlocks?.length) {
          const styleImports = styleBlocks
            .map((styleBlock, index) => {
              const request = buildWeappVueStyleRequest(filename, styleBlock, index)
              return `import ${JSON.stringify(request)};\n`
            })
            .join('')
          returnedCode = styleImports + returnedCode
        }

        const macroHash = result.meta?.jsonMacroHash
        if (macroHash && configService.isDev) {
          returnedCode += `\n;Object.defineProperty({}, '__weappViteJsonMacroHash', { value: ${JSON.stringify(macroHash)} })\n`
        }
        const defineOptionsHash = result.meta?.defineOptionsHash
        if (defineOptionsHash && configService.isDev) {
          returnedCode += `\n;Object.defineProperty({}, '__weappViteDefineOptionsHash', { value: ${JSON.stringify(defineOptionsHash)} })\n`
        }

        // 返回编译后的脚本
        return {
          code: returnedCode,
          map: null,
        }
      }
      catch (error) {
        // 记录编译错误
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`[Vue transform] Error transforming ${filename}: ${message}`)
        throw error
      }
    },

    // 在 generateBundle 中发出模板、样式和配置文件
    async generateBundle(_options, bundle) {
      const { configService, scanService } = ctx
      if (!configService || !scanService) {
        return
      }

      // 首先处理缓存中已有的编译结果
      for (const [filename, cached] of compilationCache.entries()) {
        if (typeof (this as any).addWatchFile === 'function') {
          ;(this as any).addWatchFile(filename)
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
                createCompileVueFileOptions(this, filename, cached.isPage, isApp, configService),
              )

              if (cached.isPage && compiled.script) {
                const injected = await injectWevuPageFeaturesInJsWithViteResolver(this, compiled.script, filename, {
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
            // ignore - fallback to cached compilation result
          }
        }

        // 计算输出文件名（去掉 .vue 扩展名）
        const baseName = filename.slice(0, -4)
        const relativeBase = configService.relativeOutputPath(baseName)
        if (!relativeBase) {
          continue
        }

        const isAppVue = /[\\/]app\.vue$/.test(filename)
        const shouldEmitComponentJson = !isAppVue
        const shouldMergeJsonAsset = isAppVue
        const jsonConfig = configService.weappViteConfig?.json
        const jsonKind = isAppVue ? 'app' : cached.isPage ? 'page' : 'component'

        // 发出 .wxml 文件
        if (result.template) {
          emitSfcTemplateIfMissing(this, bundle, relativeBase, result.template)
        }

        emitScopedSlotAssets(this, bundle, relativeBase, result, ctx)

        // 发出 .json 文件（页面/组件配置）
        if (result.config || shouldEmitComponentJson) {
          emitSfcJsonAsset(this, bundle, relativeBase, result, {
            defaultConfig: shouldEmitComponentJson ? { component: true } : undefined,
            mergeExistingAsset: shouldMergeJsonAsset,
            mergeStrategy: jsonConfig?.mergeStrategy,
            defaults: jsonConfig?.defaults?.[jsonKind],
            kind: jsonKind,
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

        if (typeof (this as any).addWatchFile === 'function') {
          ;(this as any).addWatchFile(vuePath)
        }

        if (!(await pathExistsCached(vuePath, { ttlMs: getPathExistsTtlMs(configService) }))) {
          continue
        }

        try {
          const source = await fs.readFile(vuePath, 'utf-8')
          const result = await compileVueFile(source, vuePath, createCompileVueFileOptions(this, vuePath, true, false, configService))

          if (result.script) {
            const injected = await injectWevuPageFeaturesInJsWithViteResolver(this, result.script, vuePath, {
              checkMtime: configService.isDev,
            })
            if (injected.transformed) {
              result.script = injected.code
            }
          }

          // 注意：后备产物仅用于补齐未被 Vite 引用时缺失的 template/style/json。
          // JS 入口必须交给 bundler（chunk）统一产出；否则直接写入脚本内容会绕过 output.format，导致 dist 出现 ESM 产物甚至覆盖 CJS chunk。

          if (result.template) {
            emitSfcTemplateIfMissing(this, bundle, relativeBase, result.template)
          }

          emitScopedSlotAssets(this, bundle, relativeBase, result, ctx)

          // 说明：fallback 产物不在 Vite 模块图中，无法走 Vite CSS pipeline（sass/postcss）。
          // 这里仍然兜底发出 .wxss，避免生产构建缺失样式文件。
          if (result.style) {
            emitSfcStyleIfMissing(this, bundle, relativeBase, result.style)
          }

          const jsonConfig = configService.weappViteConfig?.json
          emitSfcJsonAsset(this, bundle, relativeBase, result, {
            defaultConfig: { component: true },
            mergeExistingAsset: true,
            mergeStrategy: jsonConfig?.mergeStrategy,
            defaults: jsonConfig?.defaults?.component,
            kind: 'component',
          })
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logger.error(`[Vue transform] Error compiling ${vuePath}: ${message}`)
        }
      }
    },

    watchChange(id) {
      const normalizedId = normalizeFsResolvedId(id)
      if (!normalizedId.endsWith('.vue')) {
        return
      }
      if (!fs.existsSync(normalizedId)) {
        compilationCache.delete(normalizedId)
      }
      else {
        const cached = compilationCache.get(normalizedId)
        if (cached) {
          cached.source = undefined
        }
      }
      styleBlocksCache.delete(normalizedId)
    },

    // 处理模板和样式作为额外文件
    async handleHotUpdate({ file }) {
      if (!file.endsWith('.vue')) {
        return
      }

      // 清除缓存
      if (!fs.existsSync(file)) {
        compilationCache.delete(file)
      }
      else {
        const cached = compilationCache.get(file)
        if (cached) {
          cached.source = undefined
        }
      }
      styleBlocksCache.delete(file)

      return []
    },
  }
}
