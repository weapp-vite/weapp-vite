import type { OutputOptions } from 'rolldown'
import type { Plugin } from 'vite'
import type { SubpackageNamingContext } from './ownership'
import { assertAssetPackageAccess, resolveAssetPackage, resolveChunkPackage } from './ownership'
import { expandSubpackageTemplate, hasSubpackagePlaceholder } from './template'

/** 仅在用户选择分包占位符时适配原生命名，保留 bundler 的 hash、引用及写出所有权。 */
export function createSubpackageOutputPlugin(context: SubpackageNamingContext): Plugin {
  const wrapped = new WeakSet<object>()
  let usesAssetPlaceholder = false

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
    if ((hasSubpackagePlaceholder(original) || typeof original === 'function')
      && !(typeof original === 'function' && wrapped.has(original))) {
      const wrapper: Exclude<OutputOptions['assetFileNames'], string | undefined> = function (this: unknown, asset) {
        const template = typeof original === 'function' ? original.call(this, asset) : original!
        if (hasSubpackagePlaceholder(template)) {
          usesAssetPlaceholder = true
          return expandSubpackageTemplate(template, () => resolveAssetPackage(asset, context))
        }
        return template
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
      context = { ...context, root: config.root, preserveSymlinks: config.resolve.preserveSymlinks }
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
        // Vite 在配置解析后才生成默认 entry/chunk 模板，此时再展开默认 assetsDir。
        wrapOutput(output)
        return output
      },
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        if (usesAssetPlaceholder) {
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
