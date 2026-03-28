import type { EmittedFile, PluginContext } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { WxmlDep } from '../types'
import { removeExtension } from '@weapp-core/shared'
// eslint-disable-next-line e18e/ban-dependencies -- 现有插件文件系统读写沿用 fs-extra，避免扩大本次抽象范围
import fs from 'fs-extra'
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
  if (!(await fs.pathExists(wxsPath))) {
    return
  }

  const suffixMatch = wxsPath.match(WXS_FILE_SUFFIX_RE)
  let isRaw = true
  if (suffixMatch) {
    isRaw = !suffixMatch[1]
  }

  const rawCode = await fs.readFile(wxsPath, 'utf8')
  let code = wxsCodeCache.get(rawCode)

  if (code === undefined) {
    const { result, importees } = transformWxsCode(rawCode, {
      filename: wxsPath,
      extension: scriptModuleExtension,
    })

    if (typeof result?.code === 'string') {
      code = result.code
    }

    const dirname = path.dirname(wxsPath)
    await Promise.all(
      importees.map(({ source }) => {
        return transformWxsFile.call(
          this,
          state,
          path.resolve(dirname, source),
        )
      }),
    )
  }

  if (code === undefined) {
    return
  }

  const outputFileName = resolveRelativeOutputFileNameWithExtension(
    configService,
    isRaw ? wxsPath : removeExtension(wxsPath),
    scriptModuleExtension,
  )
  state.wxsMap.set(wxsPath, {
    emittedFile: {
      type: 'asset',
      fileName: outputFileName,
      source: code,
    },
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
  }

  return [createWxsPlugin(state)]
}
