import type { CompilerContext } from '@/context'
import type { WxmlDep } from '@/types'
import type { PluginContext } from 'rollup'
import type { Plugin } from 'vite'
import { jsExtensions } from '@/constants'
import { transformWxsCode } from '@/wxs'
import { removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'

export const wxsCodeCache = new LRUCache<string, string>(
  {
    max: 512,
  },
)

export function wxs({ configService, wxmlService }: CompilerContext): Plugin[] {
  const wxsPathSet = new Set<string>()
  function handleWxsDeps(this: PluginContext, deps: WxmlDep[], absPath: string) {
    for (const wxsDep of deps.filter(x => x.tagName === 'wxs')) {
      // only ts and js
      if (jsExtensions.includes(wxsDep.attrs.lang) || /\.wxs\.[jt]s$/.test(wxsDep.value)) {
        const wxsPath = path.resolve(path.dirname(absPath), wxsDep.value)
        this.addWatchFile(wxsPath)
        wxsPathSet.add(wxsPath)
      }
    }
  }

  async function emitWxsDeps(this: PluginContext, wxsPath: string) {
    if (await fs.exists(wxsPath)) {
      const rawCode = await fs.readFile(wxsPath, 'utf8')
      let code = wxsCodeCache.get(rawCode)
      if (!code) {
        const res = transformWxsCode(rawCode, {
          filename: wxsPath,
        })
        if (res?.code) {
          code = res.code
        }
      }

      if (code) {
        this.emitFile({
          type: 'asset',
          fileName: configService.relativeAbsoluteSrcRoot(removeExtension(wxsPath)),
          source: code,
        })
        wxsCodeCache.set(rawCode, code)
      }
    }
  }

  return [
    {
      name: 'weapp-vite:wxs',
      enforce: 'pre',

      async buildEnd() {
        for (const [id, token] of wxmlService.tokenMap.entries()) {
          handleWxsDeps.call(this, token.deps, id)
        }

        await Promise.all(
          [...wxsPathSet].map(
            (x) => {
              return emitWxsDeps
                .call(this, x)
            },
          ),
        )
      },
    },
  ]
}
