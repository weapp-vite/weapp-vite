import type { ViteDevServer } from 'vite'
import type { ProductFailure } from './support'
import assert from 'node:assert/strict'
import { unwatchFile, watchFile } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createDevViteServer } from '../../src/devLifecycle/vite'
import { watcherIgnored } from './ignored'
import { watcherInputs } from './inputs'
import { watcherReference } from './ref'
import { closeServers, event, fixture, serverConfig, waitFor } from './support'

async function transformed(server: ViteDevServer, value: string) {
  const output = await waitFor(() => server.transformRequest('/source.js'), result => result?.code.includes(value) === true, `Product transform did not publish ${value}`)
  assert.ok(output?.code.includes(value))
}

async function delivered(tasks: Promise<unknown>[]) {
  const outcomes = await Promise.allSettled(tasks)
  const errors = outcomes.flatMap(outcome => outcome.status === 'rejected' ? [outcome.reason] : [])
  if (errors.length) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Product and independent listeners did not deliver every save', { cause: errors[0] })
  }
}

export async function polling() {
  for (const first of ['slow', 'fast'] as const) {
    await fixture({ 'package.json': '{"type":"module"}', 'source.js': 'export const value = 41' }, async (root) => {
      const source = path.join(root, 'source.js')
      const servers: ViteDevServer[] = []
      const received = { slow: 0, fast: 0 }
      let external = 0
      let externalNotification = Promise.withResolvers<void>()
      const listener = () => {
        external++
        externalNotification.resolve()
        externalNotification = Promise.withResolvers<void>()
      }
      const nextExternal = () => {
        const notification = externalNotification.promise
        return waitFor(() => notification, () => true, 'Independent native listener did not deliver the save')
      }
      let failure: ProductFailure | undefined
      try {
        for (const [name, interval] of [['slow', 120], ['fast', 20]] as const) {
          const server = await createDevViteServer({
            ...serverConfig(root),
            server: { ...serverConfig(root).server, watch: { usePolling: true, interval } },
          })
          server.watcher.on('change', (file) => {
            if (path.resolve(file) === source) {
              received[name]++
            }
          })
          servers.push(server)
          await server.transformRequest('/source.js')
          if (name === 'slow') {
            watchFile(source, { interval: 120, persistent: false }, listener)
          }
        }
        await delivered([nextExternal(), ...servers.map(server => event(server, source, async () => {
          // 第二个观察者只安装监听；写入由唯一的第一个观察者发起。
          if (server === servers[0]) {
            await writeFile(source, 'export const value = 42; // both product owners must see this save')
          }
        }))])
        for (const server of servers) {
          await transformed(server, '42')
        }
        assert.ok(external > 0, 'Independent native listener must receive the first write')
        const index = first === 'slow' ? 0 : 1
        const departing = servers[index]!
        const survivor = servers[1 - index]!
        await departing.close()
        await departing.close()
        const stopped = received[first]
        const previousExternal = external
        await delivered([nextExternal(), event(survivor, source, async () => {
          await writeFile(source, 'export const value = 43; // survivor remains active after peer close')
        })])
        await transformed(survivor, '43')
        assert.equal(received[first], stopped, 'Closed owner must not receive later events')
        assert.ok(external > previousExternal, 'Product close must preserve an independent native listener')
        assert.ok((await readFile(source, 'utf8')).includes('43'))
      }
      catch (error) { failure = { error } }
      finally {
        unwatchFile(source, listener)
        await closeServers(servers, failure)
      }
    })
  }
  await watcherReference()
  return { closeOrders: ['slow', 'fast'], values: [42, 43], independentListenerPreserved: true, refUnrefNaturalExit: true }
}

export async function ready() {
  await fixture({ 'package.json': '{"type":"module"}', 'source.js': 'export const value = 1' }, async (root) => {
    let server: ViteDevServer | undefined
    let failure: ProductFailure | undefined
    let retiredWatcher: ViteDevServer['watcher'] | undefined
    let retiredEvents = 0
    const source = path.join(root, 'source.js')
    const retiredChanged = (file: string) => {
      if (path.resolve(file) === source) {
        retiredEvents++
      }
    }
    try {
      server = await createDevViteServer({
        ...serverConfig(root),
        envDir: path.join(root, 'missing-env'),
        publicDir: path.join(root, 'missing-public'),
        server: { ...serverConfig(root).server, watch: { usePolling: true, interval: 10 } },
      })
      assert.ok(server.watcher.getWatched()[root]?.includes('source.js'), 'Product startup must wait for existing source registration')
      retiredWatcher = server.watcher
      retiredWatcher.on('change', retiredChanged)
      await server.transformRequest('/source.js')
      await event(server, source, async () => {
        await writeFile(source, 'export const value = 42; // first save immediately after product startup')
      })
      await transformed(server, '42')
      assert.ok(retiredEvents > 0, 'The original owner must observe the startup save')
      await server.restart()
      assert.notEqual(server.watcher, retiredWatcher, 'Product restart must acquire a replacement watcher owner')
      assert.ok(server.watcher.getWatched()[root]?.includes('source.js'), 'Product restart must wait for existing source registration')
      const stopped = retiredEvents
      await event(server, source, async () => {
        await writeFile(source, 'export const value = 43; // first save immediately after product restart')
      })
      await transformed(server, '43')
      assert.equal(retiredEvents, stopped, 'Retired owner must not receive saves after restart')
    }
    catch (error) { failure = { error } }
    finally {
      retiredWatcher?.off('change', retiredChanged)
      await closeServers([server], failure)
    }
  })
  const inputs = await watcherInputs()
  const ignored = await watcherIgnored()
  return { missingEnvAndPublic: true, sourceRegistered: true, firstSaveDelivered: true, restartFirstSaveDelivered: true, retiredOwnerStopped: true, inputs, ignored }
}
