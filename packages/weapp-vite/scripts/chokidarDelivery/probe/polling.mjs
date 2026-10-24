import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
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

function observeStartupOutput() {
  let output = ''
  const streams = [process.stdout, process.stderr].map((stream) => {
    const original = stream.write
    const write = function (chunk, ...args) {
      output += String(chunk)
      return original.call(this, chunk, ...args)
    }
    stream.write = write
    return { stream, original, write }
  })
  return {
    read: () => output,
    restore() {
      for (const { stream, original, write } of streams) {
        if (stream.write === write) {
          stream.write = original
        }
      }
    },
  }
}

function assertStartupClassic(server, output) {
  assert.equal(server.config.experimental.bundledDev, false, 'The explicit stateful request must start in classic')
  assert.equal(server.config.weapp.hmr.runtime, 'stateful-experimental', 'Startup admission must preserve the original user request')
  assert.equal(server.config.server.watch.usePolling, true, 'The native Vite watcher must remain enabled')
  assert.notEqual(server.config.server.hmr, false, 'Classic source delivery requires Vite hotUpdate hooks')
  const fallback = output.match(/\[weapp-vite\] HMR fallback (\{[^\r\n]*\})/g) ?? []
  const ready = output.match(/\[weapp-vite\] HMR classic ready (\{[^\r\n]*\})/g) ?? []
  assert.equal(fallback.length, 1, 'The command must make exactly one startup capability decision')
  assert.equal(ready.length, 1, 'Startup classic must become ready exactly once')
  const reason = JSON.parse(fallback[0].slice('[weapp-vite] HMR fallback '.length))
  assert.equal(typeof reason.message, 'string')
  assert.deepEqual(reason, {
    from: 'stateful-experimental',
    to: 'classic',
    reason: 'ide-classic-handoff',
    message: reason.message,
    requested: 'stateful-experimental',
    actual: 'classic',
    phase: 'switching',
  })
  assert.deepEqual(JSON.parse(ready[0].slice('[weapp-vite] HMR classic ready '.length)), {
    reason: 'ide-classic-handoff',
    requested: 'stateful-experimental',
    actual: 'classic',
    phase: 'classic',
  })
  assert(output.indexOf(fallback[0]) < output.indexOf(ready[0]), 'Classic readiness must follow startup admission')
  assert.doesNotMatch(output, /Build failed|delivery failed|patch transform failed|classic HMR 切换失败|classic 回退失败/)
  return reason
}

async function assertNoStatefulResources(root, outDir) {
  for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
    await assert.rejects(readFile(path.join(outDir, file)), { code: 'ENOENT' })
  }
  await assert.rejects(readFile(path.join(root, '.weapp-vite/ide-asset-watch.json')), { code: 'ENOENT' })
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

async function exerciseStartupClassicPolling(ctx, output) {
  const { root, owners, errors, instrumentation, evidence } = ctx
  const outDir = path.join(root, '.weapp-vite/delivery-host')
  const privateConfig = '{"setting":{"compileHotReLoad":true}}'
  const privateConfigFile = path.join(root, 'project.private.config.json')
  const classicLease = path.join(root, '.weapp-vite/ide-classic-project.private.config.json')
  const hostGenerations = []
  await writeFile(privateConfigFile, privateConfig)
  const server = await bounded(createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    weapp: { ...weappOptions, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
    plugins: [weapp(), {
      name: 'consumer:observe-host-polling-errors',
      configureServer(host) {
        hostGenerations.push({ actualRuntime: host.config.experimental.bundledDev === false ? 'classic' : 'stateful-experimental' })
        host.watcher.on('error', error => errors.push(error))
      },
    }],
    build: { outDir, minify: false },
    server: { ws: false, middlewareMode: true, host: '127.0.0.1', port: 0, watch: { usePolling: true, interval: 100 } },
  }), 'actual public polling host initialization', 60_000)
  const owner = { kind: 'polling-host', outDir, close: () => server.close() }
  owners.push(owner)
  assert(hostGenerations.every(host => host.actualRuntime === 'classic'), 'No stateful host watcher may be installed before startup classic')
  const startupDecision = assertStartupClassic(server, output.read())
  assert.equal(hostGenerations.length, 1, 'Startup admission must not install a stateful host generation')
  await readFile(classicLease)
  assert.equal(JSON.parse(await readFile(privateConfigFile, 'utf8')).setting.compileHotReLoad, false)
  await assertNoStatefulResources(root, outDir)
  await assertOutput(owner, 'shared/marker.txt', 'before-shared-mutation')
  const pageConfig = path.join(root, 'src/pages/index/index.json')
  const pageHandles = () => instrumentation.pollingHandles.filter(handle => handle.path === 'src/pages/index/index.json')
  const originalHandles = pageHandles()
  assert(originalHandles.length > 0, 'The startup classic host must acquire real polling subscriptions')
  const modifiedConfig = '{"navigationBarTitleText":"actual-consumer-classic"}'
  await writeFile(pageConfig, modifiedConfig)
  evidence.hostOutput = {
    requested: path.relative(root, outDir).replaceAll('\\', '/'),
    resolved: path.relative(root, path.resolve(root, server.config.build.outDir)).replaceAll('\\', '/'),
    sourcePageConfig: await readFile(pageConfig, 'utf8'),
  }
  await waitForTitle(owner, 'actual-consumer-classic', evidence)
  assert.equal(hostGenerations.length, 1, 'Page JSON changes must stay in the startup classic generation')
  assert.deepEqual(pageHandles(), originalHandles, 'Page JSON changes must retain native polling subscriptions')
  assert(originalHandles.every(handle => handle.stopEvents === 0), 'Classic edits cannot retire the active polling owner')
  assertStartupClassic(server, output.read())
  await assertNoStatefulResources(root, outDir)
  const marker = path.join(root, 'src/shared/marker.txt')
  await writeFile(marker, 'classic-survives-old-host-close')
  await assertOutput(owner, 'shared/marker.txt', 'classic-survives-old-host-close')
  await writeFile(pageConfig, '{}')
  await waitForTitle(owner, undefined, evidence)
  const pollingRestarts = []
  for (const force of [false, true]) {
    const previous = pageHandles()
    const active = previous.filter(handle => handle.stopEvents === 0)
    assert(active.length > 0, 'Each configuration restart must have an active polling owner')
    await bounded(server.restart(force), 'actual public host config restart', 60_000)
    assert(hostGenerations.every(host => host.actualRuntime === 'classic'), 'A configuration restart cannot install a stateful host watcher')
    assertStartupClassic(server, output.read())
    const replacement = pageHandles().filter(handle => !previous.includes(handle))
    assert(replacement.length > 0, 'A configuration restart must acquire real replacement polling subscriptions')
    const firstAcquisition = Math.min(...replacement.map(handle => handle.acquiredSequence))
    assert(active.every(handle => handle.stopEvents === 1 && handle.stoppedSequence < firstAcquisition), 'Old host polling must fully stop before the replacement acquires the same source')
    assert(replacement.every(handle => handle.stopEvents === 0), 'Replacement polling must remain active after old host cleanup')
    pollingRestarts.push({ force, stoppedBeforeReplacement: true })
    const value = `classic-after-config-restart-${force}`
    await writeFile(marker, value)
    await assertOutput(owner, 'shared/marker.txt', value)
    await assertNoStatefulResources(root, outDir)
  }
  assert.equal(hostGenerations.length, 3, 'Only startup and the two requested configuration restarts may acquire hosts')
  await writeFile(marker, 'before-shared-mutation')
  await assertOutput(owner, 'shared/marker.txt', 'before-shared-mutation')
  await waitForTitle(owner, undefined, evidence)
  for (const file of ['app.js', 'pages/index/index.js', 'pages/index/index.json', 'pages/index/index.wxml']) {
    await readFile(path.join(outDir, file))
  }
  assert.equal(server.config.weapp.hmr.runtime, 'stateful-experimental', 'Fallback must preserve the original user request')
  await closeOwner(owner)
  assert.equal(await readFile(privateConfigFile, 'utf8'), privateConfig, 'The command must restore the exact original private config')
  await assert.rejects(readFile(classicLease), { code: 'ENOENT' })
  await assertNoStatefulResources(root, outDir)
  assert.deepEqual(errors, [])
  Object.assign(evidence, {
    requestedRuntime: startupDecision.requested,
    actualRuntime: startupDecision.actual,
    startupFallbackReason: startupDecision.reason,
    actualStatefulStarted: false,
    statefulArtifactsAbsent: true,
    hostGenerations,
    nativePollingEnabled: true,
    pollingRestarts,
    oldPollingStoppedBeforeRestartAcquisition: true,
    classicOutputUpdated: true,
    sourceRestored: true,
    privateConfigRestored: true,
    classicLeaseReleased: true,
    configRestarts: 2,
    requestedRuntimeUnchanged: true,
  })
}

/** 普通 npm 安装的 Vite 启动即采用 classic，仍保留原生 polling 及配置重启的真实交付。 */
export async function pollingHostHandoff(ctx) {
  const output = observeStartupOutput()
  try {
    await exerciseStartupClassicPolling(ctx, output)
  }
  finally {
    output.restore()
  }
}
