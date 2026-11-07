import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { readFrameworkCatalog, selectFrameworkTarget } from './catalog'
import { createControlledProject, generationInputKey } from './project'
import { createTaroProject } from './taro'
import { taroHarmonyPageFiles, taroHarmonyRunner } from './taroHarmony'

import { frameworkHook, platformHook, runnerHarness } from './taroHarmony/testHarness'

describe('frozen Taro Harmony JSUI runner configuration', () => {
  it.each(['development', 'production'])('shares real options across both official hook orders in %s and applies one plugin', async (mode) => {
    for (const hooks of [[frameworkHook, platformHook], [platformHook, frameworkHook]]) {
      const harness = runnerHarness()
      const ready = vi.fn()
      harness.config.mode = mode
      harness.environment.NODE_ENV = mode
      harness.environment.CORPUS_BUILD_MODE = mode
      harness.config.onWebpackChainReady = ready
      harness.config.modifyWebpackChain = async (chain, webpack, data) => {
        expect(webpack).toBe(harness.webpack)
        expect(data).toBe(harness.data)
        expect(chain.plugin('mainPlugin').get('plugin')).toBe(chain.plugin('miniPlugin').get('plugin'))
        expect(chain.plugin('mainPlugin').get('args')).toBe(harness.args)
        // 官方 React hook 会在设置 loaderMeta 前读取完整配置；构造不等同于 apply。
        chain.toConfig()
        for (const hook of hooks) {
          hook(chain)
        }
      }
      await expect(harness.run()).resolves.toBe(harness.result)
      expect(harness.runner).toHaveBeenCalledWith(harness.appPath, expect.objectContaining({ mode, buildAdapter: 'harmony', framework: 'react', fileType: { templ: '.hml' } }))
      expect(harness.environment).toEqual({ TARO_ENV: 'harmony', TARO_PLATFORM: 'harmony', NODE_ENV: mode, CORPUS_BUILD_MODE: mode })
      expect(harness.chain.plugins.has('mainPlugin')).toBe(false)
      expect(harness.args[0].loaderMeta!.modifyInstantiate!('var inst = App(createApp(')).toBe('export default (createApp.bind(null, ')
      expect(ready).toHaveBeenCalledOnce()
      expect(harness.applied).toHaveBeenCalledOnce()
      expect(harness.chain.plugin('corpusHarmonyPageCompatibility').get('plugin')).toBe(harness.PageCompatibilityPlugin)
      expect(harness.chain.plugin('corpusHarmonyPageCompatibility').get('args')).toEqual([{ loaderMeta: harness.args[0].loaderMeta, mode }])
      expect(JSON.parse(harness.report.mock.calls[0]![0] as string)).toEqual({ event: 'template-corpus-harmony-jsui-mode', requestedMode: mode, nodeEnv: mode, runnerMode: mode, webpackMode: mode, isWatch: false })
    }
  })

  it('removes the temporary entry on dispatcher rejection and preserves the original error', async () => {
    const harness = runnerHarness()
    const error = new Error('official hook failed')
    harness.config.modifyWebpackChain = async () => {
      throw error
    }
    await expect(harness.run()).rejects.toBe(error)
    expect(harness.chain.plugins.has('mainPlugin')).toBe(false)
    expect(harness.applied).not.toHaveBeenCalled()
  })

  it.each(['arguments', 'loaderMeta'])('rejects changed %s ownership and still removes the bridge', async (change) => {
    const harness = runnerHarness()
    harness.config.modifyWebpackChain = async (chain) => {
      frameworkHook(chain)
      platformHook(chain)
      if (change === 'arguments') {
        chain.plugin('mainPlugin').tap(args => [{ ...args[0] }])
      }
      else { harness.args[0].loaderMeta = { ...harness.args[0].loaderMeta } }
    }
    await expect(harness.run()).rejects.toThrow(change === 'arguments' ? 'shared MiniPlugin arguments' : 'same loaderMeta object')
    expect(harness.chain.plugins.has('mainPlugin')).toBe(false)
    expect(harness.applied).not.toHaveBeenCalled()
  })

  it('rejects a duplicate real plugin added by a later configuration callback', async () => {
    const harness = runnerHarness()
    harness.config.modifyWebpackChain = async (chain) => {
      frameworkHook(chain)
      platformHook(chain)
    }
    harness.config.onWebpackChainReady = (chain) => {
      chain.plugin('duplicate').use(chain.plugin('miniPlugin').get('plugin'), harness.args)
    }
    await expect(harness.run()).rejects.toThrow('Exactly one official MiniPlugin')
    expect(harness.applied).not.toHaveBeenCalled()
  })

  it('rejects version, target, constructor and loader protocol drift before compilation', async () => {
    expect(() => runnerHarness({ version: '4.3.3' })).toThrow('frozen Taro 4.3.2')
    expect(() => runnerHarness({ environment: { TARO_ENV: 'weapp', TARO_PLATFORM: 'mini' } }).run()).toThrow('genuine target identity')
    const constructor = runnerHarness()
    class ForeignPlugin { dependencies = new Map(); constructor(public options: (typeof constructor.args)[0]) {} apply() {} }
    constructor.chain.plugin('miniPlugin').use(ForeignPlugin, constructor.args)
    await expect(constructor.run()).rejects.toThrow('official MiniPlugin constructor')
    const metadata = runnerHarness()
    metadata.config.modifyWebpackChain = async (chain) => {
      frameworkHook(chain)
    }
    await expect(metadata.run()).rejects.toThrow('official JSUI instantiation transform')
    expect(metadata.chain.plugins.has('mainPlugin')).toBe(false)
  })

  it('rejects mismatched runner and final Webpack modes before applying plugins', async () => {
    const mode = runnerHarness()
    mode.config.mode = 'production'
    expect(() => mode.run()).toThrow('requested corpus build mode')
    const chain = runnerHarness()
    chain.config.modifyWebpackChain = async (config) => {
      frameworkHook(config)
      platformHook(config)
    }
    chain.config.onWebpackChainReady = (config) => {
      config.mode = 'production'
    }
    await expect(chain.run()).rejects.toThrow('final Webpack mode')
    expect(chain.applied).not.toHaveBeenCalled()
  })

  it('includes the wrapper bytes in generation identity while preserving the frozen dependencies and other targets', async () => {
    const catalog = await readFrameworkCatalog()
    const selected = selectFrameworkTarget(catalog, 'taro', '4.3.2', 'harmony-jsui')
    const project = createControlledProject(selected.release, selected.target)
    expect(project.files['harmony-jsui-runner.cjs']).toBe(taroHarmonyRunner)
    for (const [file, source] of Object.entries(taroHarmonyPageFiles)) {
      expect(project.files[file]).toBe(source)
    }
    expect(project.dependencies['@tarojs/webpack5-runner']).toBe('4.3.2')
    const configuration = { exports: {} as { compiler: object, harmony: object, plugins: unknown[] } }
    const resolve = vi.fn(() => 'harmony-jsui-plugin.cjs')
    runInNewContext(project.files['config/index.js']!, {
      module: configuration,
      process: { env: { CORPUS_OUTPUT: 'out/development' } },
      require: Object.assign(() => path, { resolve }),
    })
    expect(configuration.exports.compiler).toEqual({ type: 'webpack5' })
    expect(configuration.exports.harmony).toMatchObject({ debugReact: true })
    expect(configuration.exports.plugins).toContain('harmony-jsui-plugin.cjs')
    expect(resolve).toHaveBeenCalledWith('../harmony-jsui-plugin.cjs')
    const identity = { repository: 'example/templates', commit: 'a'.repeat(40), licenseId: 'confirmed' }
    const changed = { ...project, files: { ...project.files, 'harmony-jsui-runner.cjs': `${taroHarmonyRunner}\n` } }
    expect(generationInputKey(identity, project)).not.toBe(generationInputKey(identity, changed))
    for (const [file, source] of Object.entries(taroHarmonyPageFiles)) {
      expect(generationInputKey(identity, project)).not.toBe(generationInputKey(identity, { ...project, files: { ...project.files, [file]: `${source}\n` } }))
    }
    expect(() => createTaroProject({ ...selected.release, version: '4.3.3' }, selected.target)).toThrow('frozen Taro 4.3.2')
    const weapp = selectFrameworkTarget(catalog, 'taro', '4.3.2', 'weapp')
    expect(createControlledProject(weapp.release, weapp.target).files).not.toHaveProperty('harmony-jsui-runner.cjs')
    expect(Object.keys(createControlledProject(weapp.release, weapp.target).files).some(file => file.startsWith('harmony-jsui-page/'))).toBe(false)
  })
})
