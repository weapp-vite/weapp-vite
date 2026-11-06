const assert = require('node:assert/strict')
const process = require('node:process')

const frozenVersion = '4.3.2'
for (const name of ['@tarojs/cli', '@tarojs/helper', '@tarojs/webpack5-runner', '@tarojs/plugin-framework-react', '@tarojs/plugin-platform-harmony-ets']) {
  assert.equal(require(`${name}/package.json`).version, frozenVersion, 'Harmony JSUI runner requires the frozen Taro 4.3.2 toolchain.')
}
const runner = require('@tarojs/webpack5-runner/dist/index.mini.js').default
const MiniPlugin = require('@tarojs/webpack5-runner/dist/plugins/MiniPlugin.js').default
const SingleEntryDependency = require('@tarojs/webpack5-runner/dist/dependencies/TaroSingleEntryDependency.js').default
const { META_TYPE } = require('@tarojs/helper')

assert.equal(typeof runner, 'function', 'The frozen official Mini runner must expose its default function.')

// 仅桥接固定发布版中 React mainPlugin 与 JSUI miniPlugin 的配置键差异。
// 两个入口引用同一真实构造器和参数；临时入口不会进入最终 Webpack 配置。
module.exports = function harmonyJsuiRunner(appPath, config) {
  const requestedMode = process.env.CORPUS_BUILD_MODE
  assert.ok(requestedMode === 'development' || requestedMode === 'production', 'Harmony JSUI requires an explicit corpus build mode.')
  assert.equal(process.env.NODE_ENV, requestedMode, 'Harmony JSUI NODE_ENV must match the requested corpus build mode.')
  assert.equal(config.mode, requestedMode, 'The official runner must receive the requested corpus build mode.')
  assert.equal(config.isWatch, false, 'Corpus generation must compile once without a persistent watcher.')
  assert.equal(process.env.TARO_ENV, 'harmony', 'Harmony JSUI must retain its genuine target identity.')
  assert.equal(process.env.TARO_PLATFORM, 'harmony', 'Harmony JSUI must retain its official platform dispatch.')
  assert.equal(config.buildAdapter, 'harmony', 'The compatibility runner only accepts the Harmony target.')
  assert.equal(config.framework, 'react', 'The frozen JSUI component implementation requires React.')
  assert.equal(config.fileType.templ, '.hml', 'The official Harmony JSUI template extension must be preserved.')
  assert.equal(typeof config.modifyWebpackChain, 'function', 'The official plugin dispatcher must remain installed.')
  assert.equal(typeof config.onCompilerMake, 'function', 'The official compiler-make dispatcher must remain installed.')
  const originalModify = config.modifyWebpackChain
  const originalReady = config.onWebpackChainReady
  const originalMake = config.onCompilerMake
  let expectedArgs
  return runner(appPath, {
    ...config,
    async onCompilerMake(compilation, compiler, plugin) {
      assert.ok(plugin instanceof MiniPlugin, 'The compiler-make bridge only accepts the official MiniPlugin instance.')
      const dependencies = plugin.dependencies
      assert.ok(dependencies instanceof Map, 'The frozen MiniPlugin must own its genuine dependency Map.')
      // 4.3.2 的 MiniPlugin 用 path#entryName 保存 STATIC，JSUI 仍按 path 读取。
      // 只给原 dispatcher 暴露兼容读取视图；所有写入与遍历保留官方 Map 的原始条目。
      plugin.dependencies = new Proxy(dependencies, {
        get(target, property) {
          if (property === 'get') {
            return (key) => {
              if (target.has(key) || typeof key !== 'string') {
                return target.get(key)
              }
              const matches = [...target.values()].filter(dependency => dependency instanceof SingleEntryDependency && dependency.request === key && dependency.miniType === META_TYPE.STATIC)
              if (matches.length !== 1) {
                return undefined
              }
              console.log(JSON.stringify({ event: 'template-corpus-harmony-jsui-static-dependency', mode: requestedMode, entryName: matches[0].name, keyProtocol: 'request-to-static-entry' }))
              return matches[0]
            }
          }
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
      try {
        return await originalMake(compilation, compiler, plugin)
      }
      finally {
        plugin.dependencies = dependencies
      }
    },
    async modifyWebpackChain(chain, webpack, data) {
      assert.ok(chain.plugins.has('miniPlugin'), 'The official Mini runner must register miniPlugin before hooks.')
      assert.ok(!chain.plugins.has('mainPlugin'), 'An existing mainPlugin cannot be replaced by the JSUI bridge.')
      const mini = chain.plugin('miniPlugin')
      assert.equal(mini.get('plugin'), MiniPlugin, 'JSUI must use the frozen official MiniPlugin constructor.')
      const args = mini.get('args')
      assert.ok(Array.isArray(args) && args.length === 1 && args[0] && typeof args[0] === 'object', 'The official MiniPlugin options protocol changed.')
      const options = args[0]
      assert.equal(options.combination.config.buildAdapter, 'harmony', 'MiniPlugin must retain the Harmony configuration.')
      options.loaderMeta ||= {}
      const loaderMeta = options.loaderMeta
      assert.ok(loaderMeta && typeof loaderMeta === 'object' && !Array.isArray(loaderMeta), 'MiniPlugin loaderMeta must be a shared options object.')
      chain.plugin('mainPlugin').use(MiniPlugin, args)
      try {
        await originalModify(chain, webpack, data)
        assert.equal(chain.plugin('mainPlugin').get('plugin'), MiniPlugin, 'React must configure the real MiniPlugin constructor.')
        assert.equal(chain.plugin('mainPlugin').get('args'), args, 'React must preserve the shared MiniPlugin arguments.')
        assert.equal(mini.get('args'), args, 'JSUI must preserve the shared MiniPlugin arguments.')
        assert.equal(options.loaderMeta, loaderMeta, 'Framework and platform hooks must share the same loaderMeta object.')
        assert.equal(loaderMeta.creator, 'createReactApp', 'The official React loader metadata must remain installed.')
        assert.equal(loaderMeta.creatorLocation, '@tarojs/plugin-framework-react/dist/runtime', 'The official React runtime must remain installed.')
        assert.equal(typeof loaderMeta.modifyInstantiate, 'function', 'The official JSUI instantiation transform must remain installed.')
        expectedArgs = args
      }
      finally {
        chain.plugins.delete('mainPlugin')
      }
    },
    onWebpackChainReady(chain) {
      if (typeof originalReady === 'function') {
        originalReady(chain)
      }
      assert.ok(expectedArgs && !chain.plugins.has('mainPlugin'), 'The temporary compatibility entry must be removed before compilation.')
      const mini = chain.plugin('miniPlugin')
      assert.equal(mini.get('plugin'), MiniPlugin, 'The final JSUI plugin constructor must remain official.')
      assert.equal(mini.get('args'), expectedArgs, 'The final JSUI options must retain both official hook changes.')
      const plugins = chain.toConfig().plugins.filter(plugin => plugin instanceof MiniPlugin)
      assert.equal(plugins.length, 1, 'Exactly one official MiniPlugin may execute in the final compiler.')
      assert.equal(plugins[0].options.loaderMeta, expectedArgs[0].loaderMeta, 'The final MiniPlugin must consume the shared loader metadata.')
      assert.equal(chain.get('mode'), requestedMode, 'The final Webpack mode must match the requested corpus build mode.')
      console.log(JSON.stringify({ event: 'template-corpus-harmony-jsui-mode', requestedMode, nodeEnv: process.env.NODE_ENV, runnerMode: config.mode, webpackMode: chain.get('mode'), isWatch: config.isWatch }))
    },
  })
}
