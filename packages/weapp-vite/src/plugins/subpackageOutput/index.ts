import type { OutputOptions } from 'rolldown'
import type { Plugin } from 'vite'
import type { TemplateConsumers } from './deferredAssets'
import type { SubpackageNamingContext } from './ownership'
import { assertBundleAssetAccess } from './access'
import { createDeferredAssets } from './deferredAssets'
import { assertAssetPackageAccess, resolveAssetPackage, resolveAssetSourcePath, resolveChunkPackage } from './ownership'
import { constrainIndependentAssetTemplate, expandSubpackageTemplate, hasSubpackagePlaceholder } from './template'

/** 为占位符和独立分包适配原生命名，保留 bundler 的 hash、引用及写出所有权。 */
export function createSubpackageOutputPlugin(context: SubpackageNamingContext, templates?: TemplateConsumers): Plugin {
  const deferred = templates && createDeferredAssets(context, templates)
  const wrapped = new WeakSet<object>()
  const placeholderSources = new Set<string>()
  let checkConfiguredAssetPaths = false
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
          const expanded = expandSubpackageTemplate(template, () => resolveAssetPackage(asset, context))
          if (context.independentRoot && !expanded.startsWith(`${context.independentRoot}/`)) {
            throw new Error('[weapp-vite] 独立分包的 assetFileNames 使用 [subpackage] 时，必须将其放在第一个目录段。')
          }
          for (const source of asset.originalFileNames) {
            placeholderSources.add(resolveAssetSourcePath(source, context))
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
      placeholderSources.clear()
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
      context = { ...context, root: config.root, preserveSymlinks: config.resolve.preserveSymlinks, consumerAssetPackages: deferred?.packages }
      deferred?.configure(config)
      const build = config.build
      const outputs = Array.isArray(build.rolldownOptions.output)
        ? build.rolldownOptions.output
        : [build.rolldownOptions.output ?? (build.rolldownOptions.output = {})]
      checkConfiguredAssetPaths = config.command === 'build' && !build.lib && !build.ssr
        && (build.assetsDir !== '.' || outputs.some(output => output.assetFileNames !== undefined))
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
        placeholderSources.clear()
        // Vite 在配置解析后才生成默认 entry/chunk 模板，此时再展开默认 assetsDir。
        wrapOutput(output)
        return output
      },
    },
    renderStart: deferred && {
      order: 'post',
      // 原生模板在 core 的 renderStart 发射；先等待其产物缓存就绪。
      sequential: true,
      handler: deferred.renderStart,
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        deferred?.cleanBundle(bundle)
        if (placeholderSources.size || checkConfiguredAssetPaths) {
          assertBundleAssetAccess(bundle, context, base)
        }
        if (placeholderSources.size) {
          for (const item of Object.values(bundle)) {
            if (item.type === 'asset' && item.originalFileNames.some(source => placeholderSources.has(resolveAssetSourcePath(source, context)))) {
              assertAssetPackageAccess(item, context)
            }
          }
        }
      },
    },
  }
}
