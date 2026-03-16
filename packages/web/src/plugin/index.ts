import type { SourceMap } from 'magic-string'
import type { WeappWebPluginOptions } from './types'
import process from 'node:process'

import { extname, resolve } from 'pathe'
import { compileWxml } from '../compiler/wxml'
import { transformWxsToEsm } from '../compiler/wxs'
import { transformWxssToCss } from '../css/wxss'
import { ENTRY_ID, SCRIPT_EXTS, STYLE_EXTS, TEMPLATE_EXTS, TRANSFORM_STYLE_EXTS, WXS_EXTS } from './constants'
import { generateEntryModule } from './entry'
import { cleanUrl, isHtmlEntry, isInsideDir, normalizePath, resolveTemplatePathSync, resolveWxsPathSync, toRelativeImport } from './path'
import { transformScriptModule } from './register'
import { scanProject } from './scan'
import { createEmptyScanState } from './state'

interface WebPluginContext {
  warn?: (message: string) => void
  addWatchFile?: (id: string) => void
}

type WebTransformResult = { code: string, map: SourceMap | null } | null

interface WebResolvedConfig {
  root: string
  command: string
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

function createInlineStyleModule(css: string) {
  const serialized = JSON.stringify(css)
  return [
    `const __weapp_injected_styles__ = new Map()`,
    `function __weapp_createStyleId__(css) {`,
    `  let hash = 2166136261`,
    `  for (let i = 0; i < css.length; i++) {`,
    `    hash ^= css.charCodeAt(i)`,
    `    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)`,
    `  }`,
    `  return 'weapp-web-style-' + (hash >>> 0).toString(36)`,
    `}`,
    `function __weapp_removeStyle__(id) {`,
    `  if (typeof document === 'undefined') {`,
    `    return`,
    `  }`,
    `  const style = __weapp_injected_styles__.get(id)`,
    `  if (style) {`,
    `    style.remove()`,
    `    __weapp_injected_styles__.delete(id)`,
    `  }`,
    `}`,
    `function injectStyle(css, id) {`,
    `  if (typeof document === 'undefined') {`,
    `    return () => {}`,
    `  }`,
    `  const styleId = id ?? __weapp_createStyleId__(css)`,
    `  const existing = __weapp_injected_styles__.get(styleId)`,
    `  if (existing) {`,
    `    if (existing.textContent !== css) {`,
    `      existing.textContent = css`,
    `    }`,
    `    return () => __weapp_removeStyle__(styleId)`,
    `  }`,
    `  const style = document.createElement('style')`,
    `  style.id = styleId`,
    `  style.textContent = css`,
    `  document.head.append(style)`,
    `  __weapp_injected_styles__.set(styleId, style)`,
    `  return () => __weapp_removeStyle__(styleId)`,
    `}`,
    `const css = ${serialized}`,
    `export default css`,
    `export function useStyle(id) {`,
    `  return injectStyle(css, id)`,
    `}`,
  ].join('\n')
}

export function weappWebPlugin(options: WeappWebPluginOptions = {}): WeappWebVitePlugin {
  let root = process.cwd()
  let srcRoot = resolve(root, options.srcDir ?? 'src')
  let enableHmr = false

  const state = createEmptyScanState()
  const wxssOptions = options.wxss

  const resolveTemplatePath = (raw: string, importer: string) => resolveTemplatePathSync(raw, importer, srcRoot)
  const resolveWxsPath = (raw: string, importer: string) => resolveWxsPathSync(raw, importer, srcRoot)

  return {
    name: '@weapp-vite/web',
    enforce: 'pre',
    async configResolved(this: WebPluginContext, config: WebResolvedConfig) {
      root = config.root
      srcRoot = resolve(root, options.srcDir ?? 'src')
      enableHmr = config.command === 'serve'
      await scanProject({ srcRoot, warn: this.warn?.bind(this), state })
    },
    async buildStart(this: WebPluginContext) {
      await scanProject({ srcRoot, warn: this.warn?.bind(this), state })
    },
    resolveId(id: string) {
      if (id === '/@weapp-vite/web/entry' || id === '@weapp-vite/web/entry') {
        return ENTRY_ID
      }
      return null
    },
    load(id: string) {
      if (id === ENTRY_ID) {
        return generateEntryModule(state.scanResult, root, wxssOptions, options)
      }
      return null
    },
    async handleHotUpdate(this: WebPluginContext, ctx: WebHmrContext) {
      const clean = cleanUrl(ctx.file)
      if (clean.endsWith('.json') || isTemplateFile(clean) || isWxsFile(clean) || clean.endsWith('.wxss') || SCRIPT_EXTS.includes(extname(clean))) {
        await scanProject({ srcRoot, warn: this.warn?.bind(this), state })
      }
    },
    transform(this: WebPluginContext, code: string, id: string) {
      const clean = cleanUrl(id)

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
        const navigationConfig = state.pageNavigationMap.get(normalizedId)
        const componentTags = state.templateComponentMap.get(normalizedId)
        const { code: compiled, dependencies, warnings } = compileWxml({
          id: clean,
          source: code,
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
      })
    },
  }
}

export type { WeappWebPluginOptions } from './types'
