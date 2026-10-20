import type { RawPlugin, RawVueCompilerOptions, VueLanguagePlugin } from '@vue/language-core'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function resolveAdapter() {
  const modulePath = require.resolve('weapp-vite/volar')
  const implementationPath = createRequire(modulePath).resolve('@weapp-vite/volar')
  return { modulePath, implementationPath }
}

export function resolveVueTscVolarPlugins(options: RawVueCompilerOptions, cwd: string) {
  const plugins = options.plugins?.map((plugin): RawPlugin => {
    const name = typeof plugin === 'string' ? plugin : plugin.name
    const modulePath = require.resolve(name, { paths: [cwd] })
    return typeof plugin === 'string' ? modulePath : { ...plugin, name: modulePath }
  })
  if (options.lib !== 'wevu') {
    return plugins
  }

  const { modulePath, implementationPath } = resolveAdapter()
  const normalized = (plugins ?? []).map((plugin) => {
    const name = typeof plugin === 'string' ? plugin : plugin.name
    if (name !== implementationPath) {
      return plugin
    }
    return typeof plugin === 'string' ? modulePath : { ...plugin, name: modulePath }
  })
  let registered = false
  const resolved = normalized.filter((plugin) => {
    if ((typeof plugin === 'string' ? plugin : plugin.name) !== modulePath) {
      return true
    }
    if (registered) {
      return false
    }
    registered = true
    return true
  })
  if (!registered) {
    resolved.push(modulePath)
  }
  return resolved
}

export function resolveInternalVolarPlugins(plugins: VueLanguagePlugin[], lib: string) {
  if (lib !== 'wevu') {
    return plugins
  }
  const { modulePath } = resolveAdapter()
  const factory = require(modulePath) as VueLanguagePlugin
  let registered = false
  const resolved = plugins.filter((plugin) => {
    if (plugin !== factory) {
      return true
    }
    if (registered) {
      return false
    }
    registered = true
    return true
  })
  if (!registered) {
    resolved.push(factory)
  }
  return resolved
}
