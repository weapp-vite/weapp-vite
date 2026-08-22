import type { I18nCatalog, I18nLocaleFileInput } from '@weapp-vite/i18n/compiler'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { ResolvedWeappI18nConfig } from '../i18n/types'
import type { SubPackageMetaValue } from '../types'
import {
  WEAPP_I18N_JS_FILE,
  WEAPP_I18N_LOCALE_DATA_KEY,
  WEAPP_I18N_PUBLIC_MODULE_ID,
  WEAPP_I18N_RUNTIME_MARKER,
  WEAPP_I18N_VIRTUAL_MODULE_ID,
  WEAPP_I18N_WXS_FILE,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/fs'
import {
  compileI18nCatalog,
  generateI18nCatalogModuleSource,
  generateI18nRuntimeSource,
  generateI18nWxsSource,
} from '@weapp-vite/i18n/compiler'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import picomatch from 'picomatch'
import { resolveWeappI18nConfig } from '../i18n/config'
import { transformI18nTemplate } from '../i18n/template'
import { toPosixPath } from '../utils/path'

interface I18nPluginState {
  catalog?: I18nCatalog
  config?: ResolvedWeappI18nConfig
  files: string[]
}

const TEMPLATE_MODULE_RE = /\.(?:vue|wxml)(?:\?|$)/

function withPackageRoot(root: string, fileName: string) {
  const normalizedRoot = root.replace(/^\/+|\/+$/g, '')
  return normalizedRoot ? `${normalizedRoot}/${fileName}` : fileName
}

function resolveCurrentPackageRoot(subPackageMeta?: SubPackageMetaValue) {
  return subPackageMeta?.subPackage.root?.replace(/^\/+|\/+$/g, '') ?? ''
}

function resolveOutputPackageRoot(
  ctx: CompilerContext,
  fileName: string,
  subPackageMeta?: SubPackageMetaValue,
) {
  const currentRoot = resolveCurrentPackageRoot(subPackageMeta)
  if (currentRoot) {
    return currentRoot
  }
  const normalized = toPosixPath(fileName).replace(/^\/+/, '')
  return [...ctx.scanService.subPackageMap.keys()]
    .map(root => root.replace(/^\/+|\/+$/g, ''))
    .filter(root => normalized === root || normalized.startsWith(`${root}/`))
    .sort((left, right) => right.length - left.length)[0] ?? ''
}

function resolveEmittedPackageRoots(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue) {
  const currentRoot = resolveCurrentPackageRoot(subPackageMeta)
  if (currentRoot) {
    return [currentRoot]
  }
  return [
    '',
    ...[...ctx.scanService.subPackageMap.keys()]
      .filter(root => !ctx.scanService.independentSubPackageMap.has(root)),
  ]
}

async function loadI18nCatalog(
  ctx: CompilerContext,
  config: ResolvedWeappI18nConfig,
): Promise<{ catalog: I18nCatalog, files: string[] }> {
  const root = ctx.configService.absoluteSrcRoot
  const matcher = picomatch(config.include, { dot: false })
  const candidates = await new Fdir({ includeDirs: false, pathSeparator: '/' })
    .withFullPaths()
    .crawl(root)
    .withPromise()
  const files = candidates
    .filter(file => matcher(toPosixPath(path.relative(root, file))))
    .sort()
  if (!files.length) {
    throw new Error(`weapp.i18n 未找到 locale 文件，include: ${config.include.join(', ')}。`)
  }
  const inputs: I18nLocaleFileInput[] = []
  for (const filePath of files) {
    let messages: unknown
    try {
      messages = JSON.parse(await fs.readFile(filePath, 'utf8'))
    }
    catch (error) {
      throw new Error(`无法解析 i18n 文件 \`${ctx.configService.relativeCwd(filePath)}\`：${String(error)}`)
    }
    inputs.push({
      filePath: ctx.configService.relativeCwd(filePath),
      locale: path.basename(filePath, path.extname(filePath)),
      messages,
    })
  }
  return {
    catalog: compileI18nCatalog(inputs, config),
    files,
  }
}

function matchesI18nLocaleFile(
  ctx: CompilerContext,
  config: ResolvedWeappI18nConfig,
  filePath: string,
) {
  const relativePath = toPosixPath(path.relative(ctx.configService.absoluteSrcRoot, filePath))
  return !relativePath.startsWith('../') && picomatch(config.include, { dot: false })(relativePath)
}

export function transformI18nOutputTemplate(
  ctx: CompilerContext,
  fileName: string,
  source: string,
  subPackageMeta?: SubPackageMetaValue,
) {
  const rawConfig = ctx.configService.weappViteConfig?.i18n
  if (!rawConfig || ctx.configService.platform !== 'weapp') {
    return source
  }
  const config = resolveWeappI18nConfig(rawConfig)
  const packageRoot = resolveOutputPackageRoot(ctx, fileName, subPackageMeta)
  return transformI18nTemplate(source, {
    assetFileName: withPackageRoot(packageRoot, WEAPP_I18N_WXS_FILE),
    fileName,
    functionName: config.functionName,
    localeDataKey: WEAPP_I18N_LOCALE_DATA_KEY,
    moduleName: config.moduleName,
  })
}

export function i18n(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
  const state: I18nPluginState = { files: [] }
  const resolvedId = `\0${WEAPP_I18N_VIRTUAL_MODULE_ID}:${resolveCurrentPackageRoot(subPackageMeta) || 'main'}`

  async function refreshCatalog(pluginContext?: { addWatchFile?: (file: string) => void }) {
    if (!state.config) {
      return
    }
    const loaded = await loadI18nCatalog(ctx, state.config)
    state.catalog = loaded.catalog
    state.files = loaded.files
    for (const file of state.files) {
      pluginContext?.addWatchFile?.(file)
    }
  }

  return [{
    name: 'weapp-vite:i18n',
    enforce: 'pre',
    async buildStart() {
      const rawConfig = ctx.configService.weappViteConfig?.i18n
      if (!rawConfig) {
        return
      }
      if (ctx.configService.platform !== 'weapp') {
        throw new Error('weapp.i18n v1 仅支持 platform = "weapp"。')
      }
      state.config = resolveWeappI18nConfig(rawConfig)
      await refreshCatalog(this)
      this.emitFile({
        type: 'chunk',
        id: WEAPP_I18N_PUBLIC_MODULE_ID,
        fileName: withPackageRoot(resolveCurrentPackageRoot(subPackageMeta), WEAPP_I18N_JS_FILE),
        preserveSignature: 'exports-only',
      })
    },
    watchChange(id) {
      if (state.config && matchesI18nLocaleFile(ctx, state.config, id)) {
        state.catalog = undefined
      }
    },
    async handleHotUpdate(hotContext) {
      if (!state.config || !matchesI18nLocaleFile(ctx, state.config, hotContext.file)) {
        return
      }
      await refreshCatalog()
      const affectedModules = []
      const runtimeModule = hotContext.server.moduleGraph.getModuleById(resolvedId)
      if (runtimeModule) {
        hotContext.server.moduleGraph.invalidateModule(runtimeModule)
        affectedModules.push(runtimeModule)
      }
      for (const module of hotContext.server.moduleGraph.idToModuleMap.values()) {
        if (module.id && TEMPLATE_MODULE_RE.test(module.id)) {
          hotContext.server.moduleGraph.invalidateModule(module)
          affectedModules.push(module)
        }
      }
      return affectedModules
    },
    resolveId(id) {
      if (id === WEAPP_I18N_PUBLIC_MODULE_ID && ctx.configService.weappViteConfig?.i18n) {
        return resolvedId
      }
    },
    load(id) {
      if (id !== resolvedId) {
        return
      }
      if (!state.catalog) {
        throw new Error('i18n runtime 在 locale catalog 初始化前被加载。')
      }
      return generateI18nRuntimeSource(state.catalog)
    },
    generateBundle() {
      if (!state.catalog) {
        return
      }
      const wxsSource = generateI18nWxsSource(state.catalog)
      const catalogSource = generateI18nCatalogModuleSource(state.catalog)
      const currentRoot = resolveCurrentPackageRoot(subPackageMeta)
      for (const root of resolveEmittedPackageRoots(ctx, subPackageMeta)) {
        this.emitFile({
          type: 'asset',
          fileName: withPackageRoot(root, WEAPP_I18N_WXS_FILE),
          source: wxsSource,
        })
        if (root !== currentRoot) {
          this.emitFile({
            type: 'asset',
            fileName: withPackageRoot(root, WEAPP_I18N_JS_FILE),
            source: `${catalogSource}// ${WEAPP_I18N_RUNTIME_MARKER}\n`,
          })
        }
      }
    },
  }]
}
