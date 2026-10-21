import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import {
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { createServer } from 'vite'
import { weapp } from 'weapp-vite/vite'
import { weappOptions } from './fixture.mjs'
import { bounded } from './native.mjs'
import { assertOutput, closeOwner } from './public.mjs'

async function waitForClassic(server) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (server.config.experimental.bundledDev === false) {
      return
    }
    await delay(10)
  }
  assert.fail('The actual host did not complete classic handoff')
}

async function waitForTitle(owner, title, evidence) {
  const relative = 'pages/index/index.json'
  const file = path.join(owner.outDir, relative)
  const observation = { file: relative, expectedTitle: title ?? null }
  ;(evidence.pageJson ??= []).push(observation)
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const source = await readFile(file, 'utf8')
      observation.lastRead = { source }
      const value = JSON.parse(source)
      if (value.navigationBarTitleText === title) {
        return
      }
    }
    catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
        throw error
      }
      observation.lastRead = { ...observation.lastRead, error: { code: error.code, message: String(error) } }
    }
    await delay(10)
  }
  try {
    observation.outputFiles = (await readdir(owner.outDir, { recursive: true })).map(file => file.replaceAll('\\', '/')).sort()
  }
  catch (error) {
    observation.outputInspectionError = { code: error.code, message: String(error) }
  }
  assert.fail('The classic output did not publish the expected page JSON')
}

/** 普通 npm 安装的 Vite 保留原生 polling，真实宿主交接不能靠仓库依赖补丁。 */
export async function pollingHostHandoff(ctx) {
  const { root, owners, errors, instrumentation, evidence } = ctx
  const outDir = path.join(root, '.weapp-vite/delivery-host')
  await writeFile(path.join(root, 'project.private.config.json'), '{"setting":{"compileHotReLoad":true}}')
  const server = await bounded(createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    weapp: { ...weappOptions, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
    plugins: [weapp(), {
      name: 'consumer:observe-host-polling-errors',
      configureServer(host) {
        host.watcher.on('error', error => errors.push(error))
      },
    }],
    build: { outDir, minify: false },
    server: { ws: false, middlewareMode: true, host: '127.0.0.1', port: 0, watch: { usePolling: true, interval: 100 } },
  }), 'actual public polling host initialization', 60_000)
  const owner = { kind: 'polling-host', outDir, close: () => server.close() }
  owners.push(owner)
  assert.equal(server.config.experimental.bundledDev, true, 'The requested stateful host must actually start stateful')
  assert.equal(server.config.server.watch.usePolling, true, 'The native Vite watcher must remain enabled')
  assert.notEqual(server.config.server.hmr, false, 'Classic source delivery requires Vite hotUpdate hooks')
  await assertOutput(owner, 'shared/marker.txt', 'before-shared-mutation')
  const pageConfig = path.join(root, 'src/pages/index/index.json')
  const originalHandles = instrumentation.pollingHandles.filter(handle => handle.path === 'src/pages/index/index.json')
  assert(originalHandles.length > 0, 'The stateful host must acquire real polling subscriptions before fallback')
  const modifiedConfig = '{"navigationBarTitleText":"actual-consumer-classic"}'
  await writeFile(pageConfig, modifiedConfig)
  await waitForClassic(server)
  evidence.hostOutput = {
    requested: path.relative(root, outDir).replaceAll('\\', '/'),
    resolved: path.relative(root, path.resolve(root, server.config.build.outDir)).replaceAll('\\', '/'),
    sourcePageConfig: await readFile(pageConfig, 'utf8'),
  }
  await waitForTitle(owner, 'actual-consumer-classic', evidence)
  const newHandles = instrumentation.pollingHandles.filter(handle => handle.path === 'src/pages/index/index.json' && !originalHandles.includes(handle))
  assert(newHandles.length > 0, 'The classic host must acquire a new polling subscription')
  const firstNewAcquisition = Math.min(...newHandles.map(handle => handle.acquiredSequence))
  assert(originalHandles.every(handle => handle.stopEvents === 1 && handle.stoppedSequence < firstNewAcquisition), 'Old host polling must fully stop before the replacement acquires the same source')
  for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
    await assert.rejects(readFile(path.join(outDir, file)), { code: 'ENOENT' })
  }
  const marker = path.join(root, 'src/shared/marker.txt')
  await writeFile(marker, 'classic-survives-old-host-close')
  await assertOutput(owner, 'shared/marker.txt', 'classic-survives-old-host-close')
  await writeFile(pageConfig, '{}')
  await waitForTitle(owner, undefined, evidence)
  for (const force of [false, true]) {
    await bounded(server.restart(force), 'actual public host config restart', 60_000)
    assert.equal(server.config.experimental.bundledDev, false, 'Config restart must preserve the command classic decision')
    assert.equal(server.config.server.watch.usePolling, true, 'Config restart cannot bypass the polling boundary')
    assert.notEqual(server.config.server.hmr, false, 'Config restart must preserve classic source delivery')
    const value = `classic-after-config-restart-${force}`
    await writeFile(marker, value)
    await assertOutput(owner, 'shared/marker.txt', value)
  }
  assert.equal(server.config.weapp.hmr.runtime, 'stateful-experimental', 'Fallback must preserve the original user request')
  await closeOwner(owner)
  assert.deepEqual(errors, [])
  Object.assign(evidence, { actualStatefulStarted: true, nativePollingEnabled: true, oldPollingStoppedBeforeClassicAcquisition: true, classicOutputUpdated: true, sourceRestored: true, configRestarts: 2, requestedRuntimeUnchanged: true })
}
