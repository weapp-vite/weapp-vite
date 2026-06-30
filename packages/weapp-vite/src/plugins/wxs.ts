import type { EmittedFile, PluginContext } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { WxmlDep } from '../types'
import { removeExtension } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import { jsExtensions } from '../constants'
import { resolveCompilerOutputExtensions } from '../utils/outputExtensions'
import { normalizeWatchPath } from '../utils/path'
import { isScriptModuleTagName } from '../utils/wxmlScriptModule'
import { scanWxml } from '../wxml'
import { transformWxsCode } from '../wxs'
import { resolveRelativeOutputFileNameWithExtension } from './utils/outputFileName'

export const wxsCodeCache = new LRUCache<string, string>({
  max: 512,
})
const WXS_FILE_SUFFIX_RE = /\.(?:wxs|sjs)(\.[jt]s)?$/

interface WxsPluginState {
  ctx: CompilerContext
  wxsMap: Map<string, { emittedFile: EmittedFile }>
  wxsFileCache: Map<string, WxsFileCacheEntry>
}

interface WxsFileCacheEntry {
  mtimeMs: number
  size: number
  emittedFile: EmittedFile
  importees: string[]
}

async function statWxsFile(wxsPath: string) {
  try {
    return await fs.stat(wxsPath)
  }
  catch {
    return undefined
  }
}

function resolveWxsOutputFileName(
  ctx: CompilerContext,
  wxsPath: string,
  scriptModuleExtension: string | undefined,
) {
  const suffixMatch = wxsPath.match(WXS_FILE_SUFFIX_RE)
  const isRaw = suffixMatch ? !suffixMatch[1] : true
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
) {
  const { ctx } = state
  const { configService } = ctx
  const { scriptModuleExtension } = resolveCompilerOutputExtensions(configService.outputExtensions)

  this.addWatchFile(normalizeWatchPath(wxsPath))
  const stat = await statWxsFile(wxsPath)
  if (!stat) {
    state.wxsFileCache.delete(wxsPath)
    return
  }

  const cached = state.wxsFileCache.get(wxsPath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    state.wxsMap.set(wxsPath, {
      emittedFile: cached.emittedFile,
    })
    await Promise.all(
      cached.importees.map((importee) => {
        return transformWxsFile.call(this, state, importee)
      }),
    )
    return
  }

  const rawCode = await fs.readFile(wxsPath, 'utf8')
  let code = wxsCodeCache.get(rawCode)
  let importeePaths: string[] = []

  if (code === undefined) {
    const { result, importees } = transformWxsCode(rawCode, {
      filename: wxsPath,
      extension: scriptModuleExtension,
    })

    if (typeof result?.code === 'string') {
      code = result.code
    }

    const dirname = path.dirname(wxsPath)
    importeePaths = importees.map(({ source }) => path.resolve(dirname, source))
    await Promise.all(
      importeePaths.map((importeePath) => {
        return transformWxsFile.call(
          this,
          state,
          importeePath,
        )
      }),
    )
  }

  if (code === undefined) {
    return
  }

  const outputFileName = resolveWxsOutputFileName(ctx, wxsPath, scriptModuleExtension)
  const emittedFile: EmittedFile = {
    type: 'asset',
    fileName: outputFileName,
    source: code,
  }
  state.wxsMap.set(wxsPath, {
    emittedFile,
  })
  state.wxsFileCache.set(wxsPath, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    emittedFile,
    importees: importeePaths,
  })

  wxsCodeCache.set(rawCode, code)
}

async function handleWxsDeps(
  this: PluginContext,
  state: WxsPluginState,
  deps: WxmlDep[],
  absPath: string,
) {
  await Promise.all(
    deps
      .filter(dep => isScriptModuleTagName(dep.tagName))
      .map(async (dep) => {
        const arr = dep.value.match(WXS_FILE_SUFFIX_RE)
        if (!jsExtensions.includes(dep.attrs.lang) && !arr) {
          return
        }

        const wxsPath = path.resolve(path.dirname(absPath), dep.value)
        await transformWxsFile.call(this, state, wxsPath)
      }),
  )
}

async function handleWxsDepsFromBundle(
  this: PluginContext,
  state: WxsPluginState,
  bundle: Record<string, any>,
) {
  const { templateExtension } = resolveCompilerOutputExtensions(state.ctx.configService.outputExtensions)
  const platform = state.ctx.configService.platform

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
        await handleWxsDeps.call(this, state, deps, absPath)
      }),
  )
}

function createWxsPlugin(state: WxsPluginState): Plugin {
  const { ctx } = state
  const { wxmlService } = ctx

  return {
    name: 'weapp-vite:wxs',
    enforce: 'post',

    buildStart() {
      state.wxsMap.clear()
    },

    async generateBundle(_options, bundle) {
      state.wxsMap.clear()
      await Promise.all(
        Array.from(wxmlService.tokenMap.entries()).map(([id, token]) => {
          return handleWxsDeps.call(
            // @ts-ignore Rolldown 上下文类型不完整
            this,
            state,
            token.deps,
            id,
          )
        }),
      )
      await handleWxsDepsFromBundle.call(this, state, bundle as Record<string, any>)

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
    wxsFileCache: new Map(),
  }

  return [createWxsPlugin(state)]
}
