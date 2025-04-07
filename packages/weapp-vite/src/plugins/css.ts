import type { CompilerContext } from '@/context'
import type { Plugin } from 'vite'
import { cssPostProcess } from '@/postcss'
import { changeFileExtension, isJsOrTs } from '@/utils'

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
                    const css = await cssPostProcess(
                      asset.source.toString(),
                      { platform: configService.platform },
                    )
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
