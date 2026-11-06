import assert from 'node:assert/strict'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { vi } from 'vitest'
import { taroHarmonyRunner } from '../taroHarmony'

interface LoaderMeta {
  creator?: string
  creatorLocation?: string
  modifyInstantiate?: (source: string) => string
}

interface MiniOptions {
  combination: { config: { buildAdapter: string } }
  loaderMeta?: LoaderMeta
}

interface PluginInstance {
  dependencies: Map<unknown, unknown>
  options: MiniOptions
  apply: () => void
}

type PluginConstructor = new (options: MiniOptions) => PluginInstance
type PluginArgs = [MiniOptions]

class PluginDefinition {
  constructor(private Plugin: PluginConstructor, private args: PluginArgs) {}
  get(key: 'plugin'): PluginConstructor
  get(key: 'args'): PluginArgs
  get(key: 'plugin' | 'args') { return key === 'plugin' ? this.Plugin : this.args }
  use(pluginConstructor: PluginConstructor, args: PluginArgs) {
    this.Plugin = pluginConstructor
    this.args = args
    return this
  }

  tap(fn: (args: PluginArgs) => PluginArgs) {
    this.args = fn(this.args)
    return this
  }

  instantiate() { return new this.Plugin(...this.args) }
}

class Chain {
  plugins = new Map<string, PluginDefinition>()
  mode = 'development'
  constructor(private pluginConstructor: PluginConstructor) {}
  get(_key: 'mode') { return this.mode }
  plugin(name: string) {
    if (!this.plugins.has(name)) {
      this.plugins.set(name, new PluginDefinition(this.pluginConstructor, [{ combination: { config: { buildAdapter: 'harmony' } } }]))
    }
    return this.plugins.get(name)!
  }

  toConfig() { return { plugins: [...this.plugins.values()].map(plugin => plugin.instantiate()) } }
}

interface RunnerConfig {
  buildAdapter: string
  framework: string
  fileType: { templ: string }
  mode: string
  isWatch: boolean
  modifyWebpackChain: (chain: Chain, webpack: object, data: object) => Promise<void>
  onWebpackChainReady?: (chain: Chain) => void
  onCompilerMake: (compilation: object, compiler: object, plugin: PluginInstance) => Promise<unknown>
}

export function runnerHarness(options: { version?: string, environment?: Record<string, string> } = {}) {
  const applied = vi.fn()
  class MiniPlugin {
    dependencies = new Map<unknown, unknown>()
    constructor(public options: MiniOptions) {}
    apply = applied
  }
  class SingleEntryDependency {
    constructor(public request: string, public name: string, public miniType: string) {}
  }
  const META_TYPE = { STATIC: 'STATIC', PAGE: 'PAGE' }
  const chain = new Chain(MiniPlugin)
  const args = chain.plugin('miniPlugin').get('args')
  const webpack = { officialWebpack: true }
  const data = { componentConfig: {} }
  const result = { officialStats: true }
  const appPath = path.resolve('controlled-project')
  const environment = { NODE_ENV: 'development', CORPUS_BUILD_MODE: 'development', ...(options.environment ?? { TARO_ENV: 'harmony', TARO_PLATFORM: 'harmony' }) }
  const report = vi.fn()
  const runner = vi.fn(async (_appPath: string, config: RunnerConfig) => {
    chain.mode = config.mode
    await config.modifyWebpackChain(chain, webpack, data)
    config.onWebpackChainReady!(chain)
    for (const plugin of chain.toConfig().plugins) {
      plugin.apply()
    }
    return result
  })
  const module = { exports: undefined as unknown as (appPath: string, config: RunnerConfig) => Promise<typeof result> }
  const requireModule = (name: string) => {
    if (name === 'node:assert/strict') {
      return assert
    }
    if (name === 'node:process') {
      return { env: environment }
    }
    if (name.endsWith('/package.json')) {
      return { version: options.version ?? '4.3.2' }
    }
    if (name === '@tarojs/webpack5-runner/dist/index.mini.js') {
      return { default: runner }
    }
    if (name === '@tarojs/webpack5-runner/dist/plugins/MiniPlugin.js') {
      return { default: MiniPlugin }
    }
    if (name === '@tarojs/webpack5-runner/dist/dependencies/TaroSingleEntryDependency.js') {
      return { default: SingleEntryDependency }
    }
    if (name === '@tarojs/helper') {
      return { META_TYPE }
    }
    throw new Error(`Unexpected compiler dependency: ${name}`)
  }
  runInNewContext(taroHarmonyRunner, { Map, require: requireModule, module, process: { env: environment }, console: { log: report } })
  const config: RunnerConfig = {
    buildAdapter: 'harmony',
    framework: 'react',
    fileType: { templ: '.hml' },
    mode: 'development',
    isWatch: false,
    modifyWebpackChain: async () => {},
    onCompilerMake: async () => {},
  }
  return { MiniPlugin, SingleEntryDependency, META_TYPE, chain, args, webpack, data, result, runner, applied, appPath, config, environment, report, run: () => module.exports(appPath, config) }
}

export function frameworkHook(chain: Chain) {
  return chain.plugin('mainPlugin').tap((args) => {
    args[0].loaderMeta ||= {}
    Object.assign(args[0].loaderMeta, { creator: 'createReactApp', creatorLocation: '@tarojs/plugin-framework-react/dist/runtime' })
    return args
  })
}

export function platformHook(chain: Chain) {
  return chain.plugin('miniPlugin').tap((args) => {
    args[0].loaderMeta!.modifyInstantiate = source => source.replace('var inst = App(createApp(', 'export default (createApp.bind(null, ')
    return args
  })
}
