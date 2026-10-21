import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { bounded, deferred, installNativeInstrumentation, turn } from '../chokidar/support.mjs'
import { resolvePollingFixtureRoot } from './pollingFixture.mjs'

const timeoutMs = 8000
const root = resolvePollingFixtureRoot(await mkdtemp(path.join(os.tmpdir(), 'vite-missing-env-ready-')))
const sourceDirectory = path.join(root, 'src')
const sourceFile = path.join(sourceDirectory, 'app.json')
const environmentFiles = new Set(['.env', '.env.local', '.env.development', '.env.development.local'].map(name => path.join(root, name)))
const sourceStatHeld = deferred()
const releaseSourceStat = deferred()
const missingStatsReturned = deferred()
const rootRegistered = deferred()
const sourceRegistered = deferred()
const ready = deferred()
const originalStat = fs.stat
const errors = []
const failures = []
const missingResults = new Map()
const instrumentation = installNativeInstrumentation({
  root,
  platform: 'native',
  beforeWatch(file) {
    if (file === root) {
      rootRegistered.resolve()
    }
    if (file === sourceFile) {
      sourceRegistered.resolve()
    }
  },
})
let sourceStatWasHeld = false
let returnedMissingStats = 0
let phase = 'initial-files'
let server
let starting
let beforeRelease
let closed = false

/** 暂停真实 stat 结果交还，不替换原生监听器或伪造文件状态。 */
fs.stat = function (filename, ...args) {
  const file = path.resolve(String(filename))
  if (file !== sourceDirectory && !environmentFiles.has(file)) {
    return originalStat.call(this, filename, ...args)
  }
  const callback = args.pop()
  return originalStat.call(this, filename, ...args, (...result) => {
    if (file === sourceDirectory && !sourceStatWasHeld) {
      sourceStatWasHeld = true
      sourceStatHeld.resolve()
      void releaseSourceStat.promise.then(() => callback(...result))
    }
    else if (environmentFiles.has(file)) {
      // 缺失路径在源码扫描确实挂起后交还，固定与平台调度无关的先后关系。
      void sourceStatHeld.promise.then(() => {
        missingResults.set(file, result[0]?.code)
        callback(...result)
        returnedMissingStats++
        if (returnedMissingStats === environmentFiles.size) {
          missingStatsReturned.resolve()
        }
      })
    }
    else {
      callback(...result)
    }
  })
}
syncBuiltinESMExports()

function registrationState() {
  const watcher = server?.watcher
  const watchedSource = Object.entries(watcher?.getWatched() ?? {}).find(([directory]) => path.resolve(directory) === sourceDirectory)?.[1]
  const sourceClosers = [...watcher?._closers ?? []].find(([file]) => path.resolve(file) === sourceFile)?.[1]
  return {
    ready: watcher?._readyEmitted,
    sourceListed: watchedSource?.includes(path.basename(sourceFile)) ?? false,
    sourceCloserCount: sourceClosers?.length ?? 0,
    sourceIgnored: watcher?._isIgnored(sourceFile),
    options: watcher && Object.fromEntries(['usePolling', 'useFsEvents', 'persistent', 'ignoreInitial'].map(key => [key, watcher.options[key]])),
    native: instrumentation.snapshot(),
  }
}

try {
  await mkdir(sourceDirectory)
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}')
  await writeFile(sourceFile, '{"marker":"before-startup-save"}')
  // Vite 内置 Chokidar 在模块加载时捕获 callback stat，必须在独立进程内先安装精确 gate。
  const { createServer } = await import('vite')
  phase = 'starting-real-vite-watcher'
  starting = createServer({
    root,
    mode: 'development',
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true },
    server: { hmr: false, middlewareMode: true, watch: { usePolling: false, useFsEvents: false } },
    plugins: [{
      name: 'contract:missing-env-source-registration',
      configureServer(host) {
        host.watcher.once('ready', () => ready.resolve())
        host.watcher.on('error', error => errors.push(error))
        if (host.watcher._readyEmitted) {
          ready.resolve()
        }
      },
    }],
  })
  starting.catch(() => {})
  await bounded(sourceStatHeld.promise, 'real source directory stat gate', timeoutMs)
  await bounded(missingStatsReturned.promise, 'four real missing environment stat results', timeoutMs)
  await bounded(rootRegistered.promise, 'real root scan and native registration', timeoutMs)
  server = await bounded(starting, 'real Vite server initialization', timeoutMs)
  // 只等待已交还 callback 的微任务和 nextTick 完成，不用固定等待或重试改变注册时序。
  await turn()
  phase = 'source-stat-still-held'
  beforeRelease = registrationState()
  assert.equal(returnedMissingStats, 4)
  assert.equal(missingResults.size, 4)
  assert.equal([...missingResults.values()].every(code => code === 'ENOENT'), true)
  assert.equal(beforeRelease.sourceIgnored, false)
  assert.equal(beforeRelease.sourceListed, false)
  assert.equal(beforeRelease.sourceCloserCount, 0)
  assert.equal(beforeRelease.native.attempts.some(attempt => attempt.path === 'src/app.json'), false)
  assert.equal(beforeRelease.ready, false, 'Vite watcher must not publish ready while source registration is held after missing environment paths finish')

  phase = 'releasing-real-source-registration'
  releaseSourceStat.resolve()
  await bounded(ready.promise, 'ready after real source registration', timeoutMs)
  const registered = registrationState()
  assert.equal(registered.sourceListed, true)
  assert.ok(registered.sourceCloserCount > 0, 'ready must include an owned exact source closer')
  assert.equal(registered.native.handles.some(handle => handle.path === 'src/app.json' && !handle.closed), true)
  assert.equal(registered.options.usePolling, false)
  assert.equal(registered.options.useFsEvents, false)

  phase = 'saving-after-ready'
  const changed = deferred()
  const onChange = (file) => {
    if (path.resolve(file) === sourceFile) {
      changed.resolve()
    }
  }
  server.watcher.on('change', onChange)
  try {
    await writeFile(sourceFile, '{"marker":"saved-during-startup"}')
    await bounded(changed.promise, 'native source change after public ready', timeoutMs)
  }
  finally {
    server.watcher.off('change', onChange)
  }
  assert.deepEqual(errors, [])
}
catch (error) {
  failures.push(error)
  console.error(JSON.stringify({ contract: 'vite-missing-env-ready', phase, returnedMissingStats, beforeRelease, failureState: registrationState() }))
}
finally {
  releaseSourceStat.resolve()
  try {
    server ??= await bounded(starting ?? Promise.resolve(), 'Vite initialization during cleanup', timeoutMs)
    if (server && sourceStatWasHeld) {
      await bounded(sourceRegistered.promise, 'held real source registration during cleanup', timeoutMs)
    }
  }
  catch (error) { failures.push(error) }
  try {
    await server?.close()
  }
  catch (error) { failures.push(error) }
  try {
    await instrumentation.assertAllClosed(timeoutMs)
    closed = true
  }
  catch (error) { failures.push(error) }
  fs.stat = originalStat
  instrumentation.restore()
  syncBuiltinESMExports()
  if (closed) {
    await rm(root, { recursive: true, force: true })
  }
}
if (failures.length === 1) {
  throw failures[0]
}
if (failures.length) {
  throw new AggregateError(failures, 'Vite missing environment readiness contract failed')
}
console.log(JSON.stringify({ status: 'passed', checks: ['missing-env-ready-after-source-registration', 'native-source-save-after-ready'] }))
