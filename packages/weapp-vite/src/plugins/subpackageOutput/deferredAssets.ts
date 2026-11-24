import type { EmittedAsset, OutputBundle, PluginContext } from 'rolldown'
import type { ResolvedConfig } from 'vite'
import type { SubpackageNamingContext } from './ownership'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { createTemplateImageSourceResolver, findLocalImageReferences, isFile } from '../outputFinalizer/templateImages'
import { outputPackage } from './access'
import { resolveSourcePackage } from './ownership'
import { mayUseSubpackageAssetNames } from './template'
import { interceptAssetHooks } from './viteAssetHooks'

interface PendingAsset {
  asset: EmittedAsset & { source: NonNullable<EmittedAsset['source']> }
  reference: string
  placeholder: string
}

export type TemplateConsumers = (plugin: PluginContext) => AsyncIterable<[string, string]> | Iterable<[string, string]>

function findEntryPackages(ctx: PluginContext, modules: Iterable<string>, entryPackage: (id: string) => string | undefined) {
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
      const owner = entryPackage(id)
      if (owner !== undefined) {
        owners.add(owner)
      }
    }
    queue.push(...info.importers, ...info.dynamicImporters)
  }
  return owners
}

/** 入口图完整后再选择 JS、样式和模板共同引用的资源的落位。 */
export function createDeferredAssets(context: SubpackageNamingContext, templates: TemplateConsumers) {
  const pending = new Map<string, PendingAsset>()
  const consumersByReference = new Map<string, Set<string>>()
  const filenames = new Map<string, string>()
  const packages = new Map<string, string>()
  const namesByPlaceholder = new Map<string, string>()
  let root: string
  let publicDir: string | false
  let assetsInclude: ResolvedConfig['assetsInclude']

  function sourcePath(id: string) {
    return path.resolve(root, normalizeFsResolvedId(id))
  }

  async function collectTemplatePackages(plugin: PluginContext, keys: Map<string, string>, groups: Map<string, Set<string>>) {
    const referenced = new Map<string, Set<string>>()
    const resolveSource = createTemplateImageSourceResolver(root, context.srcRoot, publicDir)
    for await (const [fileName, code] of templates(plugin)) {
      let owner: string | undefined
      for (const reference of findLocalImageReferences(code, fileName)) {
        const source = await resolveSource(reference)
        if (source && assetsInclude(source)) {
          const owners = referenced.get(source) ?? new Set<string>()
          owners.add(owner ??= outputPackage(fileName, context))
          referenced.set(source, owners)
        }
      }
    }
    for (const [source, owners] of referenced) {
      let key = keys.get(source)
      if (key === undefined) {
        if (!await isFile(source)) {
          continue
        }
        // 仅在模板中引用的不同源文件也可能与待发射文件同内容。
        key = createHash('sha256').update(await readFile(source)).digest('hex')
      }
      const resolved = groups.get(key)
      if (resolved) {
        for (const owner of owners) {
          resolved.add(owner)
        }
      }
    }
  }

  return {
    packages,
    configure(config: ResolvedConfig) {
      if (config.command !== 'build' || !mayUseSubpackageAssetNames(config.build)) {
        return
      }
      root = config.root
      publicDir = config.publicDir || false
      assetsInclude = config.assetsInclude
      context = { ...context, root, preserveSymlinks: config.resolve.preserveSymlinks }
      interceptAssetHooks(config.plugins, {
        emit(ctx, asset) {
          if (asset.type !== 'asset' || asset.fileName || !asset.originalFileName || asset.source === undefined) {
            return ctx.emitFile(asset)
          }
          const source = sourcePath(asset.originalFileName)
          if (!config.assetsInclude(source)) {
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
    async renderStart(this: PluginContext) {
      if (!pending.size) {
        return
      }
      filenames.clear()
      namesByPlaceholder.clear()
      packages.clear()
      const groups = new Map<string, Set<string>>()
      const assetKeys = new Map<string, string>()
      const entryPackages = new Map<string, string | undefined>()
      const entryPackage = (id: string) => {
        if (!entryPackages.has(id)) {
          entryPackages.set(id, resolveSourcePackage(id, context))
        }
        return entryPackages.get(id)
      }
      for (const [source, { asset, reference }] of pending) {
        const key = createHash('sha256').update(asset.source).digest('hex')
        assetKeys.set(source, key)
        const owners = groups.get(key) ?? new Set<string>()
        const found = findEntryPackages(this, consumersByReference.get(reference)!, entryPackage)
        for (const owner of found.size ? found : [resolveSourcePackage(source, context) ?? '']) {
          owners.add(owner)
        }
        groups.set(key, owners)
      }
      await collectTemplatePackages(this, assetKeys, groups)
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
