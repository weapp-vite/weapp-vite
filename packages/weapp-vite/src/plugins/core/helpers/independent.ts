import type { CorePluginState } from './types'

export async function flushIndependentBuilds(
  this: any,
  state: CorePluginState,
) {
  const { subPackageMeta, pendingIndependentBuilds } = state

  if (subPackageMeta || pendingIndependentBuilds.length === 0) {
    return
  }

  const outputs = await Promise.all(pendingIndependentBuilds)

  for (const { rollup } of outputs) {
    const bundleOutputs = Array.isArray(rollup?.output) ? rollup.output : []
    for (const output of bundleOutputs) {
      if (output.type === 'chunk') {
        this.emitFile({
          type: 'asset',
          source: output.code,
          fileName: output.fileName,
          name: output.name,
        })
      }
      else {
        this.emitFile({
          type: 'asset',
          source: output.source,
          fileName: output.fileName,
        })
      }
    }
  }

  state.pendingIndependentBuilds = []
}
