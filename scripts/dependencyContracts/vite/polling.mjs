import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'
import { bounded, deferred, installNativeInstrumentation } from '../chokidar/support.mjs'
import { assertPollingFixtureRoot, resolvePollingFixtureRoot } from './pollingFixture.mjs'

/** 通过真实 Vite server 观察两个 owner 和另一个原生副本的 polling 归属。 */
async function verifyPollingCloseOrder(first) {
  const root = resolvePollingFixtureRoot(await mkdtemp(path.join(os.tmpdir(), 'vite-polling-owners-')))
  const file = path.join(root, 'marker.txt')
  const canonicalRoot = resolvePollingFixtureRoot(root)
  const canonicalFile = path.join(canonicalRoot, 'marker.txt')
  const instrumentation = installNativeInstrumentation({ root, platform: 'native' })
  const owners = []
  const errors = []
  let external
  let externalEvents = 0
  let closed = false
  let phase = 'initial-files'
  async function open(name, interval, persistent) {
    phase = `open-${name}`
    const ready = deferred()
    const events = []
    const observed = []
    let readied = false
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true },
      server: { hmr: false, middlewareMode: true, watch: { usePolling: true, interval, persistent } },
      plugins: [{
        name: 'contract:observe-public-polling-owner',
        configureServer(host) {
          host.watcher.once('ready', () => {
            readied = true
            ready.resolve()
          })
          host.watcher.on('error', error => errors.push(error))
          host.watcher.on('change', changed => events.push(changed))
          host.watcher.on('all', (event, changed) => observed.push({
            event,
            file: path.basename(changed),
            fixturePathMatch: changed === file,
            canonicalPathMatch: changed === canonicalFile,
          }))
        },
      }],
    })
    const owner = { name, server, events, observed, ready: () => readied }
    owners.push(owner)
    await bounded(ready.promise, 'real Vite polling ready', 10_000)
    assertPollingFixtureRoot(server.config.root, canonicalRoot)
    return owner
  }
  async function mutate(value, active, mutation) {
    phase = mutation
    const waiting = active.map(({ server, name }) => {
      const observed = deferred()
      const changed = (changed) => {
        if (changed === file) {
          observed.resolve()
        }
      }
      server.watcher.on('change', changed)
      return bounded(observed.promise, `surviving Vite polling event (${first}-close-first/${mutation}/${name})`, 10_000)
        .finally(() => server.watcher.off('change', changed))
    })
    await writeFile(file, value)
    await Promise.all(waiting)
  }
  const failures = []
  try {
    await writeFile(file, 'initial')
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}')
    const slow = await open('slow', 120, false)
    external = () => {
      externalEvents++
    }
    fs.watchFile(file, { persistent: true, interval: 120 }, external)
    const fast = await open('fast', 100, true)
    await mutate('both owners receive the first update', [slow, fast], 'both-owners-update')
    assert(externalEvents > 0, 'Vite upgrade must preserve another native copy')
    const departing = first === 'slow' ? slow : fast
    const surviving = first === 'slow' ? fast : slow
    phase = 'close-departing'
    await departing.server.close()
    await departing.server.close()
    const previousExternal = externalEvents
    const previousDeparting = departing.events.length
    await mutate('survivor receives an update after another owner closes', [surviving], 'survivor-update')
    assert.equal(departing.events.length, previousDeparting, 'Closed owner must not receive later callbacks')
    assert(externalEvents > previousExternal, 'Owner close must preserve another native copy')
    phase = 'close-survivor'
    await surviving.server.close()
    await surviving.server.close()
    const targetHandles = instrumentation.pollingHandles.filter(handle => handle.path === 'marker.txt')
    assert(targetHandles.length > 0)
    assert(targetHandles.every(handle => !handle.stopped), 'The independent native listener must remain active')
    fs.unwatchFile(file, external)
    external = undefined
    assert.deepEqual(errors, [])
  }
  catch (error) {
    failures.push(error)
    console.error(JSON.stringify({
      contract: 'vite-polling-owners',
      first,
      phase,
      error: error instanceof Error ? error.message : String(error),
      environment: Object.fromEntries(['CHOKIDAR_USEPOLLING', 'CHOKIDAR_INTERVAL', 'CHOKIDAR_BINARY_INTERVAL'].map(key => [key, process.env[key] ?? null])),
      fixtureRootIsCanonical: root === canonicalRoot,
      externalEvents,
      owners: owners.map(({ name, server, events, observed, ready }) => ({
        name,
        ready: ready(),
        closed: server.watcher.closed,
        serverRootMatchesFixture: path.resolve(server.config.root) === root,
        serverRootMatchesCanonicalFixture: path.resolve(server.config.root) === canonicalRoot,
        options: Object.fromEntries(['usePolling', 'interval', 'binaryInterval', 'persistent', 'atomic', 'awaitWriteFinish'].map(key => [key, server.watcher.options[key]])),
        changes: events.map(changed => ({ fixturePathMatch: changed === file, canonicalPathMatch: changed === canonicalFile })),
        observed,
      })),
      native: instrumentation.snapshot(),
    }))
  }
  finally {
    for (const { server } of owners) {
      try {
        await server.close()
      }
      catch (error) { failures.push(error) }
    }
    if (external) {
      fs.unwatchFile(file, external)
    }
    try {
      await instrumentation.assertAllClosed(10_000)
      assert(instrumentation.snapshot().pollingReleases.every(release => release.exactListener), 'Every polling release must identify its own listener')
      closed = true
    }
    catch (error) { failures.push(error) }
    instrumentation.restore()
    if (closed) {
      await rm(root, { recursive: true, force: true })
    }
  }
  if (failures.length === 1) {
    throw failures[0]
  }
  if (failures.length) {
    throw new AggregateError(failures, 'Vite polling owner contract failed')
  }
  return `polling-owner-${first}-close-first`
}

export async function verifyPollingOwners() {
  const checks = []
  for (const first of ['slow', 'fast']) {
    checks.push(await verifyPollingCloseOrder(first))
  }
  return checks
}
