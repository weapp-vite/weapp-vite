import type { Plugin, UserConfig } from 'vite'
import type { CompilerContext } from '../context'
import path from 'node:path'
import { WEAPP_VITE_WASM_INIT_QUERY_MARKER, WX_WEBASSEMBLY_MIN_BASE_LIB_VERSION, WX_WEBASSEMBLY_WORKER_MIN_BASE_LIB_VERSION } from '@weapp-core/constants'

export type WasmAssetScope = 'app' | 'independent' | 'worker'

type RenderBuiltUrl = NonNullable<NonNullable<UserConfig['experimental']>['renderBuiltUrl']>
type AssetFileNames = string | ((assetInfo: { name?: string, names?: string[], originalFileNames?: string[] }) => string)

interface WasmPluginOptions {
  scope: WasmAssetScope
  packageRoot?: string
  workerRoot?: string
  reservedRoots?: string[]
}

function splitId(id: string) {
  const index = id.indexOf('?')
  return index < 0 ? { file: id, query: '' } : { file: id.slice(0, index), query: id.slice(index + 1) }
}

function hasFlag(query: URLSearchParams, name: string) {
  return query.has(name) && query.get(name) !== 'false'
}

function normalizeRuntimePath(options: WasmPluginOptions, fileName: string) {
  const { scope, packageRoot, workerRoot } = options
  const posixFileName = fileName.replaceAll('\\', '/')
  if (posixFileName.startsWith('/') || posixFileName.split('/').some(segment => segment === '..' || segment === '.' || segment === '')) {
    throw new Error(`[weapp-vite] Invalid emitted WASM asset path: ${fileName}`)
  }
  if (scope === 'independent') {
    const root = packageRoot?.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
    if (!root) {
      throw new Error('[weapp-vite] Independent WASM initialization requires a subpackage root.')
    }
    if (posixFileName !== root && !posixFileName.startsWith(`${root}/`)) {
      throw new Error(`[weapp-vite] Independent WASM asset escaped its package root: ${posixFileName}`)
    }
  }
  if (scope === 'app') {
    for (const reservedRoot of options.reservedRoots ?? []) {
      const root = reservedRoot.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
      if (root && (posixFileName === root || posixFileName.startsWith(`${root}/`))) {
        throw new Error(`[weapp-vite] Main package WASM assets cannot be emitted inside package or Worker root: ${posixFileName}`)
      }
    }
  }
  const normalizedWorkerRoot = workerRoot?.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (scope === 'worker' && normalizedWorkerRoot && (posixFileName === normalizedWorkerRoot || posixFileName.startsWith(`${normalizedWorkerRoot}/`))) {
    throw new Error(`[weapp-vite] Worker WASM assets must be published outside the Worker directory: ${posixFileName}`)
  }
  return `/${posixFileName}`
}

function createInitializerSource(assetId: string, scope: WasmAssetScope) {
  const minVersion = scope === 'worker' ? WX_WEBASSEMBLY_WORKER_MIN_BASE_LIB_VERSION : WX_WEBASSEMBLY_MIN_BASE_LIB_VERSION
  return `import wasmPath from ${JSON.stringify(assetId)};\n\nexport default async function init(imports = {}) {\n  const host = typeof WXWebAssembly === 'undefined' ? undefined : WXWebAssembly;\n  if (!host || typeof host.instantiate !== 'function') {\n    throw new Error('[weapp-vite] WXWebAssembly.instantiate is unavailable; this entry requires WeChat base library ${minVersion} or later.');\n  }\n  const result = await host.instantiate(wasmPath, imports);\n  if (result && result.instance && result.instance.exports) return result.instance;\n  if (result && result.exports) return result;\n  throw new Error('[weapp-vite] WXWebAssembly.instantiate returned an unsupported result.');\n}\n`
}

function stripInternalMarker(filename: string) {
  const index = filename.lastIndexOf('?')
  if (index < 0) {
    return undefined
  }
  const query = new URLSearchParams(filename.slice(index + 1))
  if (!query.has(WEAPP_VITE_WASM_INIT_QUERY_MARKER)) {
    return undefined
  }
  query.delete(WEAPP_VITE_WASM_INIT_QUERY_MARKER)
  const remaining = query.toString()
  return `${filename.slice(0, index)}${remaining ? `?${remaining}` : ''}`
}

function isWasmAsset(assetInfo: { name?: string, names?: string[], originalFileNames?: string[] }) {
  return [assetInfo.name, ...(assetInfo.names ?? []), ...(assetInfo.originalFileNames ?? [])]
    .some(name => typeof name === 'string' && name.split(/[?#]/, 1)[0]!.endsWith('.wasm'))
}

function resolveAssetFileName(
  assetFileNames: AssetFileNames | undefined,
  assetInfo: { name?: string, names?: string[], originalFileNames?: string[] },
) {
  if (typeof assetFileNames === 'function') {
    return assetFileNames(assetInfo)
  }
  return assetFileNames ?? 'assets/[name]-[hash][extname]'
}

function constrainAssetFileName(options: WasmPluginOptions, fileName: string) {
  const normalized = fileName.replaceAll('\\', '/')
  if (normalized.startsWith('/') || normalized.split('/').some(segment => segment === '.' || segment === '..' || segment === '')) {
    throw new Error(`[weapp-vite] Invalid WASM asset file name: ${fileName}`)
  }

  if (options.scope === 'independent') {
    const root = options.packageRoot?.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
    if (!root) {
      throw new Error('[weapp-vite] Independent WASM initialization requires a subpackage root.')
    }
    if (normalized === root || normalized.startsWith(`${root}/`)) {
      return normalized
    }
    return `${root}/${normalized}`
  }

  if (options.scope === 'app') {
    for (const reservedRoot of options.reservedRoots ?? []) {
      const root = reservedRoot.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
      if (root && (normalized === root || normalized.startsWith(`${root}/`))) {
        throw new Error(`[weapp-vite] Main package WASM assets cannot be emitted inside package or Worker root: ${normalized}`)
      }
    }
  }

  if (options.scope === 'worker') {
    const workerRoot = options.workerRoot?.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
    if (workerRoot && (normalized === workerRoot || normalized.startsWith(`${workerRoot}/`))) {
      return `assets/${normalized.slice(workerRoot.length).replace(/^\/+/, '')}`
    }
  }
  return normalized
}

export function createWasmPlugin(ctx: CompilerContext, options: WasmPluginOptions): Plugin {
  const configFunctions = new WeakMap<RenderBuiltUrl, { original?: RenderBuiltUrl, scope: WasmAssetScope }>()
  let installedRenderBuiltUrl: RenderBuiltUrl | undefined
  let command: 'build' | 'serve' | undefined
  let bundledDev = false
  let publicDir: string | undefined

  return {
    name: 'weapp-vite:wasm-init',
    enforce: 'pre',
    config: {
      order: 'post',
      handler(config, env) {
        if (ctx.configService.platform !== 'weapp' || env.command !== 'build') {
          return
        }
        const previous = config.experimental?.renderBuiltUrl as RenderBuiltUrl | undefined
        const inherited = previous ? configFunctions.get(previous)?.original ?? previous : undefined
        const scope = options.scope
        const renderBuiltUrl: RenderBuiltUrl = (filename, context) => {
          const assetPath = stripInternalMarker(filename)
          if (context.hostType === 'js' && context.type === 'asset' && assetPath !== undefined) {
            return { runtime: JSON.stringify(normalizeRuntimePath(options, assetPath)) }
          }
          return inherited?.(filename, context)
        }
        configFunctions.set(renderBuiltUrl, { original: inherited, scope })
        installedRenderBuiltUrl = renderBuiltUrl
        return {
          experimental: {
            ...config.experimental,
            renderBuiltUrl,
          },
        }
      },
    },
    async load(id) {
      const { file, query: rawQuery } = splitId(id)
      if (!file.endsWith('.wasm')) {
        return null
      }
      const query = new URLSearchParams(rawQuery)
      if (!hasFlag(query, 'init')) {
        return null
      }
      if (ctx.configService.platform !== 'weapp') {
        return null
      }
      if (hasFlag(query, 'raw') || hasFlag(query, 'url') || hasFlag(query, 'inline')) {
        this.error('The `?init` WASM entry cannot be combined with `?raw`, `?url`, or `?inline`.')
      }
      if (publicDir) {
        const relative = path.relative(publicDir, path.resolve(file))
        if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
          this.error('WASM `?init` is not supported for files in `publicDir`; move the file into the source tree or an npm package.')
        }
      }
      if (ctx.currentBuildTarget === 'plugin' || ctx.configService.weappLibConfig?.enabled) {
        this.error('WASM `?init` is not supported in mini-program plugin projects or lib mode.')
      }
      if (command === 'serve' && bundledDev) {
        this.error('WASM `?init` is not supported with stateful bundledDev; set `weapp.hmr.runtime: "classic"`.')
      }
      const resolved = await this.resolve(`${file}?url&no-inline&${WEAPP_VITE_WASM_INIT_QUERY_MARKER}`, id, { skipSelf: true })
      if (!resolved) {
        this.error(`Unable to resolve the WASM asset for ${id}.`)
      }
      return createInitializerSource(resolved.id, options.scope)
    },
    configResolved(config) {
      command = config.command
      bundledDev = config.experimental?.bundledDev === true
      publicDir = config.publicDir ? path.resolve(config.publicDir) : undefined
      if (installedRenderBuiltUrl && config.experimental?.renderBuiltUrl !== installedRenderBuiltUrl) {
        throw new Error('[weapp-vite] The WASM asset URL adapter was replaced after plugin configuration; preserve the weapp-vite renderBuiltUrl callback.')
      }
    },
    outputOptions(outputOptions) {
      if (ctx.configService.platform !== 'weapp' || command !== 'build') {
        return null
      }
      const original = outputOptions.assetFileNames as AssetFileNames | undefined
      outputOptions.assetFileNames = function (assetInfo) {
        const fileName = typeof original === 'function'
          ? original.call(this, assetInfo)
          : resolveAssetFileName(original, assetInfo)
        return isWasmAsset(assetInfo) ? constrainAssetFileName(options, fileName) : fileName
      }
      return outputOptions
    },
  }
}

export function resolveWasmScope(_ctx: CompilerContext, subPackageRoot?: string, worker = false): WasmPluginOptions {
  if (worker) {
    return { scope: 'worker', workerRoot: _ctx.scanService.workersDir }
  }
  if (subPackageRoot) {
    const root = path.posix.normalize(subPackageRoot.replaceAll('\\', '/')).replace(/^\/+|\/+$/g, '')
    return { scope: 'independent', packageRoot: root }
  }
  return {
    scope: 'app',
    workerRoot: _ctx.scanService?.workersDir,
    reservedRoots: [...(_ctx.scanService?.subPackageMap?.keys() ?? [])],
  }
}
