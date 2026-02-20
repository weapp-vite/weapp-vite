import type { EmittedFile, PluginContext } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { WxmlDep } from '../types'
import { removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import { jsExtensions } from '../constants'
import { changeFileExtension } from '../utils/file'
import { normalizeWatchPath } from '../utils/path'
import { scanWxml } from '../wxml'
import { transformWxsCode } from '../wxs'

export const wxsCodeCache = new LRUCache<string, string>({
  max: 512,
})

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
  const scriptModuleExtension = configService.outputExtensions?.wxs ?? 'wxs'

  this.addWatchFile(normalizeWatchPath(wxsPath))
  if (!(await fs.pathExists(wxsPath))) {
    return
  }

  const suffixMatch = wxsPath.match(/\.(?:wxs|sjs)(\.[jt]s)?$/)
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

  const baseOutputPath = configService.relativeOutputPath(
    isRaw ? wxsPath : removeExtension(wxsPath),
  )
  const outputFileName = changeFileExtension(baseOutputPath, scriptModuleExtension)
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
      .filter(dep => dep.tagName === 'wxs' || dep.tagName === 'sjs' || dep.tagName === 'import-sjs')
      .map(async (dep) => {
        const arr = dep.value.match(/\.(?:wxs|sjs)(\.[jt]s)?$/)
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
  const templateExtension = state.ctx.configService.outputExtensions?.wxml ?? 'wxml'
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
