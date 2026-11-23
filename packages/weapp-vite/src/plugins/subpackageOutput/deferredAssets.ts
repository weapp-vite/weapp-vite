import type { EmittedAsset, OutputBundle, PluginContext } from 'rolldown'
import type { ResolvedConfig } from 'vite'
import type { SubpackageNamingContext } from './ownership'
import { createHash } from 'node:crypto'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { resolveSourcePackage } from './ownership'
import { hasSubpackagePlaceholder } from './template'
import { interceptAssetHooks } from './viteAssetHooks'

interface PendingAsset {
  asset: EmittedAsset & { source: NonNullable<EmittedAsset['source']> }
  reference: string
  placeholder: string
}

function findEntryPackages(ctx: PluginContext, modules: Iterable<string>, context: SubpackageNamingContext) {
  const queue = [...modules]
  const visited = new Set<string>()
  const owners = new Set<string>()
  while (queue.length && owners.size < 2) {
    const id = queue.pop()!
    if (visited.has(id)) {
      continue
    }
    visited.add(id)
    const info = ctx.getModuleInfo(id)
    if (!info) {
      continue
    }
    if (info.isEntry) {
      const owner = resolveSourcePackage(id, context)
      if (owner !== undefined) {
        owners.add(owner)
      }
    }
    queue.push(...info.importers, ...info.dynamicImporters)
  }
  return owners
}

/** 依赖资源没有源码目录归属，等入口图完整后再按消费者发射。 */
export function createDeferredDependencyAssets(context: SubpackageNamingContext) {
  const pending = new Map<string, PendingAsset>()
  const consumersByReference = new Map<string, Set<string>>()
  const filenames = new Map<string, string>()
  const packages = new Map<string, string>()
  const namesByPlaceholder = new Map<string, string>()
  let root: string

  function sourcePath(id: string) {
    return path.resolve(root, normalizeFsResolvedId(id))
  }

  function isDependency(id: string) {
    return /(?:^|\/)node_modules\//.test(id)
  }

  return {
    packages,
    configure(config: ResolvedConfig) {
      const output = config.build.rolldownOptions.output
      const outputs = Array.isArray(output) ? output : [output]
      if (config.command !== 'build' || config.build.watch || config.build.lib || config.build.ssr
        || (!hasSubpackagePlaceholder(config.build.assetsDir)
          && !outputs.some(item => hasSubpackagePlaceholder(item?.assetFileNames) || typeof item?.assetFileNames === 'function'))) {
        return
      }
      root = config.root
      context = { ...context, root, preserveSymlinks: config.resolve.preserveSymlinks }
      interceptAssetHooks(config.plugins, {
        emit(ctx, asset) {
          if (asset.type !== 'asset' || asset.fileName || !asset.originalFileName || asset.source === undefined) {
            return ctx.emitFile(asset)
          }
          const source = sourcePath(asset.originalFileName)
          if (!isDependency(source) || !config.assetsInclude(source)) {
            return ctx.emitFile(asset)
          }
          const existing = pending.get(source)
          if (existing) {
            return existing.reference
          }
          const key = createHash('sha256').update(path.relative(root, source)).digest('hex')
          // 等完整入口图后才向 Rolldown 提交真实字节，避免首次命名锁定包路径。
          const placeholder = `weapp-vite-asset-references/${key}`
          const reference = ctx.emitFile({ type: 'asset', fileName: placeholder, source: '' })
          pending.set(source, { asset: { ...asset, source: asset.source }, reference, placeholder })
          consumersByReference.set(reference, new Set())
          return reference
        },
        consume(reference, moduleId) {
          consumersByReference.get(reference)?.add(moduleId)
        },
        filename: reference => filenames.get(reference),
        resolvePlaceholder: fileName => namesByPlaceholder.get(fileName),
      })
    },
    buildStart() {
      pending.clear()
      consumersByReference.clear()
      filenames.clear()
      namesByPlaceholder.clear()
      packages.clear()
    },
    renderStart(this: PluginContext) {
      if (!pending.size) {
        return
      }
      filenames.clear()
      namesByPlaceholder.clear()
      packages.clear()
      const groups = new Map<string, Set<string>>()
      const assetKeys = new Map<string, string>()
      for (const [source, { asset, reference }] of pending) {
        const key = createHash('sha256').update(asset.source).digest('hex')
        assetKeys.set(source, key)
        const owners = groups.get(key) ?? new Set<string>()
        const found = findEntryPackages(this, consumersByReference.get(reference)!, context)
        for (const owner of found.size ? found : ['']) {
          owners.add(owner)
        }
        groups.set(key, owners)
      }
      for (const [source, key] of assetKeys) {
        const owners = groups.get(key)!
        packages.set(source, owners.size === 1 ? owners.values().next().value! : '')
      }
      for (const { asset, reference, placeholder } of pending.values()) {
        const final = this.getFileName(this.emitFile(asset))
        filenames.set(reference, final)
        namesByPlaceholder.set(placeholder, final)
      }
    },
    cleanBundle(bundle: OutputBundle) {
      for (const placeholder of namesByPlaceholder.keys()) {
        delete bundle[placeholder]
      }
    },
  }
}
