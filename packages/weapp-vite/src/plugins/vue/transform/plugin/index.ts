import type { Plugin } from 'vite'
import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { CompilerContext } from '../../../../context'
import type { VueTransformResult } from '../compileVueFile'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../../../logger'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { toAbsoluteId } from '../../../../utils/toAbsoluteId'
import { readFile as readFileCached } from '../../../utils/cache'
import { getSfcCheckMtime, readAndParseSfc } from '../../../utils/vueSfc'
import { createPageEntryMatcher } from '../../../wevu/pageFeatures'
import { VUE_PLUGIN_NAME } from '../../index'
import { getSourceFromVirtualId } from '../../resolver'
import { compileVueFile } from '../compileVueFile'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../vitePlugin/injectPageFeatures'
import { emitVueBundleAssets } from './bundle'
import { createCompileVueFileOptions } from './compileOptions'
import { emitScopedSlotChunks, loadScopedSlotModule, resolveScopedSlotVirtualId } from './scopedSlot'
import { buildWeappVueStyleRequest, parseWeappVueStyleRequest } from './styleRequest'

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>()
  const pageMatcher = createPageEntryMatcher(ctx)
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()
  const styleBlocksCache = new Map<string, SFCStyleBlock[]>()
  const scopedSlotModules = new Map<string, string>()
  const emittedScopedSlotChunks = new Set<string>()
  const classStyleRuntimeWarned = { value: false }

  return {
    name: `${VUE_PLUGIN_NAME}:transform`,

    buildStart() {
      scopedSlotModules.clear()
      emittedScopedSlotChunks.clear()
    },

    resolveId(id) {
      return resolveScopedSlotVirtualId(id)
    },

    async load(id) {
      const scopedSlot = loadScopedSlotModule(id, scopedSlotModules)
      if (scopedSlot) {
        return scopedSlot
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
        const result = await compileVueFile(
          source,
          filename,
          createCompileVueFileOptions(ctx, this, filename, isPage, isApp, configService, {
            reExportResolutionCache,
            classStyleRuntimeWarned,
          }),
        )

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
      await emitVueBundleAssets(bundle as Record<string, any>, {
        ctx,
        pluginCtx: this,
        compilationCache,
        reExportResolutionCache,
        classStyleRuntimeWarned,
      })
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
