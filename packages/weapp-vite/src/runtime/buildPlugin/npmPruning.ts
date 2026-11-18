import type { OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { prepareNpmAssets } from '../../vite/npm'
import { publishOwnedNpmAssets } from '../../vite/npm/ownership'
import { pruneNpmOutput } from '../../vite/npm/prune'
import { isBundlerDiagnosticAsset } from './outputBoundary'

export const WEAPP_VITE_NPM_PRUNING_PLUGIN_NAME = 'weapp-vite:npm-pruning'

function bundleWithIndependentOutputs(ctx: CompilerContext, bundle: OutputBundle): OutputBundle {
  const independentOutputs = ctx.runtimeState.build.independent.outputs
  if (!independentOutputs.size) {
    return bundle
  }

  const result = { ...bundle }
  for (const output of independentOutputs.values()) {
    for (const item of output.output) {
      if (isBundlerDiagnosticAsset(item)) {
        continue
      }
      result[item.fileName] = item
    }
  }
  return result
}

/** 生产 CLI 构建在最终 bundle 可见后生成、裁剪并发布 npm 产物。 */
export function createNpmPruningPlugin(ctx: CompilerContext): Plugin {
  let dependencies: Awaited<ReturnType<typeof prepareNpmAssets>> | undefined

  return {
    name: WEAPP_VITE_NPM_PRUNING_PLUGIN_NAME,
    enforce: 'post',
    buildStart: {
      order: 'pre',
      async handler() {
        dependencies = await prepareNpmAssets(ctx)
        for (const file of dependencies.watchFiles) {
          this.addWatchFile(file)
        }
      },
    },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        dependencies ??= await prepareNpmAssets(ctx)
        const npmConfig = ctx.configService.weappViteConfig.npm
        pruneNpmOutput(dependencies, bundleWithIndependentOutputs(ctx, bundle as unknown as OutputBundle), {
          enabled: npmConfig?.pruneUnusedFiles,
          packageFiles: npmConfig?.packageFiles,
        })
        for (const asset of dependencies.assets) {
          this.emitFile(asset)
        }
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        if (dependencies) {
          await publishOwnedNpmAssets(
            ctx.configService.cwd,
            ctx.configService.outDir,
            dependencies.external,
          )
        }
      },
    },
  }
}
