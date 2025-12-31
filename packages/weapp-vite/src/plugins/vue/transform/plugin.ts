import type { File as BabelFile } from '@babel/types'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../../context'
import type { AutoUsingComponentsOptions, VueTransformResult } from './compileVueFile'
import { fileURLToPath } from 'node:url'
import { parse as babelParse } from '@babel/parser'
import * as t from '@babel/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../../logger'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../../../utils/babel'
import { createPageEntryMatcher, injectWevuPageFeaturesInJsWithResolver } from '../../wevu/pageFeatures'
import { VUE_PLUGIN_NAME } from '../index'
import { getSourceFromVirtualId } from '../resolver'
import { compileVueFile } from './compileVueFile'

function normalizeResolvedFilePath(id: string) {
  const clean = getSourceFromVirtualId(id).split('?', 1)[0]
  if (clean.startsWith('file://')) {
    try {
      return fileURLToPath(clean)
    }
    catch {
      return clean
    }
  }
  if (clean.startsWith('/@fs/')) {
    return clean.slice('/@fs'.length)
  }
  return clean
}

async function collectVuePages(root: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(root)
    for (const entry of entries) {
      const full = path.join(root, entry)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        const nested = await collectVuePages(full)
        results.push(...nested)
      }
      else if (full.endsWith('.vue')) {
        results.push(full)
      }
    }
  }
  catch {
    // 忽略不存在的目录
  }
  return results
}

async function resolveUsingComponentPath(
  ctx: {
    resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
  },
  configService: CompilerContext['configService'],
  reExportResolutionCache: Map<string, Map<string, string | undefined>>,
  importSource: string,
  importerFilename: string,
  info: Parameters<NonNullable<AutoUsingComponentsOptions['resolveUsingComponentPath']>>[2],
) {
  const resolved = await ctx.resolve(importSource, importerFilename)
  if (!resolved?.id) {
    return undefined
  }
  let clean = normalizeResolvedFilePath(resolved.id)
  if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
    return undefined
  }

  try {
    if (await fs.pathExists(clean)) {
      const stat = await fs.stat(clean)
      if (stat.isDirectory()) {
        for (const ext of ['ts', 'js', 'mjs', 'cjs']) {
          const indexPath = path.join(clean, `index.${ext}`)
          if (await fs.pathExists(indexPath)) {
            clean = indexPath
            break
          }
        }
      }
    }
  }
  catch {
    // ignore stat/exists failures
  }

  if (info?.kind === 'named' && info.importedName && /\.(?:[cm]?ts|[cm]?js)$/.test(clean)) {
    const cacheKey = clean
    const exportName = info.importedName
    let entry = reExportResolutionCache.get(cacheKey)
    if (!entry) {
      entry = new Map()
      reExportResolutionCache.set(cacheKey, entry)
    }

    if (!entry.has(exportName)) {
      const visited = new Set<string>()
      const resolveExported = async (exporterFile: string, depth: number): Promise<string | undefined> => {
        if (depth <= 0) {
          return undefined
        }
        if (visited.has(exporterFile)) {
          return undefined
        }
        visited.add(exporterFile)
        let code: string
        try {
          code = await fs.readFile(exporterFile, 'utf8')
        }
        catch {
          return undefined
        }

        let ast: BabelFile
        try {
          ast = babelParse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
        }
        catch {
          return undefined
        }

        const exportAllSources: string[] = []
        for (const node of ast.program.body) {
          if (t.isExportNamedDeclaration(node) && node.source && t.isStringLiteral(node.source)) {
            for (const spec of node.specifiers) {
              if (!t.isExportSpecifier(spec)) {
                continue
              }
              const exportedName = t.isIdentifier(spec.exported)
                ? spec.exported.name
                : t.isStringLiteral(spec.exported)
                  ? spec.exported.value
                  : undefined
              if (exportedName !== exportName) {
                continue
              }
              const hop = await ctx.resolve(node.source.value, exporterFile)
              if (!hop?.id) {
                return undefined
              }
              return normalizeResolvedFilePath(hop.id)
            }
          }
          if (t.isExportAllDeclaration(node) && node.source && t.isStringLiteral(node.source)) {
            exportAllSources.push(node.source.value)
          }
        }

        for (const source of exportAllSources) {
          const hop = await ctx.resolve(source, exporterFile)
          if (!hop?.id) {
            continue
          }
          const hopPath = normalizeResolvedFilePath(hop.id)
          if (!hopPath || hopPath.startsWith('\0') || hopPath.startsWith('node:')) {
            continue
          }
          const nested = await resolveExported(hopPath, depth - 1)
          if (nested) {
            return nested
          }
        }

        return undefined
      }

      entry.set(exportName, await resolveExported(clean, 4))
    }

    const mapped = entry.get(exportName)
    if (mapped) {
      clean = mapped
    }
  }

  const baseName = removeExtensionDeep(clean)
  const relativeBase = configService.relativeOutputPath(baseName)
  if (!relativeBase) {
    return undefined
  }
  return `/${relativeBase}`
}

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
            resolveUsingComponentPath: async (importSource, importerFilename, info) => {
              return resolveUsingComponentPath(this, configService, reExportResolutionCache, importSource, importerFilename, info)
            },
          },
        })

        if (isPage && result.script) {
          const injected = await injectWevuPageFeaturesInJsWithResolver(result.script, {
            id: filename,
            resolver: {
              resolveId: async (source, importer) => {
                const resolved = await this.resolve(source, importer)
                return resolved ? resolved.id : undefined
              },
              loadCode: async (resolvedId) => {
                const clean = getSourceFromVirtualId(resolvedId).split('?', 1)[0]
                if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
                  return undefined
                }
                try {
                  if (await fs.pathExists(clean)) {
                    return await fs.readFile(clean, 'utf8')
                  }
                  return undefined
                }
                catch {
                  return undefined
                }
              },
            },
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
          const wxmlFileName = `${relativeBase}.wxml`
          // 避免重复发出
          if (!bundle[wxmlFileName]) {
            this.emitFile({
              type: 'asset',
              fileName: wxmlFileName,
              source: result.template,
            })
          }
        }

        // 发出 .wxss 文件
        if (result.style) {
          const wxssFileName = `${relativeBase}.wxss`
          if (!bundle[wxssFileName]) {
            this.emitFile({
              type: 'asset',
              fileName: wxssFileName,
              source: result.style,
            })
          }
        }

        // 发出 .json 文件（页面/组件配置）
        if (result.config || shouldEmitComponentJson) {
          const jsonFileName = `${relativeBase}.json`
          const existing = bundle[jsonFileName]

          const defaultConfig = shouldEmitComponentJson ? { component: true } : undefined
          let nextConfig: Record<string, any> | undefined

          if (result.config) {
            try {
              nextConfig = JSON.parse(result.config)
            }
            catch {
              nextConfig = undefined
            }
          }

          if (defaultConfig) {
            nextConfig = { ...defaultConfig, ...(nextConfig ?? {}) }
            nextConfig.component = true
          }

          // 若 result.config 解析失败但仍有 defaultConfig，则发出默认配置。
          if (!nextConfig && defaultConfig) {
            nextConfig = defaultConfig
          }

          // 若仍没有可用配置（无效 JSON + 无默认值），则跳过。
          if (!nextConfig) {
            continue
          }

          // 注意：这里需要与已有的 page.json 合并（如果存在）
          if (existing && existing.type === 'asset') {
            try {
              const existingConfig = JSON.parse(existing.source.toString())
              const merged = { ...existingConfig, ...nextConfig }
              this.emitFile({
                type: 'asset',
                fileName: jsonFileName,
                source: JSON.stringify(merged, null, 2),
              })
            }
            catch {
              this.emitFile({
                type: 'asset',
                fileName: jsonFileName,
                source: JSON.stringify(nextConfig, null, 2),
              })
            }
          }
          else if (!bundle[jsonFileName]) {
            this.emitFile({
              type: 'asset',
              fileName: jsonFileName,
              source: JSON.stringify(nextConfig, null, 2),
            })
          }
        }
      }

      // 后备处理：对未被 Vite 引用的页面 .vue 进行编译并发出产物
      let pageList: string[] = []
      if (scanService?.appEntry?.json?.pages?.length) {
        pageList = scanService.appEntry.json.pages
      }
      else {
        const appJsonPath = path.join(configService.cwd, 'dist', 'app.json')
        try {
          const appJsonContent = await fs.readFile(appJsonPath, 'utf-8')
          const appJson = JSON.parse(appJsonContent)
          pageList = appJson.pages || []
        }
        catch {
          // 忽略
        }
      }

      const collectedEntries = new Set<string>()
      pageList.forEach(p => collectedEntries.add(path.join(configService.absoluteSrcRoot, p)))

      const extraVueFiles = await collectVuePages(path.join(configService.absoluteSrcRoot, 'pages'))
      extraVueFiles.forEach(f => collectedEntries.add(f.slice(0, -4)))

      for (const entryId of collectedEntries) {
        const relativeBase = configService.relativeOutputPath(entryId)
        if (!relativeBase) {
          continue
        }
        const jsFileName = `${relativeBase}.js`
        const vuePath = `${entryId}.vue`

        // 说明：compilationCache 使用完整的 .vue 路径作为 key，这里需要保持一致避免重复编译覆盖已生成的 chunk
        if (compilationCache.has(vuePath)) {
          continue
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
              resolveUsingComponentPath: async (importSource, importerFilename, info) => {
                return resolveUsingComponentPath(this, configService, reExportResolutionCache, importSource, importerFilename, info)
              },
            },
          })

          if (result.script) {
            const injected = await injectWevuPageFeaturesInJsWithResolver(result.script, {
              id: vuePath,
              resolver: {
                resolveId: async (source, importer) => {
                  const resolved = await this.resolve(source, importer)
                  return resolved ? resolved.id : undefined
                },
                loadCode: async (resolvedId) => {
                  const clean = getSourceFromVirtualId(resolvedId).split('?', 1)[0]
                  if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
                    return undefined
                  }
                  try {
                    if (await fs.pathExists(clean)) {
                      return await fs.readFile(clean, 'utf8')
                    }
                    return undefined
                  }
                  catch {
                    return undefined
                  }
                },
              },
            })
            if (injected.transformed) {
              result.script = injected.code
            }
          }

          if (result.script !== undefined) {
            if (bundle[jsFileName]) {
              delete bundle[jsFileName]
            }
            this.emitFile({
              type: 'asset',
              fileName: jsFileName,
              source: result.script,
            })
          }

          if (result.template && !bundle[`${relativeBase}.wxml`]) {
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.wxml`,
              source: result.template,
            })
          }

          if (result.style && !bundle[`${relativeBase}.wxss`]) {
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.wxss`,
              source: result.style,
            })
          }

          if (!bundle[`${relativeBase}.json`]) {
            let nextConfig: Record<string, any> | undefined
            if (result.config) {
              try {
                nextConfig = JSON.parse(result.config)
              }
              catch {
                nextConfig = undefined
              }
            }
            nextConfig = { component: true, ...(nextConfig ?? {}) }
            nextConfig.component = true
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.json`,
              source: JSON.stringify(nextConfig, null, 2),
            })
          }
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
