import type { OutputOptions } from 'rolldown'
import type { Plugin } from 'vite'
import type { SubpackageNamingContext } from './ownership'
import { assertBundleAssetAccess } from './access'
import { createDeferredDependencyAssets } from './deferredAssets'
import { assertAssetPackageAccess, resolveAssetPackage, resolveChunkPackage } from './ownership'
import { constrainIndependentAssetTemplate, expandSubpackageTemplate, hasSubpackagePlaceholder } from './template'

/** 为占位符和独立分包适配原生命名，保留 bundler 的 hash、引用及写出所有权。 */
export function createSubpackageOutputPlugin(context: SubpackageNamingContext, enableDependencyPlacement = false): Plugin {
  const deferred = enableDependencyPlacement ? createDeferredDependencyAssets(context) : undefined
  const wrapped = new WeakSet<object>()
  let usesAssetPlaceholder = false
  let base = '/'

  function wrapOutput(output: OutputOptions) {
    for (const key of ['entryFileNames', 'chunkFileNames'] as const) {
      const original = output[key]
      if ((!hasSubpackagePlaceholder(original) && typeof original !== 'function')
        || (typeof original === 'function' && wrapped.has(original))) {
        continue
      }
      const wrapper: Exclude<OutputOptions[typeof key], string | undefined> = function (this: unknown, chunk) {
        const template = typeof original === 'function' ? original.call(this, chunk) : original!
        return hasSubpackagePlaceholder(template)
          ? expandSubpackageTemplate(template, () => resolveChunkPackage(chunk, context))
          : template
      }
      wrapped.add(wrapper)
      output[key] = wrapper
    }
    const original = output.assetFileNames
    if ((hasSubpackagePlaceholder(original) || typeof original === 'function' || (context.independentRoot && typeof original === 'string'))
      && !(typeof original === 'function' && wrapped.has(original))) {
      const wrapper: Exclude<OutputOptions['assetFileNames'], string | undefined> = function (this: unknown, asset) {
        const template = typeof original === 'function' ? original.call(this, asset) : original!
        if (hasSubpackagePlaceholder(template)) {
          usesAssetPlaceholder = true
          const expanded = expandSubpackageTemplate(template, () => resolveAssetPackage(asset, context))
          if (context.independentRoot && !expanded.startsWith(`${context.independentRoot}/`)) {
            throw new Error('[weapp-vite] 独立分包的 assetFileNames 使用 [subpackage] 时，必须将其放在第一个目录段。')
          }
          return expanded
        }
        return context.independentRoot ? constrainIndependentAssetTemplate(template, context.independentRoot) : template
      }
      wrapped.add(wrapper)
      output.assetFileNames = wrapper
    }
  }

  return {
    name: 'weapp-vite:subpackage-output',
    enforce: 'post',
    buildStart() {
      usesAssetPlaceholder = false
      deferred?.buildStart()
    },
    config: {
      order: 'post',
      handler(config) {
        const build = config.build
        if (!build) {
          return
        }
        build.rolldownOptions ??= {}
        const outputs = Array.isArray(build.rolldownOptions.output)
          ? build.rolldownOptions.output
          : [build.rolldownOptions.output ?? (build.rolldownOptions.output = {})]
        for (const output of outputs) {
          if (!build.lib && hasSubpackagePlaceholder(build.assetsDir)) {
            output.assetFileNames ??= `${build.assetsDir}/[name]-[hash][extname]`
          }
          wrapOutput(output)
        }
      },
    },
    configResolved(config) {
      base = config.base
      context = { ...context, root: config.root, preserveSymlinks: config.resolve.preserveSymlinks, dependencyAssetPackages: deferred?.packages }
      deferred?.configure(config)
      const build = config.build
      const outputs = Array.isArray(build.rolldownOptions.output)
        ? build.rolldownOptions.output
        : [build.rolldownOptions.output ?? (build.rolldownOptions.output = {})]
      for (const output of outputs) {
        // CSS 在 outputOptions 之前读取资源命名函数，提前建立同一个解析入口。
        if (!build.lib && hasSubpackagePlaceholder(build.assetsDir)) {
          output.assetFileNames ??= `${build.assetsDir}/[name]-[hash][extname]`
        }
        wrapOutput(output)
      }
    },
    outputOptions: {
      order: 'post',
      handler(output) {
        usesAssetPlaceholder = false
        // Vite 在配置解析后才生成默认 entry/chunk 模板，此时再展开默认 assetsDir。
        wrapOutput(output)
        return output
      },
    },
    renderStart: deferred?.renderStart,
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        deferred?.cleanBundle(bundle)
        if (usesAssetPlaceholder) {
          assertBundleAssetAccess(bundle, context, base)
          for (const item of Object.values(bundle)) {
            if (item.type === 'asset') {
              assertAssetPackageAccess(item, context)
            }
          }
        }
      },
    },
  }
}
