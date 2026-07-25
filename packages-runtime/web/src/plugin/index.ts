import type { SourceMap } from 'magic-string'
import type { ResolveWebModuleId, WeappWebPluginOptions } from './types'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { extname, resolve } from 'pathe'
import { compileWxml } from '../compiler/wxml'
import { transformWxsToEsm } from '../compiler/wxs'
import { transformWxssToCss } from '../css/wxss'
import { AUTO_ROUTES_ID, ENTRY_ID, RESOLVED_AUTO_ROUTES_ID, SCRIPT_EXTS, SFC_STYLE_QUERY, SFC_TEMPLATE_QUERY, STYLE_EXTS, STYLE_QUERY, TEMPLATE_EXTS, TEMPLATE_QUERY, TRANSFORM_STYLE_EXTS, WXS_EXTS } from './constants'
import { generateAutoRoutesModule, generateEntryModule } from './entry'
import { wrapPageTemplate } from './layout'
import { cleanUrl, isHtmlEntry, isInsideDir, normalizePath, resolveRuntimePolyfillPath, resolveTemplatePathSync, resolveWxsPathSync, toRelativeImport, toViteFsImport } from './path'
import { transformScriptModule } from './register'
import { scanProject } from './scan'
import { createEmptyScanState } from './state'
import { createInlineStyleModule } from './styleModule'
import { ensureWebVueSfcResult, generateWebVueSfcStyle, generateWebVueSfcTemplate, transformWebVueSfcScript } from './vueSfc'

interface WebPluginContext {
  warn?: (message: string) => void
  addWatchFile?: (id: string) => void
  resolve?: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null>
}

type WebTransformResult = { code: string, map: SourceMap | null } | null

interface WebResolvedConfig {
  root: string
  command: string
  createResolver?: () => ResolveWebModuleId
}

interface WebHmrContext {
  file: string
}

interface WeappWebVitePlugin {
  name: string
  enforce?: 'pre' | 'post'
  configResolved?: (this: WebPluginContext, config: WebResolvedConfig) => void | Promise<void>
  buildStart?: (this: WebPluginContext) => void | Promise<void>
  resolveId?: (id: string) => string | null | Promise<string | null>
  load?: (id: string) => string | null | Promise<string | null>
  handleHotUpdate?: (this: WebPluginContext, ctx: WebHmrContext) => void | Promise<void>
  transform?: (
    this: WebPluginContext,
    code: string,
    id: string,
  ) => WebTransformResult | Promise<WebTransformResult>
}

function isTemplateFile(id: string) {
  const lower = id.toLowerCase()
  return TEMPLATE_EXTS.some(ext => lower.endsWith(ext))
}

function isWxsFile(id: string) {
  const lower = id.toLowerCase()
  return WXS_EXTS.some(ext => lower.endsWith(ext))
}

function hasWxsQuery(id: string) {
  return id.includes('?wxs') || id.includes('&wxs')
}

function hasQuery(id: string, query: string) {
  return id.includes(`?${query}`) || id.includes(`&${query}`)
}

export function weappWebPlugin(options: WeappWebPluginOptions = {}): WeappWebVitePlugin {
  let root = process.cwd()
  let srcRoot = resolve(root, options.srcDir ?? 'src')
  let enableHmr = false
  let resolveWebModuleId: ResolveWebModuleId | undefined

  const state = createEmptyScanState()
  const wxssOptions = options.wxss
  const runtimeProvider = options.__runtimeProvider
  const hmrAcceptCode = runtimeProvider
    ? runtimeProvider.hmrAcceptCode
    : 'if (import.meta.hot) { import.meta.hot.accept() }'

  const resolveTemplatePath = (raw: string, importer: string) => resolveTemplatePathSync(raw, importer, srcRoot)
  const resolveWxsPath = (raw: string, importer: string) => resolveWxsPathSync(raw, importer, srcRoot)
  const resolveMetaByTemplate = (filename: string) => {
    const normalized = normalizePath(filename)
    for (const meta of state.moduleMeta.values()) {
      if (meta.templatePath && normalizePath(meta.templatePath) === normalized) {
        return meta
      }
    }
    return undefined
  }

  return {
    name: '@weapp-vite/web',
    enforce: 'pre',
    async configResolved(this: WebPluginContext, config: WebResolvedConfig) {
      root = config.root
      srcRoot = resolve(root, options.srcDir ?? 'src')
      enableHmr = config.command === 'serve'
      resolveWebModuleId = config.createResolver?.()
      await scanProject({ srcRoot, warn: this.warn?.bind(this), state, resolveId: resolveWebModuleId })
    },
    async buildStart(this: WebPluginContext) {
      if (!resolveWebModuleId && this.resolve) {
        resolveWebModuleId = async (source, importer) => {
          const resolved = await this.resolve?.(source, importer, { skipSelf: true })
          return resolved?.id
        }
      }
      await scanProject({ srcRoot, warn: this.warn?.bind(this), state, resolveId: resolveWebModuleId })
    },
    resolveId(id: string) {
      if (id === '/@weapp-vite/web/entry' || id === '@weapp-vite/web/entry') {
        return ENTRY_ID
      }
      if (id === AUTO_ROUTES_ID) {
        return RESOLVED_AUTO_ROUTES_ID
      }
      return null
    },
    async load(this: WebPluginContext, id: string) {
      if (id === ENTRY_ID) {
        return generateEntryModule(state.scanResult, root, wxssOptions, options)
      }
      if (id === RESOLVED_AUTO_ROUTES_ID) {
        return generateAutoRoutesModule(state.scanResult)
      }
      if (hasQuery(id, TEMPLATE_QUERY)) {
        const filename = cleanUrl(id)
        let source = await readFile(filename, 'utf8')
        const pageMeta = resolveMetaByTemplate(filename)
        if (pageMeta?.kind === 'page' && state.scanResult.layouts.length) {
          source = wrapPageTemplate(source, state.scanResult.layouts)
        }
        const navigationConfig = state.pageNavigationMap.get(normalizePath(filename))
        const componentTags = state.templateComponentMap.get(normalizePath(filename))
        const compiled = compileWxml({
          id: filename,
          source,
          resolveTemplatePath,
          resolveWxsPath,
          navigationBar: navigationConfig ? { config: navigationConfig } : undefined,
          componentTags,
        })
        for (const dependency of compiled.dependencies) {
          this.addWatchFile?.(dependency)
        }
        for (const warning of compiled.warnings ?? []) {
          this.warn?.(warning)
        }
        return compiled.code
      }
      if (hasWxsQuery(id)) {
        const filename = cleanUrl(id)
        const source = await readFile(filename, 'utf8')
        const compiled = transformWxsToEsm(source, filename, {
          resolvePath: resolveWxsPath,
          toImportPath: (resolved, importer) => normalizePath(toRelativeImport(importer, resolved)),
        })
        for (const dependency of compiled.dependencies) {
          this.addWatchFile?.(dependency)
        }
        for (const warning of compiled.warnings ?? []) {
          this.warn?.(warning)
        }
        return compiled.code
      }
      if (hasQuery(id, STYLE_QUERY)) {
        const source = await readFile(cleanUrl(id), 'utf8')
        const { css } = transformWxssToCss(source, wxssOptions)
        return createInlineStyleModule(css)
      }
      if (id.includes(`?${SFC_TEMPLATE_QUERY}`) || id.includes(`&${SFC_TEMPLATE_QUERY}`)) {
        const filename = cleanUrl(id)
        const meta = state.moduleMeta.get(normalizePath(filename))
        if (!meta) {
          return null
        }
        const result = await ensureWebVueSfcResult({ filename, meta, srcRoot, state, resolveId: resolveWebModuleId })
        const compiled = generateWebVueSfcTemplate(result, meta, filename, srcRoot)
        for (const dependency of compiled.dependencies) {
          this.addWatchFile?.(dependency)
        }
        for (const warning of compiled.warnings ?? []) {
          this.warn?.(warning)
        }
        return compiled.code
      }
      if (id.includes(`?${SFC_STYLE_QUERY}`) || id.includes(`&${SFC_STYLE_QUERY}`)) {
        const filename = cleanUrl(id)
        const meta = state.moduleMeta.get(normalizePath(filename))
        if (!meta) {
          return null
        }
        const result = await ensureWebVueSfcResult({ filename, meta, srcRoot, state, resolveId: resolveWebModuleId })
        return generateWebVueSfcStyle(result)
      }
      return null
    },
    async handleHotUpdate(this: WebPluginContext, ctx: WebHmrContext) {
      const clean = cleanUrl(ctx.file)
      if (clean.endsWith('.json') || isTemplateFile(clean) || isWxsFile(clean) || clean.endsWith('.wxss') || SCRIPT_EXTS.includes(extname(clean))) {
        await scanProject({ srcRoot, warn: this.warn?.bind(this), state, resolveId: resolveWebModuleId })
      }
    },
    async transform(this: WebPluginContext, code: string, id: string) {
      const clean = cleanUrl(id)

      if (
        hasQuery(id, TEMPLATE_QUERY)
        || hasWxsQuery(id)
        || hasQuery(id, STYLE_QUERY)
        || hasQuery(id, SFC_TEMPLATE_QUERY)
        || hasQuery(id, SFC_STYLE_QUERY)
      ) {
        return null
      }

      if (clean.endsWith('.vue')) {
        const meta = state.moduleMeta.get(normalizePath(clean))
        if (!meta) {
          return null
        }
        const result = await ensureWebVueSfcResult({
          filename: clean,
          meta,
          srcRoot,
          state,
          source: code,
          resolveId: resolveWebModuleId,
        })
        return transformWebVueSfcScript({
          code: result.script ?? '',
          filename: clean,
          meta,
          runtimeModuleId: runtimeProvider?.moduleId ?? toViteFsImport(resolveRuntimePolyfillPath()),
          enableHmr,
          hmrAcceptCode,
        })
      }

      if (isTemplateFile(clean)) {
        if (isHtmlEntry(clean, root)) {
          return null
        }
        const normalizedId = normalizePath(clean)
        if (state.templatePathSet.size > 0) {
          if (!isInsideDir(clean, srcRoot)) {
            return null
          }
          if (!state.templatePathSet.has(normalizedId)) {
            return null
          }
        }
        let templateSource = code
        const pageMeta = resolveMetaByTemplate(clean)
        if (pageMeta?.kind === 'page' && state.scanResult.layouts.length) {
          templateSource = wrapPageTemplate(code, state.scanResult.layouts)
        }
        const navigationConfig = state.pageNavigationMap.get(normalizedId)
        const componentTags = state.templateComponentMap.get(normalizedId)
        const { code: compiled, dependencies, warnings } = compileWxml({
          id: clean,
          source: templateSource,
          resolveTemplatePath,
          resolveWxsPath,
          navigationBar: navigationConfig ? { config: navigationConfig } : undefined,
          componentTags,
        })
        const addWatchFile = this.addWatchFile
        if (dependencies.length > 0 && addWatchFile) {
          for (const dep of dependencies) {
            addWatchFile.call(this, dep)
          }
        }
        const warn = this.warn
        if (warnings?.length && warn) {
          for (const warning of warnings) {
            warn.call(this, warning)
          }
        }
        return { code: compiled, map: null }
      }

      if (isWxsFile(clean) || hasWxsQuery(id)) {
        const { code: compiled, dependencies, warnings } = transformWxsToEsm(code, clean, {
          resolvePath: resolveWxsPath,
          toImportPath: (resolved, importer) => normalizePath(toRelativeImport(importer, resolved)),
        })
        const addWatchFile = this.addWatchFile
        if (dependencies.length > 0 && addWatchFile) {
          for (const dep of dependencies) {
            addWatchFile.call(this, dep)
          }
        }
        const warn = this.warn
        if (warnings?.length && warn) {
          for (const warning of warnings) {
            warn.call(this, warning)
          }
        }
        return { code: compiled, map: null }
      }

      if (TRANSFORM_STYLE_EXTS.some(ext => clean.endsWith(ext))) {
        const { css } = transformWxssToCss(code, wxssOptions)
        return {
          code: createInlineStyleModule(css),
          map: null,
        }
      }

      if (STYLE_EXTS.some(ext => clean.endsWith(ext)) && !clean.endsWith('.wxss')) {
        const { css } = transformWxssToCss(code, wxssOptions)
        return { code: css, map: null }
      }

      if (!SCRIPT_EXTS.some(ext => clean.endsWith(ext))) {
        return null
      }
      if (clean.includes('node_modules')) {
        return null
      }

      const meta = state.moduleMeta.get(normalizePath(clean))
      if (!meta) {
        return null
      }

      return transformScriptModule({
        code,
        cleanId: clean,
        meta,
        enableHmr,
        runtimeModuleId: runtimeProvider?.moduleId,
        hmrAcceptCode,
      })
    },
  }
}

export type { WeappWebPluginOptions } from './types'
