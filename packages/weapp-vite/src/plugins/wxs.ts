import type { EmittedFile, PluginContext } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { WxmlDep } from '../types'
import type { NativeScriptOwner } from './wxs/nativeDependencies'
import { getMiniProgramNativeScriptModules, removeExtension } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import { jsExtensions } from '../constants'
import { resolveCompilerOutputExtensions } from '../utils/outputExtensions'
import { getNativeScriptModuleByTag, isScriptModuleTagName } from '../utils/wxmlScriptModule'
import { scanWxml } from '../wxml/scan'
import { resolveRelativeOutputFileName, resolveRelativeOutputFileNameWithExtension } from './utils/outputFileName'
import { bindNativeScriptOwners, createNativeScriptSourceResolver } from './wxs/nativeDependencies'

export const wxsCodeCache = new LRUCache<string, string>({
  max: 512,
})
const WXS_FILE_SUFFIX_RE = /\.(?:wxs|sjs)(\.[jt]s)?$|\.filter\.[jt]s$/
const WXS_SCAN_RELEVANT_HMR_RE = /\.(?:vue|wxml|axml|swan|ttml|jxml|qml|ksml|xhsml|html|wxs|sjs|filter)(?:\.[jt]s)?$/i

interface WxsPluginState {
  ctx: CompilerContext
  wxsMap: Map<string, { emittedFile: EmittedFile }>
  visited: Set<string>
  nativeDependencies: Map<string, string[]>
  nativeOwners: Map<string, NativeScriptOwner>
}

function createWxsCodeCacheKey(rawCode: string, scriptModuleExtension?: string, platform?: string, native = false) {
  return `${platform ?? ''}::${scriptModuleExtension ?? 'wxs'}::${native}::${rawCode}`
}

function resolveWxsOutputFileName(
  ctx: CompilerContext,
  wxsPath: string,
  scriptModuleExtension: string | undefined,
) {
  const isRaw = !/\.(?:wxs|sjs)\.[jt]s$/i.test(wxsPath)
  return resolveRelativeOutputFileNameWithExtension(
    ctx.configService,
    isRaw ? wxsPath : removeExtension(wxsPath),
    scriptModuleExtension ?? 'wxs',
  )
}

async function transformWxsFile(
  this: PluginContext,
  state: WxsPluginState,
  wxsPath: string,
  compile = false,
  filter = false,
  preserveNative = false,
) {
  const { ctx } = state
  const { configService } = ctx
  preserveNative ||= getMiniProgramNativeScriptModules(configService.platform).some(module => wxsPath.toLowerCase().endsWith(`.${module.extension}`))
  const visitKey = `${filter}::${compile}::${preserveNative}::${wxsPath}`
  if (state.visited.has(visitKey)) {
    return
  }
  state.visited.add(visitKey)
  const scriptModuleExtension = preserveNative ? path.extname(wxsPath).slice(1) : filter ? 'js' : resolveCompilerOutputExtensions(configService.outputExtensions).scriptModuleExtension
  if (preserveNative && (!scriptModuleExtension || compile || /\.(?:[cm]?ts|tsx|jsx)$/i.test(wxsPath))) {
    throw new Error(`Native script modules require an explicit file extension and cannot use lang=js/ts: ${wxsPath}`)
  }
  if (preserveNative) {
    this.addWatchFile(wxsPath)
  }
  let rawCode: string
  try {
    rawCode = await fs.readFile(wxsPath, 'utf8')
  }
  catch (cause) {
    if (preserveNative) {
      throw new Error(`Cannot read native script module: ${wxsPath}`, { cause })
    }
    return
  }
  const { prepareWxsSource } = await import('../wxs/source')
  const { code: preparedCode, importees, native } = await prepareWxsSource(rawCode, {
    filename: wxsPath,
    extension: scriptModuleExtension,
    platform: configService.platform,
    compile,
    filter,
  })
  const cacheKey = createWxsCodeCacheKey(rawCode, scriptModuleExtension, configService.platform, native)
  const code = wxsCodeCache.get(cacheKey) ?? preparedCode
  const dirname = path.dirname(wxsPath)
  const importeePaths = await Promise.all(importees.map(async ({ source }) => {
    const target = path.resolve(dirname, source)
    const candidates = preserveNative
      ? [target]
      : [target, `${target}.ts`, `${target}.js`, target.replace(/\.js$/i, '.ts'), ...['wxs', 'sjs'].flatMap(extension => [`${target}.${extension}.ts`, `${target}.${extension}.js`, `${target}.${extension}`])]
    for (const candidate of candidates) {
      if (await fs.stat(candidate).then(stat => stat.isFile(), () => false)) {
        return candidate
      }
    }
    return target
  }))
  if (preserveNative) {
    state.nativeDependencies.set(wxsPath, importeePaths)
  }
  await Promise.all(
    importeePaths.map(importeePath => transformWxsFile.call(this, state, importeePath, false, filter, preserveNative)),
  )

  if (code == null) {
    return
  }

  const outputFileName = preserveNative
    ? resolveRelativeOutputFileName(configService, wxsPath)
    : resolveWxsOutputFileName(ctx, wxsPath, scriptModuleExtension)
  const emittedFile: EmittedFile = {
    type: 'asset',
    fileName: outputFileName,
    source: code,
  }
  state.wxsMap.set(visitKey, {
    emittedFile,
  })
  wxsCodeCache.set(cacheKey, code)
}

async function handleWxsDeps(
  this: PluginContext,
  state: WxsPluginState,
  deps: WxmlDep[],
  absPath: string,
  bindOwner = true,
) {
  const nativeRoots: Array<{ path: string, dep: WxmlDep }> = []
  await Promise.all(
    deps
      .filter(dep => isScriptModuleTagName(dep.tagName, state.ctx.configService.platform))
      .map(async (dep) => {
        const native = getNativeScriptModuleByTag(dep.tagName, state.ctx.configService.platform)
        if (native && (Object.hasOwn(dep.attrs, 'lang') || !dep.value.toLowerCase().endsWith(`.${native.extension}`))) {
          throw new Error(`<${native.tag}> only supports native .${native.extension} scripts without lang.`)
        }
        const arr = dep.value.match(WXS_FILE_SUFFIX_RE)
        if (!native && !jsExtensions.includes(dep.attrs.lang) && !arr) {
          return
        }

        const wxsPath = dep.value.startsWith('/')
          ? path.resolve(state.ctx.configService.absoluteSrcRoot, dep.value.slice(1))
          : path.resolve(path.dirname(absPath), dep.value)
        if (native) {
          nativeRoots.push({ path: wxsPath, dep })
        }
        await transformWxsFile.call(this, state, wxsPath, jsExtensions.includes(dep.attrs.lang), dep.tagName === 'filter', Boolean(native))
      }),
  )
  if (bindOwner && nativeRoots.length && state.ctx.wxmlService.tokenMap.has(absPath) && !state.nativeOwners.has(absPath)) {
    state.nativeOwners.set(absPath, { deps, roots: nativeRoots })
  }
}

async function handleWxsDepsFromBundle(
  this: PluginContext,
  state: WxsPluginState,
  bundle: Record<string, any>,
) {
  const { templateExtension } = resolveCompilerOutputExtensions(state.ctx.configService.outputExtensions)
  const platform = state.ctx.configService.platform
  const resolveSource = createNativeScriptSourceResolver(state.ctx.configService, state.ctx.wxmlService.tokenMap, templateExtension)

  await Promise.all(
    Object.entries(bundle)
      .filter(([fileName, output]) => {
        return fileName.endsWith(`.${templateExtension}`) && output?.type === 'asset'
      })
      .map(async ([fileName, output]) => {
        const source = output.source?.toString?.()
        if (!source) {
          return
        }

        let deps: WxmlDep[] = []
        try {
          deps = scanWxml(source, { platform }).deps
        }
        catch {
          return
        }

        const absPath = path.resolve(state.ctx.configService.absoluteSrcRoot, fileName)
        const hasNative = deps.some(dep => getNativeScriptModuleByTag(dep.tagName, platform))
        const original = hasNative ? resolveSource(fileName) : undefined
        if (original) {
          await handleWxsDeps.call(this, state, original.deps, original.id)
        }
        await handleWxsDeps.call(this, state, deps, absPath, false)
      }),
  )
}

function shouldScanWxsTokenMap(state: WxsPluginState) {
  const hmrProfile = state.ctx.runtimeState?.build?.hmr?.profile
  if (!state.ctx.configService.isDev || hmrProfile?.event === undefined) {
    return true
  }
  if (!hmrProfile.file) {
    return true
  }
  return WXS_SCAN_RELEVANT_HMR_RE.test(hmrProfile.file)
    || getMiniProgramNativeScriptModules(state.ctx.configService.platform).some(module => hmrProfile.file!.endsWith(`.${module.extension}`))
    || hmrProfile.dirtyReasonSummary?.some(reason => reason.startsWith('importer-graph:')) === true
}

function shouldScanFullWxsTokenMap(state: WxsPluginState) {
  const hmrProfile = state.ctx.runtimeState?.build?.hmr?.profile
  if (!state.ctx.configService.isDev || hmrProfile?.event === undefined) {
    return true
  }
  if (!hmrProfile.file) {
    return true
  }
  return WXS_FILE_SUFFIX_RE.test(hmrProfile.file)
    || getMiniProgramNativeScriptModules(state.ctx.configService.platform).some(module => hmrProfile.file!.endsWith(`.${module.extension}`))
    || hmrProfile.dirtyReasonSummary?.some(reason => reason.startsWith('importer-graph:')) === true
}

function resolveWxsTokenScanEntries(state: WxsPluginState): Array<[string, any]> {
  const tokenMap = state.ctx.wxmlService.tokenMap
  if (!shouldScanWxsTokenMap(state)) {
    return []
  }

  if (shouldScanFullWxsTokenMap(state)) {
    return Array.from(tokenMap.entries())
  }

  const hmrFile = state.ctx.runtimeState?.build?.hmr?.profile?.file
  if (!hmrFile) {
    return []
  }
  const token = tokenMap.get(hmrFile)
  return token ? [[hmrFile, token]] : []
}

function createWxsPlugin(state: WxsPluginState): Plugin {
  return {
    name: 'weapp-vite:wxs',
    enforce: 'post',

    buildStart() {
      state.wxsMap.clear()
      state.visited.clear()
      state.nativeDependencies.clear()
      state.nativeOwners.clear()
    },

    async generateBundle(_options, bundle) {
      state.wxsMap.clear()
      state.visited.clear()
      state.nativeDependencies.clear()
      state.nativeOwners.clear()
      const tokenEntries = resolveWxsTokenScanEntries(state)
      if (tokenEntries.length) {
        await Promise.all(
          tokenEntries.map(([id, token]) => {
            return handleWxsDeps.call(
              // @ts-ignore Rolldown 上下文类型不完整
              this,
              state,
              token.deps,
              id,
            )
          }),
        )
      }
      await handleWxsDepsFromBundle.call(this, state, bundle as Record<string, any>)
      await bindNativeScriptOwners(state.ctx.wxmlService, state.nativeOwners, state.nativeDependencies)

      for (const { emittedFile } of state.wxsMap.values()) {
        this.emitFile(emittedFile)
      }
    },
  }
}

export function wxs(ctx: CompilerContext): Plugin[] {
  const state: WxsPluginState = {
    ctx,
    wxsMap: new Map(),
    visited: new Set(),
    nativeDependencies: new Map(),
    nativeOwners: new Map(),
  }

  return [createWxsPlugin(state)]
}
