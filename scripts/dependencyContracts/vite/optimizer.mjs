import assert from 'node:assert/strict'
import { evaluateStrict, extract } from './helpers.mjs'

function deferred() {
  return Promise.withResolvers()
}

function harness(source, { metadata, scan, optimization, noDiscovery = false, cancelOptimization = false } = {}) {
  const emptyMetadata = () => ({ hash: 'stable', optimized: {}, discovered: {}, chunks: {}, depInfoList: [] })
  const crawl = deferred()
  let runs = 0
  let cancels = 0
  const errors = []
  const context = evaluateStrict(`${extract(source, 'function createDepsOptimizer(', 'function createExplicitDepsOptimizer(')}\nglobalThis.create = createDepsOptimizer`, {
    debug$2: undefined,
    debounceMs: 100,
    setTimeout,
    clearTimeout,
    promiseWithResolvers: deferred,
    initDepsOptimizerMetadata: emptyMetadata,
    createIsOptimizedDepFile: () => () => false,
    createIsOptimizedDepUrl: () => () => false,
    loadCachedDepOptimizationMetadata: () => metadata ?? Promise.resolve(undefined),
    addManuallyIncludedOptimizeDeps: async () => {},
    toDiscoveredDependencies: () => ({}),
    devToScanEnvironment: environment => environment,
    discoverProjectDependencies: () => ({
      result: scan?.promise ?? Promise.resolve({}),
      cancel: async () => { scan?.resolve({}) },
    }),
    runOptimizeDeps: () => {
      runs++
      return {
        result: optimization?.promise ?? Promise.resolve({ metadata: emptyMetadata(), commit: async () => {}, cancel() {} }),
        cancel: async () => {
          cancels++
          if (cancelOptimization) {
            optimization.resolve({ metadata: emptyMetadata(), commit: async () => {}, cancel() {} })
          }
        },
      }
    },
    findInteropMismatches: () => [],
    import_picocolors: { default: { green: value => value } },
  })
  const environment = {
    config: { optimizeDeps: { holdUntilCrawlEnd: true, noDiscovery } },
    logger: { info() {}, error(error) { errors.push(error) } },
    waitForRequestsIdle: () => crawl.promise,
    moduleGraph: { invalidateAll() {} },
    hot: { send() {} },
  }
  return {
    optimizer: context.create(environment),
    crawl,
    errors,
    get runs() { return runs },
    get cancels() { return cancels },
  }
}

export async function verifyOptimizer(source) {
  const scan = deferred()
  const scanning = harness(source, { scan })
  await scanning.optimizer.init()
  const close = scanning.optimizer.close()
  assert.equal(scanning.optimizer.close(), close, 'Repeated close must share the resource completion boundary')
  await close
  assert.equal(scanning.runs, 0, 'Closing a pending dependency scan must not start a new cache writer')

  const metadata = deferred()
  const initializing = harness(source, { metadata: metadata.promise })
  const init = initializing.optimizer.init()
  let initializedClose = false
  const closingInitialization = initializing.optimizer.close().then(() => {
    initializedClose = true
  })
  await Promise.resolve()
  assert.equal(initializedClose, false, 'Close must wait for active optimizer initialization')
  metadata.resolve(undefined)
  await Promise.all([init, closingInitialization])
  assert.equal(initializing.runs, 0, 'Initialization finishing during close cannot create a cache writer')

  const optimization = deferred()
  const commit = deferred()
  const entered = deferred()
  const publishing = harness(source, { optimization, noDiscovery: true })
  await publishing.optimizer.init()
  optimization.resolve({
    metadata: { hash: 'stable', optimized: {}, discovered: {}, chunks: {}, depInfoList: [] },
    commit: async () => {
      entered.resolve()
      await commit.promise
    },
    cancel() {},
  })
  await entered.promise
  let publishedClose = false
  const closingPublication = publishing.optimizer.close().then(() => {
    publishedClose = true
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(publishedClose, false, 'Close must wait for the cache publication already in progress')
  commit.resolve()
  await closingPublication
  assert.deepEqual([...scanning.errors, ...initializing.errors, ...publishing.errors], [])

  const crawlOptimization = deferred()
  const crawling = harness(source, { optimization: crawlOptimization, cancelOptimization: true })
  await crawling.optimizer.init()
  await crawling.optimizer.scanProcessing
  crawling.crawl.resolve()
  await new Promise(resolve => setImmediate(resolve))
  const closingCrawl = crawling.optimizer.close()
  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(crawling.cancels, 1, 'Crawl completion must retain the native cancellation handle until the build settles')
  }
  finally {
    crawlOptimization.resolve({ metadata: { optimized: {} }, cancel() {} })
    await closingCrawl
  }
  assert.deepEqual(crawling.errors, [])
  return ['optimizer-scan-close', 'optimizer-init-close', 'optimizer-publication-close', 'optimizer-crawl-close']
}
