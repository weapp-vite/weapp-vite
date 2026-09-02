import type { SourceMap } from 'magic-string'
import type { ResolveWebAutoImportTag, ResolveWebModuleId, WeappWebPluginOptions, WebResolvedComponent, WebStylePreprocessOptions } from './types'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { dirname, extname, resolve } from 'pathe'
import { isUniAppCompatibilityFile, transformUniAppSource } from 'wevu/compiler'
import { compileWxml } from '../compiler/wxml'
import { transformWxsToEsm } from '../compiler/wxs'
import { createWxssPostcssPlugin, transformWxssToCss } from '../css/wxss'
import { createWebAssetMiddleware, emitWebAssets } from './assets'
import { AUTO_ROUTES_ID, ENTRY_ID, RESOLVED_AUTO_ROUTES_ID, SCRIPT_EXTS, SFC_STYLE_QUERY, SFC_TEMPLATE_QUERY, STYLE_EXTS, STYLE_QUERY, TEMPLATE_EXTS, TEMPLATE_QUERY, TRANSFORM_STYLE_EXTS, WEB_COMPONENT_PREFIX, WEB_COMPONENT_QUERY, WXS_EXTS } from './constants'
import { collectExternalComponentOptimizeDeps } from './dependencyScan'
import { generateAutoRoutesModule, generateEntryModule } from './entry'
import { wrapPageTemplate } from './layout'
import { createMiniProgramPackageResolver, getAncestorNodeModulesPaths } from './packageResolution'
import { cleanUrl, isHtmlEntry, isInsideDir, normalizePath, resolveFileWithExtensionsSync, resolveRuntimePolyfillPath, resolveTemplatePathSync, resolveWxsPathSync, toRelativeImport, toViteFsImport } from './path'
import { transformScriptModule } from './register'
import { getStableWebComponentId, scanProject } from './scan'
import { createEmptyScanState } from './state'
import { createInlineStyleModule } from './styleModule'
import { ensureWebVueSfcResult, generateWebVueSfcStyle, generateWebVueSfcTemplate, resolveWebVueSfcStyleLanguage, transformWebVueSfcScript } from './vueSfc'

interface WebPluginContext {
  warn?: (message: string) => void
  addWatchFile?: (id: string) => void
  emitFile?: (asset: { type: 'asset', fileName: string, source: Uint8Array }) => void
  resolve?: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null>
}

type WebTransformResult = { code: string, map: SourceMap | null } | null

interface WebPostcssConfig {
  plugins?: Array<{ postcssPlugin?: string }>
  [key: string]: unknown
}

interface WebCssConfig {
  postcss?: string | WebPostcssConfig
  preprocessorOptions?: WebStylePreprocessOptions
}

interface WebUserConfig {
  css?: {
    postcss?: string | WebPostcssConfig
    preprocessorOptions?: WebStylePreprocessOptions
  }
}

interface WebResolvedConfig extends WebUserConfig {
  root: string
  command: string
  createResolver?: () => ResolveWebModuleId
  optimizeDeps?: {
    exclude?: string[]
    include?: string[]
  }
}

interface WebHmrContext {
  file: string
}

interface WebDevServer {
  middlewares: {
    use: (middleware: ReturnType<typeof createWebAssetMiddleware>) => void
  }
}

interface WeappWebVitePlugin {
  name: string
  enforce?: 'pre' | 'post'
  config?: (this: WebPluginContext, config: WebUserConfig) => WebUserConfig | void
  configResolved?: (this: WebPluginContext, config: WebResolvedConfig) => void | Promise<void>
  configureServer?: (server: WebDevServer) => void
  buildStart?: (this: WebPluginContext) => void | Promise<void>
  resolveId?: (id: string, importer?: string) => string | null | Promise<string | null>
  load?: (id: string) => string | null | Promise<string | null>
  handleHotUpdate?: (this: WebPluginContext, ctx: WebHmrContext) => void | Promise<void>
  transform?: (
    this: WebPluginContext,
    code: string,
    id: string,
  ) => WebTransformResult | Promise<WebTransformResult>
}

const WEB_RUNTIME_MODULE_IDS = [
  'lit',
  'lit/directives/repeat.js',
] as const

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

function isUniAppDependency(id: string, includes: readonly string[]) {
  return includes.some(packageName => id === packageName || id.startsWith(`${packageName}/`))
}

function resolveSfcStyleSourceFilename(id: string) {
  const filename = cleanUrl(id)
  const vueSuffixIndex = filename.lastIndexOf('.vue.')
  return vueSuffixIndex >= 0
    ? filename.slice(0, vueSuffixIndex + '.vue'.length)
    : filename
}

function createWebCssConfig(
  config: WebUserConfig,
  wxssOptions: WeappWebPluginOptions['wxss'],
  warn?: (message: string) => void,
): WebCssConfig | undefined {
  const postcssConfig = config.css?.postcss
  if (typeof postcssConfig === 'string') {
    warn?.('[@weapp-vite/web] css.postcss 使用配置文件路径时无法注入 WXSS 转换插件。')
    return undefined
  }

  const plugins = postcssConfig?.plugins ?? []
  if (plugins.some(plugin => plugin.postcssPlugin === 'weapp-vite-web-wxss')) {
    return undefined
  }

  return {
    postcss: {
      ...postcssConfig,
      plugins: [...plugins, createWxssPostcssPlugin(wxssOptions)],
    },
    preprocessorOptions: config.css?.preprocessorOptions,
  }
}

function resolveStylePreprocessOptions(
  options: WebStylePreprocessOptions | undefined,
  root: string,
): WebStylePreprocessOptions | undefined {
  if (!options) {
    return undefined
  }

  const nodeModules = getAncestorNodeModulesPaths(root)
  return Object.fromEntries(Object.entries(options).map(([language, languageOptions]) => {
    if (!['sass', 'scss'].includes(language)) {
      return [language, languageOptions]
    }

    const loadPaths = Array.isArray(languageOptions.loadPaths)
      ? languageOptions.loadPaths.filter((value): value is string => typeof value === 'string')
      : []
    return [language, {
      ...languageOptions,
      loadPaths: Array.from(new Set([...loadPaths, ...nodeModules])),
    }]
  }))
}

export function weappWebPlugin(options: WeappWebPluginOptions = {}): WeappWebVitePlugin {
  let root = process.cwd()
  let srcRoot = resolve(root, options.srcDir ?? 'src')
  let enableHmr = false
  let resolveWebModuleId: ResolveWebModuleId | undefined
  let resolveMiniProgramModuleId: ResolveWebModuleId | undefined
  let resolveWebAutoImportTag: ResolveWebAutoImportTag | undefined
  const webRuntimeModules = new Map<string, string>()
  let stylePreprocessOptions: WebStylePreprocessOptions | undefined
  const componentImportIdMap = new Map<string, string>()

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

  const createAutoImportTagResolver = (): ResolveWebAutoImportTag | undefined => {
    const resolvers = options.__autoImportResolvers
    if (!resolvers?.length) {
      return undefined
    }
    return async (tag, importer) => {
      for (const resolver of resolvers) {
        let matched: WebResolvedComponent | void
        if (typeof resolver === 'function') {
          matched = resolver(tag, importer)
        }
        else if (typeof resolver.resolve === 'function') {
          matched = resolver.resolve(tag, importer)
        }
        else {
          const from = resolver.components?.[tag]
          matched = from ? { name: tag, from } : undefined
        }
        if (!matched) {
          continue
        }
        const request = matched.resolvedId ?? matched.from
        const resolvedId = await resolveWebModuleId?.(request, importer)
        return {
          ...matched,
          resolvedId: resolvedId ?? matched.resolvedId,
          sourceType: matched.sourceType ?? (resolvedId?.endsWith('.vue') ? 'wevu-sfc' : 'native'),
        }
      }
      return undefined
    }
  }

  const scan = async (context: WebPluginContext) => {
    await scanProject({
      srcRoot,
      warn: context.warn?.bind(context),
      state,
      resolveId: resolveWebModuleId,
      resolveAutoImportTag: resolveWebAutoImportTag,
      resolveAppConfig: options.__resolveAppConfig,
      uniApp: options.__uniApp,
      stylePreprocessOptions,
    })
    componentImportIdMap.clear()
    for (const component of state.scanResult.components) {
      if (component.importId) {
        componentImportIdMap.set(component.importId, component.script)
      }
    }
  }

  return {
    name: '@weapp-vite/web',
    enforce: 'pre',
    config(this: WebPluginContext, config: WebUserConfig) {
      const css = createWebCssConfig(config, wxssOptions, this.warn?.bind(this))
      return css ? { css } : undefined
    },
    async configResolved(this: WebPluginContext, config: WebResolvedConfig) {
      root = config.root
      const { createRequire } = await import('node:module')
      const requireFromWebRuntime = createRequire(import.meta.url)
      const requireFromProject = createRequire(resolve(root, 'package.json'))
      for (const id of WEB_RUNTIME_MODULE_IDS) {
        webRuntimeModules.set(id, requireFromWebRuntime.resolve(id))
      }
      resolveMiniProgramModuleId = createMiniProgramPackageResolver(requireFromProject.resolve)
      srcRoot = resolve(root, options.srcDir ?? 'src')
      stylePreprocessOptions = resolveStylePreprocessOptions(config.css?.preprocessorOptions, root)
      enableHmr = config.command === 'serve'
      const resolveViteModuleId = config.createResolver?.()
      resolveWebModuleId = resolveViteModuleId
        ? async (source, importer) => {
          const resolved = await resolveViteModuleId(source, importer)
          return await resolveMiniProgramModuleId?.(resolved ?? source, importer)
            ?? await resolveMiniProgramModuleId?.(source, importer)
            ?? resolved
        }
        : undefined
      resolveWebAutoImportTag = createAutoImportTagResolver()
      await scan(this)
      const componentDependencies = await collectExternalComponentOptimizeDeps(state.scanResult.components)
      const uniAppIncludes = options.__uniApp?.include ?? []
      config.optimizeDeps ??= {}
      config.optimizeDeps.exclude = Array.from(new Set([
        ...(config.optimizeDeps.exclude ?? []),
        ...uniAppIncludes,
      ]))
      config.optimizeDeps.include = Array.from(new Set([
        ...(config.optimizeDeps.include ?? []),
        ...componentDependencies,
      ])).filter(dependency => !isUniAppDependency(dependency, uniAppIncludes))
    },
    configureServer(server: WebDevServer) {
      server.middlewares.use(createWebAssetMiddleware(srcRoot))
    },
    async buildStart(this: WebPluginContext) {
      if (!resolveWebModuleId && this.resolve) {
        resolveWebModuleId = async (source, importer) => {
          const resolved = await this.resolve?.(source, importer, { skipSelf: true })
          return await resolveMiniProgramModuleId?.(resolved?.id ?? source, importer)
            ?? await resolveMiniProgramModuleId?.(source, importer)
            ?? resolved?.id
        }
      }
      resolveWebAutoImportTag = createAutoImportTagResolver()
      await scan(this)
      if (!enableHmr) {
        await emitWebAssets(this, srcRoot)
      }
    },
    resolveId(id: string, importer?: string) {
      const runtimeModule = webRuntimeModules.get(id)
      if (runtimeModule) {
        return runtimeModule
      }
      if (id === '/@weapp-vite/web/entry' || id === '@weapp-vite/web/entry') {
        return ENTRY_ID
      }
      if (id === AUTO_ROUTES_ID) {
        return RESOLVED_AUTO_ROUTES_ID
      }
      if (id.startsWith(WEB_COMPONENT_PREFIX)) {
        const request = decodeURIComponent(id.slice(WEB_COMPONENT_PREFIX.length))
        const resolvedId = componentImportIdMap.get(request)
        return resolvedId ? `${cleanUrl(resolvedId)}?${WEB_COMPONENT_QUERY}` : null
      }
      if (id.startsWith('.') && importer && cleanUrl(importer).endsWith('.vue') && !extname(id)) {
        const resolvedScript = resolveFileWithExtensionsSync(resolve(dirname(cleanUrl(importer)), id), SCRIPT_EXTS)
        if (resolvedScript?.endsWith('.vue')) {
          return resolvedScript
        }
      }
      if (hasQuery(id, SFC_STYLE_QUERY)) {
        const queryIndex = id.indexOf('?')
        const pathname = queryIndex >= 0 ? id.slice(0, queryIndex) : id
        const query = queryIndex >= 0 ? id.slice(queryIndex) : ''
        if (pathname.startsWith('.') && importer) {
          return `${resolve(dirname(cleanUrl(importer)), pathname)}${query}`
        }
        return id
      }
      return resolveMiniProgramModuleId?.(id, importer).then(resolved => resolved ?? null) ?? null
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
        const result = await ensureWebVueSfcResult({
          filename,
          meta,
          srcRoot,
          state,
          resolveId: resolveWebModuleId,
          resolveAutoImportTag: resolveWebAutoImportTag,
          uniApp: options.__uniApp,
          stylePreprocessOptions,
        })
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
        const filename = resolveSfcStyleSourceFilename(id)
        const meta = state.moduleMeta.get(normalizePath(filename))
        if (!meta) {
          return null
        }
        const result = await ensureWebVueSfcResult({
          filename,
          meta,
          srcRoot,
          state,
          resolveId: resolveWebModuleId,
          resolveAutoImportTag: resolveWebAutoImportTag,
          uniApp: options.__uniApp,
          stylePreprocessOptions,
        })
        return generateWebVueSfcStyle(result)
      }
      return null
    },
    async handleHotUpdate(this: WebPluginContext, ctx: WebHmrContext) {
      const clean = cleanUrl(ctx.file)
      if (clean.endsWith('.json') || isTemplateFile(clean) || isWxsFile(clean) || clean.endsWith('.wxss') || SCRIPT_EXTS.includes(extname(clean))) {
        await scan(this)
      }
    },
    async transform(this: WebPluginContext, code: string, id: string) {
      const clean = cleanUrl(id)
      let uniAppTransformed = false

      if (
        options.__uniApp
        && isUniAppCompatibilityFile(clean, srcRoot, options.__uniApp.include)
        && !clean.endsWith('.vue')
      ) {
        const transformed = transformUniAppSource(code, { filename: clean, target: 'h5' })
        if (transformed.changed) {
          code = transformed.code
          uniAppTransformed = true
        }
      }

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
        const normalized = normalizePath(clean)
        const meta = state.moduleMeta.get(normalized) ?? {
          kind: 'component' as const,
          id: getStableWebComponentId(clean, srcRoot),
          scriptPath: clean,
          sourceType: 'vue-sfc' as const,
        }
        state.moduleMeta.set(normalized, meta)
        const result = await ensureWebVueSfcResult({
          filename: clean,
          meta,
          srcRoot,
          state,
          source: code,
          resolveId: resolveWebModuleId,
          resolveAutoImportTag: resolveWebAutoImportTag,
          uniApp: options.__uniApp,
          stylePreprocessOptions,
        })
        return transformWebVueSfcScript({
          code: result.script!,
          filename: clean,
          meta,
          runtimeModuleId: runtimeProvider?.moduleId ?? toViteFsImport(resolveRuntimePolyfillPath()),
          styleLanguage: resolveWebVueSfcStyleLanguage(result, clean),
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
        return uniAppTransformed ? { code, map: null } : null
      }
      if (clean.includes('node_modules') && !hasQuery(id, WEB_COMPONENT_QUERY)) {
        return options.__uniApp && isUniAppCompatibilityFile(clean, srcRoot, options.__uniApp.include)
          ? { code, map: null }
          : null
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
