const assert = require('node:assert/strict')
const process = require('node:process')

for (const name of ['@tarojs/cli', '@tarojs/webpack5-runner', '@tarojs/plugin-framework-react', '@tarojs/plugin-platform-harmony-ets']) {
  assert.equal(require(`${name}/package.json`).version, '4.3.2', 'Harmony JSUI plugin requires the frozen Taro 4.3.2 toolchain.')
}

function requestedMode() {
  const mode = process.env.CORPUS_BUILD_MODE
  assert.ok(mode === 'development' || mode === 'production', 'Harmony JSUI requires an explicit corpus build mode.')
  assert.equal(process.env.NODE_ENV, mode, 'Harmony JSUI NODE_ENV must match the requested corpus build mode.')
  return mode
}

module.exports = function harmonyJsuiPlugin(ctx) {
  const runner = require.resolve('./harmony-jsui-runner.cjs')
  const installed = new WeakSet()
  let captured

  // modifyRunnerOpts 在官方配置校验前调用，只捕获本轮引用，不向共享的初始配置写入 runner。
  ctx.modifyRunnerOpts(({ opts }) => {
    const previous = captured
    captured = undefined
    assert.equal(process.env.TARO_ENV, 'harmony', 'Harmony JSUI must retain its genuine target identity.')
    assert.equal(opts.platform, 'harmony', 'The compatibility plugin only accepts the Harmony target.')
    assert.equal(opts.framework, 'react', 'The frozen JSUI component implementation requires React.')
    assert.ok(!previous && !installed.has(opts), 'A Harmony runner configuration may only be captured once per build.')
    assert.ok(opts.compiler && typeof opts.compiler === 'object' && opts.compiler.type === 'webpack5', 'The frozen JSUI compiler must remain webpack5.')
    assert.ok(!Object.hasOwn(opts.compiler, 'runner'), 'The validated compiler configuration must not contain a runner override.')
    captured = opts
  })

  // onBuildStart 位于 CLI 配置校验之后；替换运行配置的 compiler，保留初始配置对象。
  ctx.onBuildStart(() => {
    const opts = captured
    captured = undefined
    assert.ok(opts && opts === ctx.runOpts.config && !installed.has(opts), 'Harmony JSUI must install the runner on the current captured configuration only once.')
    assert.ok(!Object.hasOwn(ctx.initialConfig.compiler, 'runner'), 'The initial compiler configuration must remain valid before runner installation.')
    assert.ok(!Object.hasOwn(opts.compiler, 'runner'), 'The current runner configuration must not already contain an override.')
    assert.equal(opts.compiler.type, 'webpack5', 'The frozen JSUI compiler must remain webpack5.')
    requestedMode()
    opts.compiler = { ...opts.compiler, runner }
    installed.add(opts)
  })

  // CLI 对非 watch 构建先填 production；在官方平台 handler 前设置本轮公开 mode 选项。
  ctx.register({
    name: 'harmony',
    stage: -1,
    fn({ config }) {
      const current = ctx.runOpts.config
      assert.ok(installed.has(current) && config.compiler === current.compiler, 'Harmony JSUI must use the runner configuration installed for this build.')
      assert.equal(config.platform, 'harmony', 'The official Harmony platform handler must remain selected.')
      assert.equal(config.isWatch, false, 'Corpus generation must compile once without a persistent watcher.')
      assert.equal(config.compiler.runner, runner, 'The official platform must receive the controlled runtime runner.')
      config.mode = requestedMode()
    },
  })
}
