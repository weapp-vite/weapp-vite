import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { objectHash } from '@weapp-core/shared'
import { LRUCache } from 'lru-cache'
import { cssPostProcess } from '../postcss'
import { changeFileExtension, isJsOrTs } from '../utils'

export const cssCodeCache = new LRUCache<string, string>(
  {
    max: 512,
  },
)

function getCacheKey(code: string, options?: any) {
  return objectHash({
    code,
    options,
  })
}

export function css({ configService }: CompilerContext): Plugin[] {
  return [
    {
      name: 'weapp-vite:css',
      enforce: 'pre',
      async generateBundle(_opts, bundle) {
        const bundleKeys = Object.keys(bundle)
        // 必须这样做，防止 css 相同的情况下，被合并
        await Promise.all(
          bundleKeys.map(async (bundleKey) => {
            const asset = bundle[bundleKey]
            if (asset.type === 'asset') {
              if (bundleKey.endsWith('.css')) {
                // 多个 js 文件 引入同一个样式的时候，此时 originalFileNames 是数组
                await Promise.all(asset.originalFileNames.map(async (originalFileName) => {
                  if (isJsOrTs(originalFileName)) {
                    const fileName = configService.relativeSrcRoot(
                      changeFileExtension(originalFileName, configService.outputExtensions.wxss),
                    )
                    const rawCss = asset.source.toString()
                    const cachekey = getCacheKey(rawCss, { platform: configService.platform })
                    let css = cssCodeCache.get(cachekey)
                    if (!css) {
                      css = await cssPostProcess(
                        rawCss,
                        { platform: configService.platform },
                      )
                      cssCodeCache.set(cachekey, css)
                    }

                    this.emitFile({
                      type: 'asset',
                      fileName,
                      source: css,
                    })
                  }
                }))

                delete bundle[bundleKey]
              }
            }
          }),
        )
      },
    },
  ]
}
