import type { Plugin, PluginOption } from 'vite'

const ownedPlugins = new WeakSet<object>()
const ownedPromises = new WeakSet<object>()
const hookNames = new Set([
  'options',
  'buildStart',
  'buildEnd',
  'renderStart',
  'renderError',
  'renderChunk',
  'writeBundle',
  'generateBundle',
  'banner',
  'footer',
  'augmentChunkHash',
  'outputOptions',
  'resolveFileUrl',
  'intro',
  'outro',
  'closeBundle',
  'closeWatcher',
  'load',
  'moduleParsed',
  'watchChange',
  'resolveDynamicImport',
  'resolveId',
  'transform',
  'shouldTransformCachedModule',
  'onLog',
  'apply',
  'applyToEnvironment',
  'config',
  'configEnvironment',
  'configResolved',
  'configureServer',
  'configurePreviewServer',
  'closeServer',
  'closePreviewServer',
  'handleHotUpdate',
  'hotUpdate',
  'transformIndexHtml',
  'buildApp',
])

function isPromise(value: object): value is PromiseLike<PluginOption> {
  return 'then' in value && typeof value.then === 'function'
}

/** 仅由内部工厂声明插件所有权，第三方插件不按名称或结构推断。 */
export function markOwnedPlugin<T extends Plugin>(plugin: T): T {
  ownedPlugins.add(plugin)
  return plugin
}

/** 保留工厂返回值身份；异步工厂的结果在生成本轮插件时登记。 */
export function markOwnedPlugins<T extends PluginOption | PluginOption[]>(plugins: T): T {
  if (Array.isArray(plugins)) {
    for (const plugin of plugins) {
      markOwnedPlugins(plugin)
    }
  }
  else if (plugins && typeof plugins === 'object') {
    if (isPromise(plugins)) {
      ownedPromises.add(plugins)
    }
    else {
      markOwnedPlugin(plugins)
    }
  }
  return plugins
}

function copyHookFunction(handler: (...args: any[]) => unknown) {
  const copy = function (this: unknown, ...args: unknown[]) {
    return Reflect.apply(handler, this, args)
  }
  const descriptors = Object.getOwnPropertyDescriptors(handler)
  // 普通包装函数自己的内建属性不能由另一种函数的不可配置描述符覆盖。
  for (const key of ['arguments', 'caller', 'prototype']) {
    delete descriptors[key]
  }
  Object.defineProperties(copy, descriptors)
  return copy
}

/** 一代共用去重表；只复制自有插件和 hook 容器，闭包、api 与元数据值仍由原所有者维护。 */
export function createOwnedPluginGeneration() {
  const plugins = new WeakMap<object, unknown>()
  const hooks = new WeakMap<object, unknown>()

  function copyHook(hook: unknown): unknown {
    if (!hook || (typeof hook !== 'object' && typeof hook !== 'function')) {
      return hook
    }
    if (hooks.has(hook)) {
      return hooks.get(hook)
    }
    if (typeof hook === 'function') {
      const copy = copyHookFunction(hook as (...args: any[]) => unknown)
      hooks.set(hook, copy)
      return copy
    }
    if (!('handler' in hook)) {
      return hook
    }
    const copy = Object.create(Object.getPrototypeOf(hook))
    hooks.set(hook, copy)
    const descriptors = Object.getOwnPropertyDescriptors(hook)
    if (descriptors.handler && 'value' in descriptors.handler) {
      descriptors.handler.value = copyHook(descriptors.handler.value)
    }
    else if (descriptors.handler?.get) {
      const getter = descriptors.handler.get
      descriptors.handler.get = function () {
        return copyHook(Reflect.apply(getter, this, []))
      }
    }
    Object.defineProperties(copy, descriptors)
    return copy
  }

  function copyOption(option: unknown): unknown {
    if (!option || typeof option !== 'object') {
      return option
    }
    if (plugins.has(option)) {
      return plugins.get(option)
    }
    if (Array.isArray(option)) {
      const items = option.map(copyOption)
      const copy = items.every((item, index) => item === option[index]) ? option : items
      plugins.set(option, copy)
      return copy
    }
    if (isPromise(option)) {
      const copy = Promise.resolve(option).then((resolved) => {
        if (ownedPromises.has(option)) {
          markOwnedPlugins(resolved)
        }
        return copyOption(resolved)
      })
      plugins.set(option, copy)
      return copy
    }
    if (!ownedPlugins.has(option)) {
      return option
    }
    const copy = Object.create(Object.getPrototypeOf(option))
    plugins.set(option, copy)
    ownedPlugins.add(copy)
    const descriptors = Object.getOwnPropertyDescriptors(option)
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (!hookNames.has(name)) {
        continue
      }
      if ('value' in descriptor) {
        descriptor.value = copyHook(descriptor.value)
      }
      else if (descriptor.get) {
        const getter = descriptor.get
        descriptor.get = function () {
          return copyHook(Reflect.apply(getter, this, []))
        }
      }
    }
    Object.defineProperties(copy, descriptors)
    return copy
  }

  return <T>(options: T): T => copyOption(options) as T
}
