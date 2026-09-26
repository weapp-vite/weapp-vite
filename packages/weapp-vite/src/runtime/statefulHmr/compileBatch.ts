import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrDevEngineBatch } from './viteAdapter'
import { Buffer } from 'node:buffer'
import { resolveOutputExtensions } from '../../utils/outputExtensions'
import { createStatefulHmrPatchImportResolver } from './patchModule'
import { bundleHmrCode, prepareHmrPatch } from './patchPreparation'

interface CompileHmrBatchOptions {
  ctx: CompilerContext
  input: WeappCompilerHmrRequest
  needsSnapshot: boolean
  patches: StatefulHmrDevEngineBatch['updates']
  prepareProviders: () => Promise<WeappCompilerHmrPreparation[]>
  rebuild: (files: string[], sources?: ReadonlyMap<string, string | null>) => Promise<StatefulHmrSnapshot>
  sourcemap: boolean
}

/** 将固定输入编译成待交付结果，不推进磁盘或客户端状态。 */
export async function compileHmrBatch(options: CompileHmrBatchOptions) {
  const { ctx, input, needsSnapshot, patches, prepareProviders, rebuild, sourcemap } = options
  const files = [...input.changedFiles]
  const preparations = await prepareProviders()
  let disposed = false
  const dispose = async () => {
    if (disposed) {
      return
    }
    disposed = true
    await Promise.allSettled(preparations.map(preparation => preparation.dispose?.()))
  }
  try {
    const compilerAssets = preparations.flatMap(preparation => preparation.assets ?? [])
    const snapshot = needsSnapshot ? await (input.sources.size ? rebuild(files, input.sources) : rebuild(files)) : undefined
    if (snapshot && compilerAssets.length) {
      const styleExtension = resolveOutputExtensions(ctx.configService.outputExtensions).styleExtension
      const styles = compilerAssets.filter(asset => asset.fileName.endsWith(`.${styleExtension}`))
      snapshot.output = [
        ...snapshot.output.filter(asset => !styles.some(style => style.fileName === asset.fileName)),
        ...styles.map(asset => ({ type: 'asset' as const, fileName: asset.fileName, source: asset.code })),
      ]
    }
    if (snapshot) {
      const extension = resolveOutputExtensions(ctx.configService.outputExtensions).templateExtension
      for (const asset of snapshot.output) {
        if (asset.type !== 'asset' || !asset.fileName.endsWith(`.${extension}`)) {
          continue
        }
        let code = Buffer.from(asset.source).toString('utf8')
        for (const preparation of preparations) {
          const result = await preparation.transformTemplate?.({ fileName: asset.fileName, code })
          if (result) {
            code = result.code
          }
        }
        asset.source = code
      }
    }
    const transformed: Awaited<ReturnType<typeof prepareHmrPatch>>[] = []
    const changedIds: string[] = []
    const filenames: string[] = []
    for (const { update } of patches) {
      if (update.type !== 'Patch') {
        continue
      }
      transformed.push(await prepareHmrPatch(update, preparations, {
        filename: update.filename,
        resolveImport: createStatefulHmrPatchImportResolver(ctx, update.filename),
      }, sourcemap))
      changedIds.push(...update.changedIds ?? [])
      filenames.push(update.filename)
    }
    const code = bundleHmrCode(transformed)
    return { compilerAssets, snapshot, code, changedIds, filenames, dispose }
  }
  catch (error) {
    await dispose()
    throw error
  }
}
