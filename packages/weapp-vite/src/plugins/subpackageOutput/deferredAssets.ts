import type { EmittedAsset, OutputBundle, PluginContext } from 'rolldown'
import type { ResolvedConfig } from 'vite'
import type { SubpackageNamingContext } from './ownership'
import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { findLocalImageReferences } from '../outputFinalizer/templateImages'
import { outputPackage } from './access'
import { resolveSourcePackage } from './ownership'
import { hasSubpackagePlaceholder } from './template'
import { interceptAssetHooks } from './viteAssetHooks'

interface PendingAsset {
  asset: EmittedAsset & { source: NonNullable<EmittedAsset['source']> }
  reference: string
  placeholder: string
}

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
export function createDeferredAssets(context: SubpackageNamingContext, templates: () => ReadonlyMap<string, string>) {
  const pending = new Map<string, PendingAsset>()
  const consumersByReference = new Map<string, Set<string>>()
  const filenames = new Map<string, string>()
  const packages = new Map<string, string>()
  const namesByPlaceholder = new Map<string, string>()
  let root: string
  let publicDir: string | false

  function sourcePath(id: string) {
    return path.resolve(root, normalizeFsResolvedId(id))
  }

  async function collectTemplatePackages() {
    const referenced = new Map<string, Set<string>>()
    for (const [fileName, code] of templates()) {
      let owner: string | undefined
      for (const { relative } of findLocalImageReferences(code, fileName)) {
        const source = sourcePath(path.join(context.srcRoot, relative))
        if (pending.has(source)) {
          const owners = referenced.get(relative) ?? new Set<string>()
          owners.add(owner ??= outputPackage(fileName, context))
          referenced.set(relative, owners)
        }
      }
    }
    const publicRoot = publicDir
    const bySource = new Map<string, Set<string>>()
    await Promise.all([...referenced].map(async ([relative, owners]) => {
      if (!publicRoot || !(await stat(path.join(publicRoot, relative), { throwIfNoEntry: false }))?.isFile()) {
        bySource.set(sourcePath(path.join(context.srcRoot, relative)), owners)
      }
    }))
    return bySource
  }

  return {
    packages,
    configure(config: ResolvedConfig) {
      const output = config.build.rolldownOptions.output
      const outputs = Array.isArray(output) ? output : [output]
      if (config.command !== 'build' || config.build.lib || config.build.ssr
        || (!hasSubpackagePlaceholder(config.build.assetsDir)
          && !outputs.some(item => hasSubpackagePlaceholder(item?.assetFileNames) || typeof item?.assetFileNames === 'function'))) {
        return
      }
      root = config.root
      publicDir = config.publicDir || false
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
      const templatePackages = await collectTemplatePackages()
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
        for (const owner of templatePackages.get(source) ?? []) {
          found.add(owner)
        }
        for (const owner of found.size ? found : [resolveSourcePackage(source, context) ?? '']) {
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
