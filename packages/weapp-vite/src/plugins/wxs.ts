import type { CompilerContext } from '@/context'
import type { WxmlDep } from '@/types'
import type { PluginContext } from 'rollup'
import type { Plugin } from 'vite'
import { jsExtensions } from '@/constants'
import { transformWxsCode } from '@/wxs'
import { removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'

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
      const code = await fs.readFile(wxsPath, 'utf8')
      const res = transformWxsCode(code, {
        filename: wxsPath,
      })
      if (res?.code) {
        this.emitFile({
          type: 'asset',
          fileName: configService.relativeAbsoluteSrcRoot(removeExtension(wxsPath)),
          source: res.code,
        })
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
          wxsPathSet.values().map((x) => {
            return emitWxsDeps.call(this, x)
          }),
        )
      },
    },
  ]
}
