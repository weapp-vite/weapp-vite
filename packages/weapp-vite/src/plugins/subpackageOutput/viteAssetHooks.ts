import type { EmittedFile, PluginContext } from 'rolldown'
import type { Plugin } from 'vite'

interface AssetHooks {
  emit: (ctx: PluginContext, asset: EmittedFile) => string
  consume: (reference: string, moduleId: string) => void
  filename: (reference: string) => string | undefined
  resolvePlaceholder: (fileName: string) => string | undefined
}

function withMethods<T extends PluginContext>(ctx: T, methods: Partial<PluginContext>): T {
  return new Proxy(ctx, {
    get(target, key) {
      if (Object.hasOwn(methods, key)) {
        return methods[key as keyof PluginContext]
      }
      const value: unknown = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

type Hook<F> = F | { handler: F }

// 只记录实际含有资源引用的模块；内联资源和预处理器的 watch 依赖不参与落位。
const JS_ASSET_REFERENCE = /import\.meta\.ROLLDOWN_FILE_URL_([\w$]{22})/g
const CSS_ASSET_REFERENCE = /__VITE_ASSET__([\w$]{22})(?:_[a-f\d]{24})?__/g

function wrap<F>(hook: Hook<F> | undefined, adapt: (original: F) => F) {
  if (hook === undefined) {
    return hook
  }
  return typeof hook === 'object' && hook !== null && 'handler' in hook
    ? { ...hook, handler: adapt(hook.handler) }
    : adapt(hook as F)
}

/** 保留 Vite 的资源 URL 和元数据处理，只替换其使用的发射引用。 */
export function interceptAssetHooks(plugins: readonly Plugin[], hooks: AssetHooks) {
  const asset = plugins.find(plugin => plugin.name === 'vite:asset')
  const css = plugins.find(plugin => plugin.name === 'vite:css')
  const cssPost = plugins.find(plugin => plugin.name === 'vite:css-post')
  if (!asset?.load || !asset.renderChunk || !asset.resolveFileUrl || !css?.transform || !cssPost?.renderChunk || !cssPost.generateBundle) {
    return
  }
  const withFileNames = <T extends PluginContext>(ctx: T) => withMethods(ctx, {
    getFileName: reference => hooks.filename(reference) ?? ctx.getFileName(reference),
  })
  asset.load = wrap(asset.load, original => async function (...args) {
    const result = await original.apply(withMethods(this, { emitFile: file => hooks.emit(this, file) }), args)
    const code = typeof result === 'string' ? result : result?.code
    for (const match of code?.matchAll(JS_ASSET_REFERENCE) ?? []) {
      hooks.consume(match[1]!, args[0])
    }
    return result
  })
  css.transform = wrap(css.transform, original => async function (...args) {
    const result = await original.apply(withMethods(this, { emitFile: file => hooks.emit(this, file) }), args)
    const code = typeof result === 'string' ? result : result && result.code
    for (const match of code?.toString().matchAll(CSS_ASSET_REFERENCE) ?? []) {
      hooks.consume(match[1]!, args[1])
    }
    return result
  })
  asset.renderChunk = wrap(asset.renderChunk, original => function (...args) {
    return original.apply(withFileNames(this), args)
  })
  asset.resolveFileUrl = wrap(asset.resolveFileUrl, original => function (args) {
    const fileName = hooks.resolvePlaceholder(args.fileName)
    return original.call(this, fileName ? { ...args, fileName } : args)
  })
  for (const plugin of [cssPost, plugins.find(item => item.name === 'weapp-vite:css')]) {
    if (plugin) {
      plugin.renderChunk = wrap(plugin.renderChunk, original => function (...args) {
        return original.apply(withFileNames(this), args)
      })
      plugin.generateBundle = wrap(plugin.generateBundle, original => function (...args) {
        return original.apply(withFileNames(this), args)
      })
    }
  }
}
