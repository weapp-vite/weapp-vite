import type { ViteDevServer } from 'vite'
import type { ProductFailure } from './support'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { createDevViteServer } from '../../src/devLifecycle/vite'
import { weapp } from '../../src/vite'
import { closeServers, fixture, miniFiles, observeOutcome, serverConfig, waitFor } from './support'

export async function miniOptimizer() {
  for (const runtime of ['classic', 'stateful-experimental'] as const) {
    await fixture(miniFiles, async (root) => {
      let server: ViteDevServer | undefined
      let failure: ProductFailure | undefined
      try {
        server = await createServer({
          ...serverConfig(root),
          plugins: [weapp()],
          weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime } },
          server: { ...serverConfig(root).server, watch: null },
        })
        assert.equal(server.config.optimizeDeps.noDiscovery, true)
        assert.deepEqual(server.config.optimizeDeps.include, [])
        assert.deepEqual(server.config.optimizeDeps.entries, [])
      }
      catch (error) { failure = { error } }
      finally { await closeServers([server], failure) }
    })
  }
  return { requestedModes: ['classic', 'stateful-experimental'], dependencyDiscovery: false }
}

async function webScannerClose(idleFirst: boolean) {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  await fixture({ 'package.json': '{"type":"module"}', 'entry.js': 'export const answer = 42' }, async (root) => {
    const cacheDir = path.join(root, 'cache')
    let server: ViteDevServer | undefined
    let failure: ProductFailure | undefined
    let closing: Promise<PromiseSettledResult<void>> | undefined
    try {
      server = await createDevViteServer({
        ...serverConfig(root),
        cacheDir,
        server: { ...serverConfig(root).server, watch: null },
        optimizeDeps: {
          noDiscovery: false,
          entries: ['entry.js'],
          rolldownOptions: { plugins: [{
            name: 'product:block-web-scanner',
            async buildStart() {
              entered.resolve()
              await release.promise
            },
          }] },
        },
      })
      await waitFor(() => entered.promise, () => true, 'The product dependency scanner did not start')
      if (idleFirst) {
        await waitFor(() => server!.environments.client!.waitForRequestsIdle(), () => true, 'The product request crawl did not become idle')
      }
      let closed = false
      closing = observeOutcome(server.close().then(() => {
        closed = true
      }, (error) => {
        closed = true
        throw error
      }))
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(closed, false, 'Product close must wait for the active dependency scanner')
      release.resolve()
      const outcome = await closing
      if (outcome.status === 'rejected') {
        throw outcome.reason
      }
      const files = await readdir(cacheDir).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          return []
        }
        throw error
      })
      assert.deepEqual(files, [], 'Cancelled product scanning must not leave newly created cache work')
    }
    catch (error) { failure = { error } }
    finally {
      release.resolve()
      const outcome = await closing
      if (outcome?.status === 'rejected' && (!failure || failure.error !== outcome.reason)) {
        failure = { error: failure ? new AggregateError([failure.error, outcome.reason], 'Product scanner assertion and close failed', { cause: failure.error }) : outcome.reason }
      }
      await closeServers([server], failure)
    }
  })
}

export async function webOptimizer() {
  const errors: unknown[] = []
  for (const idleFirst of [false, true]) {
    try {
      await webScannerClose(idleFirst)
    }
    catch (error) {
      errors.push(new AggregateError([error], `Web scanner close failed (requests idle before close: ${idleFirst})`, { cause: error }))
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Web optimizer close did not complete every public lifecycle contract', { cause: errors[0] })
  }
  return { scannerEnabled: true, closeWaited: true, cancelledCacheEmpty: true, requestsIdleBeforeClose: [false, true] }
}
