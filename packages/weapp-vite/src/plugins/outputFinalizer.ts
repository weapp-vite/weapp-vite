import type { OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { changeFileExtension } from '../utils'

const PREPROCESSOR_STYLE_ASSET_RE = /\.(?:less|sass|scss|styl|stylus|pcss|postcss|sss)$/i

export function normalizePreprocessorStyleAssets(
  bundle: OutputBundle,
  styleExtension: string | undefined,
) {
  if (!styleExtension) {
    return
  }

  for (const [bundleFileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'asset') {
      continue
    }
    const fileName = output.fileName || bundleFileName
    if (!PREPROCESSOR_STYLE_ASSET_RE.test(fileName)) {
      continue
    }

    const outputFileName = changeFileExtension(fileName, styleExtension)
    if (!outputFileName || outputFileName === fileName) {
      continue
    }

    const existingOutput = bundle[outputFileName]
    delete bundle[bundleFileName]
    if (existingOutput) {
      continue
    }

    output.fileName = outputFileName
    bundle[outputFileName] = output
  }
}

export function createOutputFinalizerPlugin(ctx: CompilerContext): Plugin {
  return {
    name: 'weapp-vite:output-finalizer',
    enforce: 'post',
    generateBundle(_options, bundle) {
      normalizePreprocessorStyleAssets(
        bundle as unknown as OutputBundle,
        ctx.configService.outputExtensions?.wxss,
      )
    },
  }
}
