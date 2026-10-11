import assert from 'node:assert/strict'
import { evaluateStrict, extract } from './helpers.mjs'

export async function verifyOptimizerCancel(source) {
  const entered = Promise.withResolvers()
  const cancelled = Promise.withResolvers()
  const releaseCancel = Promise.withResolvers()
  const build = Promise.withResolvers()
  let removals = 0
  const context = evaluateStrict(`${extract(source, 'function runOptimizeDeps(', 'async function prepareRolldownOptimizerRun(')}\nglobalThis.run = runOptimizeDeps`, {
    fs: { mkdirSync() {}, writeFileSync() {}, rmSync() { removals++ } },
    path: { resolve: (...parts) => parts.join('/') },
    debug$4: undefined,
    import_picocolors: { default: { red: value => value } },
    flattenId: value => value,
    setTimeout,
    clearTimeout,
    performance$1: performance,
    getDepsCacheDir: () => 'cache/deps',
    getProcessingDepsCacheDir: () => 'cache/processing',
    initDepsOptimizerMetadata: () => ({ optimized: {}, discovered: {}, chunks: {}, depInfoList: [] }),
    depsFromOptimizedDepInfo: () => ({}),
    getOptimizedBrowserHash: () => 'stable',
    prepareRolldownOptimizerRun: async () => ({
      idToExports: {},
      context: {
        async build() {
          entered.resolve()
          return await build.promise
        },
        async cancel() {
          cancelled.resolve()
          await releaseCancel.promise
        },
      },
    }),
  })
  const operation = context.run({ logger: { info() {} } }, { dependency: { src: 'dependency.js' } })
  try {
    await entered.promise
    let closed = false
    const closing = operation.cancel().then(() => {
      closed = true
    })
    await cancelled.promise
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(closed, false, 'Optimization cancellation must wait for the native cancel operation')
    assert.equal(removals, 0, 'Cache cleanup must not race the native writer')
    releaseCancel.resolve()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(closed, false, 'Optimization cancellation must also wait for the running build to settle')
    build.resolve({ output: [] })
    await closing
    assert.equal(removals, 1, 'The cache is removed once after its writer has stopped')
    return ['optimizer-native-cancel']
  }
  finally {
    releaseCancel.resolve()
    build.resolve({ output: [] })
    await operation.cancel()
    await operation.result
  }
}
