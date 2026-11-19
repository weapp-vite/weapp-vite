import type { OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { PreparedNpmOutput } from '../../vite/npm'
import path from 'pathe'
import { prepareNpmAssets } from '../../vite/npm'
import { publishOwnedNpmAssets } from '../../vite/npm/ownership'
import { pruneNpmOutput } from '../../vite/npm/prune'
import { isNpmPublicationEnabled } from './npmPublication'
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

/** 生产 CLI 构建统一发布 npm 产物，引用裁剪仅作为可选的生成阶段。 */
export function createNpmPruningPlugin(ctx: CompilerContext): Plugin {
  let dependencies: PreparedNpmOutput | undefined
  const outputs = new Map<string, PreparedNpmOutput>()

  const release = () => {
    dependencies = undefined
    outputs.clear()
  }

  return {
    name: WEAPP_VITE_NPM_PRUNING_PLUGIN_NAME,
    enforce: 'post',
    buildStart: {
      order: 'pre',
      async handler() {
        release()
        if (!isNpmPublicationEnabled(ctx)) {
          return
        }
        dependencies = await prepareNpmAssets(ctx)
        for (const file of dependencies.watchFiles) {
          this.addWatchFile(file)
        }
      },
    },
    generateBundle: {
      order: 'post',
      async handler(options, bundle) {
        if (!isNpmPublicationEnabled(ctx)) {
          return
        }
        dependencies ??= await prepareNpmAssets(ctx)
        const output: PreparedNpmOutput = {
          ...dependencies,
          assets: [...dependencies.assets],
          external: new Map([...dependencies.external].map(([directory, assets]) => [directory, [...assets]])),
        }
        const npmConfig = ctx.configService.weappViteConfig.npm
        pruneNpmOutput(output, bundleWithIndependentOutputs(ctx, bundle as unknown as OutputBundle), {
          enabled: npmConfig?.pruneUnusedFiles,
          packageFiles: npmConfig?.packageFiles,
        })
        for (const asset of output.assets) {
          this.emitFile(asset)
        }
        outputs.set(path.resolve(options.dir ?? ctx.configService.outDir), output)
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler(options) {
        const outDir = path.resolve(options.dir ?? ctx.configService.outDir)
        const output = outputs.get(outDir)
        if (output) {
          await publishOwnedNpmAssets(
            ctx.configService.cwd,
            outDir,
            output.external,
          )
        }
      },
    },
    buildEnd(error) {
      if (error) {
        release()
      }
    },
    closeBundle: { order: 'post', handler: release },
  }
}
