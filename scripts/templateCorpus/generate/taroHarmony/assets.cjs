const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const process = require('node:process')

assert.equal(process.env.TARO_ENV, 'harmony', 'Harmony asset compatibility requires the genuine Harmony target.')
assert.ok(!process.env.TARO_PLATFORM || process.env.TARO_PLATFORM === 'harmony', 'Harmony asset compatibility cannot replace another platform.')
assert.ok(['development', 'production'].includes(process.env.CORPUS_BUILD_MODE), 'Harmony asset compatibility requires an explicit corpus build mode.')
assert.equal(process.env.NODE_ENV, process.env.CORPUS_BUILD_MODE, 'Harmony asset compatibility must retain the requested Node mode.')

const packageFile = require.resolve('@tarojs/plugin-platform-harmony-ets/package.json')
assert.equal(require(packageFile).version, '4.3.2', 'Harmony asset compatibility requires the frozen official platform version.')
const filename = require.resolve('@tarojs/plugin-platform-harmony-ets/dist/index.js')
assert.equal(filename, path.join(path.dirname(packageFile), 'dist/index.js'), 'The official Harmony platform module must belong to the verified package.')
assert.equal(require.cache[filename], undefined, 'Harmony asset compatibility must load the official platform module before the CLI.')
const bytes = readFileSync(filename)
const sourceSha256 = createHash('sha256').update(bytes).digest('hex')
// npm 官方 4.3.2 tarball 的完整模块身份，任何其他源码均拒绝适配。
assert.equal(sourceSha256, 'f68dc24c6dee31089195636229c70ff4bc2778f6af4c520d4167763f92d472cc', 'The frozen official Harmony platform module source changed.')
const source = bytes.toString('utf8')
const original = 'path.resolve(__dirname, \'..\', \'components\', \'components-harmony\')'
const corrected = 'path.resolve(__dirname, \'components-harmony\')'
assert.equal(source.split(original).length, 2, 'Harmony asset compatibility requires exactly one known component source path.')

// 只在指定 CLI 子进程中预载单个原模块；不修改包文件、全局加载钩子或输出目录。
const adapted = new Module(filename, module)
adapted.filename = filename
adapted.paths = Module._nodeModulePaths(path.dirname(filename))
require.cache[filename] = adapted
try {
  adapted._compile(source.replace(original, corrected), filename)
  assert.equal(require.cache[filename], adapted, 'Harmony asset compatibility lost ownership of the preloaded module cache.')
  adapted.loaded = true
}
catch (error) {
  if (require.cache[filename] === adapted) {
    delete require.cache[filename]
  }
  throw error
}
console.log(JSON.stringify({ event: 'template-corpus-harmony-jsui-asset-path-compatibility', version: '4.3.2', sourceSha256, protocol: 'official-dist-components-source' }))
