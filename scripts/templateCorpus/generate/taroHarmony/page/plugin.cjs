const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const { META_TYPE } = require('@tarojs/helper')

const runnerRequire = createRequire(require.resolve('@tarojs/webpack5-runner/package.json'))
assert.equal(runnerRequire('@tarojs/taro-loader/package.json').version, '4.3.2', 'Harmony JSUI page compatibility requires the frozen Taro loader.')
const pageLoader = runnerRequire.resolve('@tarojs/taro-loader/lib/page')
// 来自 npm 官方 4.3.2 tarball，先验证原始 loader，禁止对同版本的本地改写静默适配。
assert.equal(createHash('sha256').update(readFileSync(pageLoader)).digest('hex'), '69cdb1ffc0c694180880b71f767ca1ac519f481151fb07a016f1194930a025b3', 'The frozen official page loader source changed.')
const compatibilityLoader = require.resolve('./loader.cjs')
const pluginName = 'TemplateCorpusHarmonyPageCompatibility'

module.exports = class HarmonyPageCompatibilityPlugin {
  constructor({ loaderMeta, mode }) {
    assert.ok(loaderMeta && typeof loaderMeta.modifyInstantiate === 'function', 'Harmony page compatibility requires the official shared loader metadata.')
    this.loaderMeta = loaderMeta
    this.mode = mode
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      // 官方 MiniPlugin 在同一 hook 的默认 stage 插入页面 loader；本轮适配随后登记。
      compiler.webpack.NormalModule.getCompilationHooks(compilation).loader.tap({ name: pluginName, stage: Number.MAX_SAFE_INTEGER }, (_context, module) => {
        if (module.miniType !== META_TYPE.PAGE) {
          return
        }
        const official = module.loaders.filter(item => item.loader === '@tarojs/taro-loader/lib/page' || item.loader === pageLoader)
        assert.equal(official.length, 1, 'Harmony page compatibility requires exactly one official page loader.')
        assert.equal(module.loaders[0], official[0], 'The official page loader must execute last before page compatibility.')
        assert.equal(official[0].options.loaderMeta, this.loaderMeta, 'Harmony page compatibility must retain the shared official loader metadata.')
        assert.equal(official[0].options.name, module.name, 'The official page loader name must match its page module.')
        assert.ok(module.resource && module.name, 'Harmony page compatibility requires a named page resource.')
        assert.ok(!module.loaders.some(item => item.loader === compatibilityLoader), 'Harmony page compatibility may only be installed once per module.')
        // loader-runner 保留传入路径；固定到已核验的原始文件，避免逻辑名解析到另一副本。
        official[0].loader = pageLoader
        // 普通 loader 从右向左执行：官方页面输出先经过兼容层，之后才交给 Webpack 解析。
        module.loaders.unshift({
          loader: compatibilityLoader,
          options: { pageLoader, loaderMeta: this.loaderMeta, name: module.name, resourcePath: module.resource, mode: this.mode },
        })
      })
    })
  }
}
