import type { Plugin } from 'vite'
import type { CompilerContext } from '../../../context'
import type { VueTransformResult } from './compileVueFile'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../../logger'
import { createPageEntryMatcher } from '../../wevu/pageFeatures'
import { VUE_PLUGIN_NAME } from '../index'
import { getSourceFromVirtualId } from '../resolver'
import { compileVueFile } from './compileVueFile'
import { emitSfcJsonAsset, emitSfcScriptAssetReplacingBundleEntry, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from './vitePlugin/emitAssets'
import { collectFallbackPageEntryIds } from './vitePlugin/fallbackEntries'
import { injectWevuPageFeaturesInJsWithViteResolver } from './vitePlugin/injectPageFeatures'
import { createUsingComponentPathResolver } from './vitePlugin/usingComponentResolver'

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, VueTransformResult>()
  const pageMatcher = createPageEntryMatcher(ctx)
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()

  return {
    name: `${VUE_PLUGIN_NAME}:transform`,

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
      const filename = path.isAbsolute(sourceId)
        ? sourceId
        : path.resolve(configService.cwd, sourceId)

      // 重要：当 .vue 以虚拟模块（\0vue:...）形式参与构建时，rollup/rolldown 不一定会自动监听真实文件路径
      // 因此这里显式加入 watchFile，确保修改 .vue 能触发 weapp-vite dev 的增量构建。
      if (typeof (this as any).addWatchFile === 'function') {
        ;(this as any).addWatchFile(filename)
      }

      try {
        // 读取源文件（如果 code 没有被提供）
        const source = code || await fs.readFile(filename, 'utf-8')

        if (ctx.runtimeState.scan.isDirty) {
          pageMatcher.markDirty()
        }
        const isPage = await pageMatcher.isPageFile(filename)
        // 编译 Vue 文件
        const result = await compileVueFile(source, filename, {
          isPage,
          autoUsingComponents: {
            enabled: true,
            warn: message => logger.warn(message),
            resolveUsingComponentPath: createUsingComponentPathResolver(this, configService, reExportResolutionCache),
          },
        })

        if (isPage && result.script) {
          const injected = await injectWevuPageFeaturesInJsWithViteResolver(this, result.script, filename, {
            checkMtime: configService.isDev,
          })
          if (injected.transformed) {
            result.script = injected.code
          }
        }
        compilationCache.set(filename, result)

        // 返回编译后的脚本
        return {
          code: result.script ?? '',
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
      for (const [filename, result] of compilationCache.entries()) {
        if (typeof (this as any).addWatchFile === 'function') {
          ;(this as any).addWatchFile(filename)
        }

        // 计算输出文件名（去掉 .vue 扩展名）
        const baseName = filename.slice(0, -4)
        const relativeBase = configService.relativeOutputPath(baseName)
        if (!relativeBase) {
          continue
        }

        const isAppVue = /[\\/]app\.vue$/.test(filename)
        const shouldEmitComponentJson = !isAppVue

        // 发出 .wxml 文件
        if (result.template) {
          emitSfcTemplateIfMissing(this, bundle, relativeBase, result.template)
        }

        // 发出 .wxss 文件
        if (result.style) {
          emitSfcStyleIfMissing(this, bundle, relativeBase, result.style)
        }

        // 发出 .json 文件（页面/组件配置）
        if (result.config || shouldEmitComponentJson) {
          emitSfcJsonAsset(this, bundle, relativeBase, result, {
            defaultConfig: shouldEmitComponentJson ? { component: true } : undefined,
            mergeExistingAsset: true,
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

        if (!(await fs.pathExists(vuePath))) {
          continue
        }

        try {
          const source = await fs.readFile(vuePath, 'utf-8')
          const result = await compileVueFile(source, vuePath, {
            isPage: true,
            autoUsingComponents: {
              enabled: true,
              warn: message => logger.warn(message),
              resolveUsingComponentPath: createUsingComponentPathResolver(this, configService, reExportResolutionCache),
            },
          })

          if (result.script) {
            const injected = await injectWevuPageFeaturesInJsWithViteResolver(this, result.script, vuePath, {
              checkMtime: configService.isDev,
            })
            if (injected.transformed) {
              result.script = injected.code
            }
          }

          if (result.script !== undefined) {
            emitSfcScriptAssetReplacingBundleEntry(this, bundle, relativeBase, result.script)
          }

          if (result.template) {
            emitSfcTemplateIfMissing(this, bundle, relativeBase, result.template)
          }

          if (result.style) {
            emitSfcStyleIfMissing(this, bundle, relativeBase, result.style)
          }

          emitSfcJsonAsset(this, bundle, relativeBase, result, {
            defaultConfig: { component: true },
            emitIfMissingOnly: true,
          })
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logger.error(`[Vue transform] Error compiling ${vuePath}: ${message}`)
        }
      }
    },

    // 处理模板和样式作为额外文件
    async handleHotUpdate({ file }) {
      if (!file.endsWith('.vue')) {
        return
      }

      // 清除缓存
      compilationCache.delete(file)

      return []
    },
  }
}
