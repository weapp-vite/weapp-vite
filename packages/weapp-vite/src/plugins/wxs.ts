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

export const wxsCodeCache = new LRUCache<string, string>(
  {
    max: 512,
  },
)

export function wxs({ configService, wxmlService }: CompilerContext): Plugin[] {
  const wxsMap = new Map<string, {
    emittedFile: EmittedFile
  }>()

  async function transformWxs(this: PluginContext, {
    wxsPath,
  }: {
    wxsPath: string
  }) {
    this.addWatchFile(wxsPath)
    if (await fs.exists(wxsPath)) {
      const arr = wxsPath.match(/\.wxs(\.[jt]s)?$/)
      let isRaw = true
      if (arr) {
        isRaw = !arr[1]
      }
      const rawCode = await fs.readFile(wxsPath, 'utf8')
      let code = wxsCodeCache.get(rawCode)

      const dirname = path.dirname(wxsPath)
      if (code === undefined) {
        const { result, importees } = transformWxsCode(rawCode, {
          filename: wxsPath,
        })
        if (typeof result?.code === 'string') {
          code = result.code
        }
        await Promise.all(
          importees.map(({ source }) => {
            return transformWxs.call(this, {
              wxsPath: path.resolve(dirname, source),
            })
          }),
        )
      }

      if (code !== undefined) {
        wxsMap.set(wxsPath, {
          emittedFile: {
            type: 'asset',
            fileName: configService.relativeAbsoluteSrcRoot(isRaw ? wxsPath : removeExtension(wxsPath)),
            source: code,
          },
        })
        wxsCodeCache.set(rawCode, code)
      }
    }
  }
  function handleWxsDeps(this: PluginContext, deps: WxmlDep[], absPath: string) {
    return Promise.all(
      deps.filter(x => x.tagName === 'wxs').map(async (wxsDep) => {
        const arr = wxsDep.value.match(/\.wxs(\.[jt]s)?$/)
        if (jsExtensions.includes(wxsDep.attrs.lang) || arr) {
          const wxsPath = path.resolve(path.dirname(absPath), wxsDep.value)

          await transformWxs.call(this, {
            wxsPath,
          })
        }
      }),
    )
  }

  return [
    {
      name: 'weapp-vite:wxs',
      enforce: 'pre',
      buildStart() {
        wxsMap.clear()
      },

      async buildEnd() {
        await Promise.all(
          Array.from(
            wxmlService
              .tokenMap
              .entries(),
          )
            .map(([id, token]) => {
              return handleWxsDeps.call(
                // @ts-ignore
                this,
                token.deps,
                id,
              )
            }),
        )

        Array.from(wxsMap.values()).forEach(({ emittedFile }) => {
          this.emitFile(emittedFile)
        })
      },
    },
  ]
}
