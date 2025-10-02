import type { OutputAsset, OutputBundle } from 'rollup'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { objectHash } from '@weapp-core/shared'
import { LRUCache } from 'lru-cache'
import { cssPostProcess } from '../postcss'
import { changeFileExtension, isJsOrTs } from '../utils'

export const cssCodeCache = new LRUCache<string, string>({
  max: 512,
})

export function css({ configService }: CompilerContext): Plugin[] {
  return [
    {
      name: 'weapp-vite:css',
      enforce: 'pre',
      async generateBundle(_opts, bundle) {
        const tasks = Object.entries(bundle).map(([bundleKey, asset]) => {
          return handleBundleEntry.call(this, bundle, bundleKey, asset, configService)
        })

        await Promise.all(tasks)
      },
    },
  ]
}

async function handleBundleEntry(
  this: any,
  bundle: OutputBundle,
  bundleKey: string,
  asset: OutputAsset | OutputBundle[string],
  configService: CompilerContext['configService'],
) {
  if (asset.type !== 'asset' || !bundleKey.endsWith('.css')) {
    return
  }

  if (!asset.originalFileNames) {
    delete bundle[bundleKey]
    return
  }

  await Promise.all(
    asset.originalFileNames.map(async (originalFileName) => {
      if (!isJsOrTs(originalFileName)) {
        return
      }

      const fileName = configService.relativeSrcRoot(
        changeFileExtension(originalFileName, configService.outputExtensions.wxss),
      )
      const rawCss = asset.source.toString()
      const cacheKey = objectHash({
        code: rawCss,
        options: { platform: configService.platform },
      })

      let css = cssCodeCache.get(cacheKey)
      if (!css) {
        css = await cssPostProcess(rawCss, { platform: configService.platform })
        cssCodeCache.set(cacheKey, css)
      }

      this.emitFile({
        type: 'asset',
        fileName,
        source: css,
      })
    }),
  )

  delete bundle[bundleKey]
}
