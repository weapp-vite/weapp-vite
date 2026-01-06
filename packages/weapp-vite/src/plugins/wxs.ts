import type { EmittedFile, PluginContext } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { WxmlDep } from '../types'
import { removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import { jsExtensions } from '../constants'
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

  this.addWatchFile(wxsPath)
  if (!(await fs.pathExists(wxsPath))) {
    return
  }

  const suffixMatch = wxsPath.match(/\.wxs(\.[jt]s)?$/)
  let isRaw = true
  if (suffixMatch) {
    isRaw = !suffixMatch[1]
  }

  const rawCode = await fs.readFile(wxsPath, 'utf8')
  let code = wxsCodeCache.get(rawCode)

  if (code === undefined) {
    const { result, importees } = transformWxsCode(rawCode, {
      filename: wxsPath,
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

  state.wxsMap.set(wxsPath, {
    emittedFile: {
      type: 'asset',
      fileName: configService.relativeOutputPath(
        isRaw ? wxsPath : removeExtension(wxsPath),
      ),
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
      .filter(dep => dep.tagName === 'wxs')
      .map(async (dep) => {
        const arr = dep.value.match(/\.wxs(\.[jt]s)?$/)
        if (!jsExtensions.includes(dep.attrs.lang) && !arr) {
          return
        }

        const wxsPath = path.resolve(path.dirname(absPath), dep.value)
        await transformWxsFile.call(this, state, wxsPath)
      }),
  )
}

function createWxsPlugin(state: WxsPluginState): Plugin {
  const { ctx } = state
  const { wxmlService } = ctx

  return {
    name: 'weapp-vite:wxs',
    enforce: 'pre',

    buildStart() {
      state.wxsMap.clear()
    },

    async buildEnd() {
      await Promise.all(
        Array.from(wxmlService.tokenMap.entries()).map(([id, token]) => {
          return handleWxsDeps.call(
            // @ts-ignore rolldown context
            this,
            state,
            token.deps,
            id,
          )
        }),
      )

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
