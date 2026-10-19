import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { HmrPreparationObservation } from './preparationProfile'
import type { StatefulHmrDevEngineBatch } from './viteAdapter'
import { Buffer } from 'node:buffer'
import { HmrPreparationCleanupError } from '@weapp-vite/hmr'
import { withTailwindSnapshotGeneration } from '../../plugins/tailwindcss/generation'
import { requiresImportedTailwindSnapshot, withImportedTailwindSnapshot } from '../../plugins/tailwindcss/importedPreparation'
import { resolveOutputExtensions } from '../../utils/outputExtensions'
import { createStatefulHmrPatchImportResolver } from './patchModule'
import { bundleHmrCode, prepareHmrPatch } from './patchPreparation'
import { createHmrPreparationProfiler } from './preparationProfile'

interface CompileHmrBatchOptions {
  ctx: CompilerContext
  input: WeappCompilerHmrRequest
  needsSnapshot: boolean
  patches: StatefulHmrDevEngineBatch['updates']
  prepareProviders: () => Promise<WeappCompilerHmrPreparation[]>
  rebuild: (files: string[], sources?: ReadonlyMap<string, string | null>) => Promise<StatefulHmrSnapshot>
  sourcemap: boolean
  mergeCompilerStyles?: boolean
  onPreparationStage?: (observation: HmrPreparationObservation) => void
}

/** 将固定输入编译成待交付结果，不推进磁盘或客户端状态。 */
export async function compileHmrBatch(options: CompileHmrBatchOptions) {
  const { ctx, input, patches, prepareProviders, rebuild, sourcemap, onPreparationStage } = options
  const files = [...input.changedFiles]
  const profile = createHmrPreparationProfiler(onPreparationStage)
  let preparations: WeappCompilerHmrPreparation[]
  profile?.begin('provider-wait')
  try {
    preparations = await prepareProviders()
    profile?.finish()
  }
  catch (error) {
    profile?.finish('rejected', error)
    throw error
  }
  let disposal: Promise<void> | undefined
  let disposalFailures: unknown[] = []
  const dispose = () => {
    disposal ??= Promise.allSettled(preparations.map(preparation => Promise.resolve().then(() => preparation.dispose?.()))).then((results) => {
      disposalFailures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
      if (disposalFailures.length === 1) {
        throw disposalFailures[0]
      }
      if (disposalFailures.length > 1) {
        throw new AggregateError(disposalFailures, 'HMR preparation disposal failed', { cause: disposalFailures[0] })
      }
    })
    return disposal
  }
  try {
    const needsSnapshot = options.needsSnapshot || requiresImportedTailwindSnapshot(preparations)
    const compilerAssets = preparations.flatMap(preparation => preparation.assets ?? [])
    const styleExtension = compilerAssets.length
      ? resolveOutputExtensions(ctx.configService.outputExtensions).styleExtension
      : undefined
    const publishedCompilerAssets = options.mergeCompilerStyles === false && styleExtension
      ? compilerAssets.filter(asset => !asset.fileName.endsWith(`.${styleExtension}`))
      : compilerAssets
    if (needsSnapshot) {
      profile?.begin('snapshot-build')
    }
    const builtSnapshot = needsSnapshot
      ? await withImportedTailwindSnapshot(preparations, () => withTailwindSnapshotGeneration(input, preparations, () => input.sources.size ? rebuild(files, input.sources) : rebuild(files)), input.sources)
      : undefined
    profile?.finish()
    // 原生输出可能仅暴露 getter；批次转换使用自己的容器，保留构建器快照。
    const snapshot = builtSnapshot ? { ...builtSnapshot, output: [...builtSnapshot.output] } : undefined
    if (snapshot && publishedCompilerAssets.length && options.mergeCompilerStyles !== false && styleExtension) {
      const snapshotFileNames = new Set(snapshot.output.map(asset => asset.fileName))
      const styles = publishedCompilerAssets.filter(asset => asset.fileName.endsWith(`.${styleExtension}`) && !snapshotFileNames.has(asset.fileName))
      if (styles.length) {
        snapshot.output = [
          ...snapshot.output,
          ...styles.map(asset => ({ type: 'asset' as const, fileName: asset.fileName, source: asset.code })),
        ]
      }
    }
    if (snapshot) {
      profile?.begin('template-transform')
      const extension = resolveOutputExtensions(ctx.configService.outputExtensions).templateExtension
      for (const [index, asset] of snapshot.output.entries()) {
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
        snapshot.output[index] = { ...asset, type: 'asset', fileName: asset.fileName, source: code }
      }
      profile?.finish()
    }
    const transformed: Awaited<ReturnType<typeof prepareHmrPatch>>[] = []
    const changedIds: string[] = []
    const filenames: string[] = []
    profile?.begin('patch-prepare')
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
    profile?.finish()
    const code = bundleHmrCode(transformed)
    return { compilerAssets: publishedCompilerAssets, snapshot, code, changedIds, filenames, dispose }
  }
  catch (error) {
    profile?.finish('rejected', error)
    try {
      await dispose()
    }
    catch {
      throw new HmrPreparationCleanupError(error, disposalFailures)
    }
    throw error
  }
}
