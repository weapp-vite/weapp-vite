const assert = require('node:assert/strict')
const process = require('node:process')
const { META_TYPE } = require('@tarojs/helper')
const adaptPageSource = require('./source.cjs')

module.exports = function harmonyPageCompatibility(source) {
  const options = this.getOptions()
  const official = this.loaders[this.loaderIndex + 1]
  assert.equal(process.env.TARO_ENV, 'harmony', 'Page compatibility only accepts the genuine Harmony target.')
  assert.equal(process.env.TARO_PLATFORM, 'harmony', 'Page compatibility only accepts the genuine Harmony platform.')
  assert.equal(process.env.CORPUS_BUILD_MODE, options.mode, 'Page compatibility must retain the requested corpus mode.')
  assert.equal(process.env.NODE_ENV, options.mode, 'Page compatibility must retain the requested Node mode.')
  assert.equal(this._module.miniType, META_TYPE.PAGE, 'Page compatibility only accepts official page entry modules.')
  assert.equal(this.loaderIndex, 0, 'Page compatibility must run immediately before the Webpack module parser.')
  assert.equal(this.resourcePath, options.resourcePath, 'The compatibility page resource changed.')
  assert.equal(official && official.path, options.pageLoader, 'Page compatibility must run immediately after the frozen official page loader.')
  assert.equal(this.loaders.filter(item => item.path === options.pageLoader).length, 1, 'Page compatibility requires exactly one official page loader execution.')
  assert.equal(official.options.name, options.name, 'The compatibility page name changed.')
  assert.equal(official.options.loaderMeta, options.loaderMeta, 'The compatibility page loader metadata changed.')
  const output = adaptPageSource(source, options.name)
  console.log(JSON.stringify({ event: 'template-corpus-harmony-jsui-page-compatibility', mode: options.mode, page: options.name, protocol: 'factory-default-without-duplicate-component' }))
  return output
}
